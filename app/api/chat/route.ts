import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { runRagChainStream } from "@/lib/rag/chain";
import type { ChatMessage } from "@/lib/ai/deepseek";
import { CLAUDE_MODEL } from "@/lib/ai/deepseek";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { evaluateAndUpdateStreak } from "@/lib/firebase/streak";
import { checkRateLimit } from "@/lib/ratelimit";

/** Free tier: ~250,000 tokens/month ≈ 100 questions */
const FREE_TOKEN_BUDGET = 250_000;
const PRO_TOKEN_BUDGET = 2_000_000;
const PREMIUM_TOKEN_BUDGET = 4_000_000;

/** Monthly query count hard cap (matches the "X jautājumi šomēnes" display in the UI) */
const FREE_MONTHLY_QUERY_LIMIT = 60;

/** Daily hard limits (queries per calendar day UTC) */
const FREE_DAILY_LIMIT = 15;
const PRO_DAILY_LIMIT = 40;
const PREMIUM_DAILY_LIMIT = 80;

function getBudgetForTier(tier: string): number {
  switch (tier) {
    case "pro": return PRO_TOKEN_BUDGET;
    case "premium":
    case "school_pro": return PREMIUM_TOKEN_BUDGET;
    default: return FREE_TOKEN_BUDGET;
  }
}

function getDailyLimitForTier(tier: string): number {
  switch (tier) {
    case "pro": return PRO_DAILY_LIMIT;
    case "premium":
    case "school_pro": return PREMIUM_DAILY_LIMIT;
    default: return FREE_DAILY_LIMIT;
  }
}

function getImageLimitForTier(tier: string): number | undefined {
  switch (tier) {
    case "pro": return 3;
    case "premium":
    case "school_pro": return 10;
    default: return undefined;
  }
}

function getWebSourcesForTier(tier: string): number {
  switch (tier) {
    case "pro": return 6;
    case "premium":
    case "school_pro": return 12;
    default: return 3; // bezmaksas
  }
}

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BASE64_CHARS = Math.ceil((5 * 1024 * 1024 * 4) / 3); // ~5 MB binary → base64

const ChatRequestSchema = z.object({
  message: z.string().max(2000).default(""),
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  model: z.enum(["deepseek", "claude"]).optional().default("deepseek"),
  conversationId: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(6)
    .optional(),
  imageBase64: z.string().max(MAX_IMAGE_BASE64_CHARS).optional(),
  imageMimeType: z.string().optional(),
});

// Discriminated union returned from the usage transaction
type TxnOk = { ok: true; tier: string };
type TxnDenied = {
  ok: false;
  reason:
    | "user_not_found"
    | "token_budget_exceeded"
    | "monthly_query_limit_exceeded"
    | "daily_limit_exceeded"
    | "image_daily_limit_exceeded";
  dailyLimit?: number;
  imageLimit?: number;
};

