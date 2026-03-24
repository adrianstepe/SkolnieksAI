import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runRagChainStream } from "@/lib/rag/chain";
import type { ChatMessage } from "@/lib/ai/deepseek";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/** Free tier: ~150,000 tokens/month ≈ 60 questions */
const FREE_TOKEN_BUDGET = 150_000;
const PREMIUM_TOKEN_BUDGET = 1_500_000;
const EXAM_PREP_TOKEN_BUDGET = 3_000_000;

/** Daily hard limits (queries per calendar day UTC) */
const FREE_DAILY_LIMIT = 15;
const PREMIUM_DAILY_LIMIT = 40;
const EXAM_PREP_DAILY_LIMIT = 80;

/** Rate window: max queries per 1-minute rolling window */
const FREE_RATE_LIMIT = 5;
const PREMIUM_RATE_LIMIT = 5;
const EXAM_PREP_RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000; // 1 minute in ms

function getBudgetForTier(tier: string): number {
  switch (tier) {
    case "premium": return PREMIUM_TOKEN_BUDGET;
    case "exam_prep":
    case "school_pro": return EXAM_PREP_TOKEN_BUDGET;
    default: return FREE_TOKEN_BUDGET;
  }
}

function getDailyLimitForTier(tier: string): number {
  switch (tier) {
    case "premium": return PREMIUM_DAILY_LIMIT;
    case "exam_prep":
    case "school_pro": return EXAM_PREP_DAILY_LIMIT;
    default: return FREE_DAILY_LIMIT;
  }
}

function getRateLimitForTier(tier: string): number {
  switch (tier) {
    case "premium": return PREMIUM_RATE_LIMIT;
    case "exam_prep":
    case "school_pro": return EXAM_PREP_RATE_LIMIT;
    default: return FREE_RATE_LIMIT;
  }
}

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
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
});

// Discriminated union returned from the usage transaction
type TxnOk = { ok: true; tier: string };
type TxnDenied = {
  ok: false;
  reason:
    | "user_not_found"
    | "token_budget_exceeded"
    | "daily_limit_exceeded"
    | "rate_limit_exceeded";
  dailyLimit?: number;
  minutesRemaining?: number;
};

export async function POST(request: NextRequest) {
  // --- Auth verification ---
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const userRef = adminDb.collection("users").doc(decoded.uid);
  const usageRef = userRef.collection("usage").doc(yearMonth);

  // --- Atomic limit check + slot reservation ---
  // All three limits (monthly budget, daily hard cap, 1-min rate window) are
  // evaluated and the counters are written inside a single Firestore transaction
  // so that concurrent requests cannot both pass the same check simultaneously.
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

      // --- Daily hard limit ---
      const storedDailyDate = usageData.dailyDate as string | undefined;
      const currentDailyCount =
        storedDailyDate === today ? ((usageData.dailyCount as number) ?? 0) : 0;
      const dailyLimit = getDailyLimitForTier(tier);
      if (currentDailyCount >= dailyLimit) {
        return { ok: false, reason: "daily_limit_exceeded", dailyLimit } satisfies TxnDenied;
      }

      // --- 1-minute rate window ---
      const rateWindowStart = usageData.rateWindowStart as number | undefined;
      const windowActive =
        rateWindowStart !== undefined &&
        now.getTime() - rateWindowStart < RATE_WINDOW_MS;
      const currentRateWindowCount = windowActive
        ? ((usageData.rateWindowCount as number) ?? 0)
        : 0;
      if (currentRateWindowCount >= getRateLimitForTier(tier)) {
        const msRemaining =
          RATE_WINDOW_MS - (now.getTime() - (rateWindowStart ?? 0));
        return {
          ok: false,
          reason: "rate_limit_exceeded",
          minutesRemaining: Math.ceil(msRemaining / 60_000),
        } satisfies TxnDenied;
      }

      // --- Reserve the slot: write updated counters atomically ---
      const newDailyCount =
        storedDailyDate === today ? currentDailyCount + 1 : 1;
      const isNewWindow = !windowActive;
      const newRateWindowStart = isNewWindow
        ? now.getTime()
        : (rateWindowStart as number);
      const newRateWindowCount = isNewWindow ? 1 : currentRateWindowCount + 1;

      txn.set(
        usageRef,
        {
          queryCount: FieldValue.increment(1),
          lastQueryAt: now.toISOString(),
          dailyDate: today,
          dailyCount: newDailyCount,
          rateWindowStart: newRateWindowStart,
          rateWindowCount: newRateWindowCount,
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
      case "daily_limit_exceeded":
        return NextResponse.json(
          { error: "daily_limit_exceeded", limit: txnResult.dailyLimit },
          { status: 429 },
        );
      case "rate_limit_exceeded":
        return NextResponse.json(
          { error: "rate_limit_exceeded", minutesRemaining: txnResult.minutesRemaining },
          { status: 429 },
        );
    }
  }

  const { tier } = txnResult;

  const { subject, grade, model, conversationHistory, conversationId } = parsed.data;

  // Prompt injection is mitigated via strict system instructions in the LLM prompt,
  // not by stripping user input here (regex-based HTML removal breaks valid inputs
  // such as math inequalities and is trivially bypassed anyway).
  const message = parsed.data.message;

  // Tier-based model routing: only exam_prep and school_pro may use Claude
  const effectiveModel =
    tier === "exam_prep" || tier === "school_pro" ? model : "deepseek";

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
    // Update existing conversation timestamp
    await convCollection.doc(activeConversationId).update({
      updatedAt: now.toISOString(),
    });
  } else {
    // Create new conversation — title from first ~40 chars of message
    const title =
      message.length > 40 ? message.slice(0, 37) + "..." : message;
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
    content: message,
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
        const ragStream = runRagChainStream({
          query: message,
          subject,
          grade,
          model: effectiveModel,
          maxTokens,
          conversationHistory: (conversationHistory ?? []) as ChatMessage[],
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