export async function POST(request: NextRequest) {
  // --- Auth verification ---
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- Burst rate limiting: 5 requests per 60-second window per UID ---
  // Uses node-redis (REDIS_URL). Fails open if Redis is unavailable so a
  // Redis outage never blocks legitimate users. Firestore daily caps backstop.
  const rl = await checkRateLimit(decoded.uid, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAfter: rl.retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      }
    );
  }

  // --- Validate body before reserving a usage slot ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_error",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC — matches streak.ts todayUTC()
  const yearMonth = today.slice(0, 7);           // YYYY-MM

  const userRef = adminDb.collection("users").doc(decoded.uid);
  const usageRef = userRef.collection("usage").doc(yearMonth);

  // --- Atomic limit check + slot reservation ---
  // Monthly budget and daily hard cap are evaluated inside a single Firestore
  // transaction so concurrent requests cannot both pass the same check.
  // Short-term burst protection (5 req/min sliding window) is handled upstream
  // by Upstash Redis edge middleware before this code is reached.
  let txnResult: TxnOk | TxnDenied;
  try {
    txnResult = await adminDb.runTransaction(async (txn) => {
      const [userDoc, usageDoc] = await Promise.all([
        txn.get(userRef),
        txn.get(usageRef),
      ]);

      if (!userDoc.exists) {
        return { ok: false, reason: "user_not_found" } satisfies TxnDenied;
      }

      const userData = userDoc.data() as Record<string, unknown>;
      const tier = (userData.tier as string) ?? "free";

      const usageData = usageDoc.exists
        ? (usageDoc.data() as Record<string, unknown>)
        : ({} as Record<string, unknown>);

      // --- Monthly token budget ---
      const tokensUsed =
        ((usageData.inputTokens as number) ?? 0) +
        ((usageData.outputTokens as number) ?? 0);
      if (tokensUsed >= getBudgetForTier(tier)) {
        return { ok: false, reason: "token_budget_exceeded" } satisfies TxnDenied;
      }

      // --- Monthly query count hard cap (free tier only) ---
      // Enforces the "X jautājumi šomēnes" limit shown in the UI.
      if (tier === "free") {
        const monthlyQueryCount = (usageData.queryCount as number) ?? 0;
        if (monthlyQueryCount >= FREE_MONTHLY_QUERY_LIMIT) {
          return { ok: false, reason: "monthly_query_limit_exceeded" } satisfies TxnDenied;
        }
      }

      // --- Daily hard limit ---
      const storedDailyDate = usageData.dailyDate as string | undefined;
      const currentDailyCount =
        storedDailyDate === today ? ((usageData.dailyCount as number) ?? 0) : 0;
      const dailyLimit = getDailyLimitForTier(tier);
      if (currentDailyCount >= dailyLimit) {
        return { ok: false, reason: "daily_limit_exceeded", dailyLimit } satisfies TxnDenied;
      }

      // --- Daily image upload limit ---
      const imgLimit = getImageLimitForTier(tier);
      const imgDailyDate = usageData.imageDailyDate as string | undefined;
      const imgDailyCount =
        imgDailyDate === today ? ((usageData.imageDailyCount as number) ?? 0) : 0;
      if (parsed.data.imageBase64 && imgLimit !== undefined && imgDailyCount >= imgLimit) {
        return {
          ok: false,
          reason: "image_daily_limit_exceeded",
          imageLimit: imgLimit,
        } satisfies TxnDenied;
      }

      // --- Reserve the slot: write updated counters atomically ---
      // Short-term rate limiting (5 req/min sliding window) is now handled at
      // the edge by Upstash Redis in middleware.ts. Only business-logic limits
      // (daily cap, monthly budget) are tracked here in Firestore.
      const newDailyCount =
        storedDailyDate === today ? currentDailyCount + 1 : 1;
      const newImgDailyCount =
        parsed.data.imageBase64 && imgLimit !== undefined
          ? imgDailyDate === today ? imgDailyCount + 1 : 1
          : null;

      txn.set(
        usageRef,
        {
          queryCount: FieldValue.increment(1),
          lastQueryAt: now.toISOString(),
          dailyDate: today,
          dailyCount: newDailyCount,
          ...(newImgDailyCount !== null
            ? { imageDailyDate: today, imageDailyCount: newImgDailyCount }
            : {}),
        },
        { merge: true },
      );

      return { ok: true, tier } satisfies TxnOk;
    });
  } catch (err) {
    console.error("Usage transaction failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // --- Handle limit denials ---
  if (!txnResult.ok) {
    switch (txnResult.reason) {
      case "user_not_found":
        return NextResponse.json({ error: "user_not_found" }, { status: 404 });
      case "token_budget_exceeded":
        return NextResponse.json(
          { error: "token_budget_exceeded", upgrade_url: "/pricing" },
          { status: 429 },
        );
      case "monthly_query_limit_exceeded":
        return NextResponse.json(
          { error: "token_budget_exceeded", upgrade_url: "/pricing" },
          { status: 429 },
        );
      case "daily_limit_exceeded":
        return NextResponse.json(
          { error: "daily_limit_exceeded", limit: txnResult.dailyLimit },
          { status: 429 },
        );
      case "image_daily_limit_exceeded":
        return NextResponse.json(
          { error: "image_daily_limit_exceeded", limit: txnResult.imageLimit },
          { status: 429 },
        );
    }
  }

  const { tier } = txnResult;

  // Update streak now that the user has sent a real message. Fire-and-forget —
  // a streak failure must never block the chat response.
  const isPaidTier = tier !== "free";
  evaluateAndUpdateStreak(decoded.uid, isPaidTier).catch((err) =>
    console.error("Streak update failed:", err),
  );

  const { subject, grade, model, conversationId, imageBase64, imageMimeType } = parsed.data;
  let { conversationHistory } = parsed.data;

  // Image upload is a Pro/Premium feature
  if (imageBase64 && tier === "free") {
    return NextResponse.json({ error: "image_upload_requires_pro" }, { status: 403 });
  }

  // Validate image MIME type if provided
  if (imageBase64 && imageMimeType && !ALLOWED_IMAGE_MIME.has(imageMimeType)) {
    return NextResponse.json({ error: "unsupported_image_mime_type" }, { status: 400 });
  }

  // Prompt injection is mitigated via strict system instructions in the LLM prompt,
  // not by stripping user input here (regex-based HTML removal breaks valid inputs
  // such as math inequalities and is trivially bypassed anyway).
  const message = parsed.data.message;

  // --- Server-side history reconstruction (page-refresh edge case) ---
  // When the client sends an existing conversationId but empty history (e.g. after
  // a page refresh that cleared React state), fetch the last 6 messages from
  // Firestore so the LLM has context. If the client already sent ≥2 messages,
  // trust the client to avoid a redundant read.
  if (conversationId && (!conversationHistory || conversationHistory.length < 2)) {
    try {
      const historySnap = await Promise.race([
        adminDb
          .collection("conversations")
          .doc(conversationId)
          .collection("messages")
          .orderBy("createdAt", "desc")
          .limit(6)
          .get(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("history_fetch_timeout")), 2000),
        ),
      ]);
      const fetchedHistory = (historySnap as FirebaseFirestore.QuerySnapshot)
        .docs
        .reverse()
        .map((doc) => {
          const d = doc.data();
          return { role: d.role as "user" | "assistant", content: d.content as string };
        });
      if (fetchedHistory.length > 0) {
        conversationHistory = fetchedHistory;
      }
    } catch (err) {
      console.error("Server-side history fetch failed, continuing with empty history:", err);
    }
  }

  // Tier-based model routing: only premium and school_pro may use Claude
  const effectiveModel =
    tier === "premium" || tier === "school_pro" ? model : "deepseek";

  // Max output tokens: 800 for all tiers
  const maxTokens = 800;

  // --- Conversation persistence ---
  const SUBJECT_LABELS: Record<string, string> = {
    math: "Matemātika", latvian: "Latviešu val.", english: "Angļu val.",
    science: "Dabaszinības", history: "Vēsture", social_studies: "Soc. zinības",
    physics: "Fizika", chemistry: "Ķīmija", biology: "Bioloģija",
    informatics: "Informātika",
  };

  let activeConversationId = conversationId ?? "";
  const convCollection = adminDb.collection("conversations");

  if (activeConversationId) {
    // Verify the conversation exists and belongs to the authenticated user.
    // Admin SDK bypasses Firestore security rules, so ownership must be checked
    // explicitly here — otherwise any authenticated user could inject messages
    // into another user's conversation by supplying their conversationId.
    const convSnap = await convCollection.doc(activeConversationId).get();
    if (!convSnap.exists) {
      return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
    }
    const convData = convSnap.data() as Record<string, unknown>;
    if (convData.userId !== decoded.uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Update existing conversation timestamp
    await convCollection.doc(activeConversationId).update({
      updatedAt: now.toISOString(),
    });
  } else {
    // Create new conversation — title from first ~40 chars of message (fallback for image-only)
    const titleSource = message.trim() || (imageBase64 ? "📎 Attēls" : "Saruna");
    const title = titleSource.length > 40 ? titleSource.slice(0, 37) + "..." : titleSource;
    const convRef = await convCollection.add({
      userId: decoded.uid,
      title,
      subject,
      grade,
      subjectLabel: SUBJECT_LABELS[subject] ?? subject,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    activeConversationId = convRef.id;
  }

  // Save user message
  const messagesCollection = convCollection
    .doc(activeConversationId)
    .collection("messages");

  await messagesCollection.add({
    role: "user",
    content: message || (imageBase64 ? "📎 Attēls" : ""),
    ...(imageBase64 ? { hasImage: true } : {}),
    createdAt: now.toISOString(),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Emit conversationId so the client can track it
      const convIdData = JSON.stringify({
        type: "conversationId",
        conversationId: activeConversationId,
      });
      controller.enqueue(encoder.encode(`data: ${convIdData}\n\n`));

      let fullAssistantContent = "";

      try {
        if (imageBase64 && imageMimeType) {
          // Vision path: use Claude directly with image content block (no RAG)
          const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
          const historyMessages = (conversationHistory ?? []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
          const visionStream = anthropicClient.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system: `Tu esi SkolnieksAI — Latvijas mācību palīgs. Atbildi latviski. Palīdzi skolēnam saprast attēlā redzamo mācību vielu vai uzdevumu. Esi skaidrs un pedagoģisks.`,
            messages: [
              ...historyMessages,
              {
                role: "user" as const,
                content: [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: imageMimeType as "image/jpeg" | "image/png" | "image/webp",
                      data: imageBase64,
                    },
                  },
                  ...(message ? [{ type: "text" as const, text: message }] : []),
                ],
              },
            ],
          });

          for await (const event of visionStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullAssistantContent += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: event.delta.text })}\n\n`),
              );
            }
          }

          const finalMsg = await visionStream.finalMessage();
          const inputTokens = finalMsg.usage.input_tokens;
          const outputTokens = finalMsg.usage.output_tokens;

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", chunks: [], webSources: [], usedWebSearch: false })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", tokensUsed: inputTokens + outputTokens, ai_generated: true, ai_model: "claude-sonnet-4.6" })}\n\n`),
          );

          await usageRef.set(
            { inputTokens: FieldValue.increment(inputTokens), outputTokens: FieldValue.increment(outputTokens) },
            { merge: true },
          );

          if (fullAssistantContent) {
            await messagesCollection.add({
              role: "assistant",
              content: fullAssistantContent,
              tokens: { input: inputTokens, output: outputTokens },
              createdAt: new Date().toISOString(),
            });
          }
        } else {
        // GDPR: Verified — no PII sent to LLM providers. Only query + curriculum context + conversation history.
        const ragStream = runRagChainStream({
          query: message,
          subject,
          grade,
          model: effectiveModel,
          maxTokens,
          conversationHistory: (conversationHistory ?? []) as ChatMessage[],
          maxWebSources: getWebSourcesForTier(tier),
        });

        for await (const event of ragStream) {
          if (event.type === "delta") {
            fullAssistantContent += event.text;
            const data = JSON.stringify({
              type: "chunk",
              content: event.text,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } else if (event.type === "done") {
            const sourcesData = JSON.stringify({
              type: "sources",
              chunks: event.chunks.map((c) => ({
                id: c.metadata.source_pdf,
                subject: c.metadata.subject,
                section: c.metadata.section_title,
              })),
              webSources: event.webSources,
              usedWebSearch: event.usedWebSearch,
              ragPath: event.path,
            });
            controller.enqueue(
              encoder.encode(`data: ${sourcesData}\n\n`),
            );

            const doneData = JSON.stringify({
              type: "done",
              tokensUsed: event.usage.total_tokens,
              // EU AI Act Art. 50 — machine-readable transparency field
              ai_generated: true,
              ai_model: effectiveModel === "claude" ? "claude-sonnet-4.6" : "deepseek-v3",
            });
            controller.enqueue(
              encoder.encode(`data: ${doneData}\n\n`),
            );

            // --- Update token counts in Firestore ---
            // The slot (queryCount, dailyCount, rateWindowCount) was already
            // reserved atomically by the transaction above. Here we only add
            // the actual token counts, which are safe with FieldValue.increment.
            const inputTokens = event.usage.prompt_tokens ?? 0;
            const outputTokens = event.usage.completion_tokens ?? 0;

            await usageRef.set(
              {
                inputTokens: FieldValue.increment(inputTokens),
                outputTokens: FieldValue.increment(outputTokens),
              },
              { merge: true },
            );

            // --- Save assistant message to Firestore ---
            if (fullAssistantContent) {
              await messagesCollection.add({
                role: "assistant",
                content: fullAssistantContent,
                tokens: { input: inputTokens, output: outputTokens },
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
        } // end else (no image)
      } catch (err) {
        const errorData = JSON.stringify({
          type: "error",
          message:
            err instanceof Error ? err.message : "Nezināma kļūda",
        });
        controller.enqueue(
          encoder.encode(`data: ${errorData}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
