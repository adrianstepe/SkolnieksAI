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

function getBudgetForTier(tier: string): number {
  switch (tier) {
    case "premium":
      return PREMIUM_TOKEN_BUDGET;
    case "exam_prep":
    case "school_pro":
      return EXAM_PREP_TOKEN_BUDGET;
    default:
      return FREE_TOKEN_BUDGET;
  }
}

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  model: z.enum(["deepseek", "claude"]).optional().default("deepseek"),
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

export async function POST(request: NextRequest) {
  // --- Auth verification ---
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- Read user tier + usage ---
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const userData = userDoc.data() as Record<string, unknown>;
  const tier = (userData.tier as string) ?? "free";

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const usageRef = userRef.collection("usage").doc(yearMonth);
  const usageDoc = await usageRef.get();

  const usageData = usageDoc.exists
    ? (usageDoc.data() as Record<string, number>)
    : { inputTokens: 0, outputTokens: 0, queryCount: 0 };

  const tokensUsed =
    (usageData.inputTokens ?? 0) + (usageData.outputTokens ?? 0);
  const tokenBudget = getBudgetForTier(tier);

  // --- Usage gate ---
  if (tokensUsed >= tokenBudget) {
    return NextResponse.json(
      { error: "token_budget_exceeded", upgrade_url: "/pricing" },
      { status: 429 },
    );
  }

  // --- Validate body ---
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

  const { message, subject, grade, model, conversationHistory } = parsed.data;

  // Tier-based model routing: free users always get DeepSeek
  const effectiveModel = tier === "free" ? "deepseek" : model;

  // Recency reinforcement payload — appended to the user's latest message
  // to combat attention degradation over long conversations.
  const REINFORCEMENT_SUFFIX =
    "\n\n[SIST\u0112MAS ATG\u0100DIN\u0100JUMS: Pirms atbildes OBLIG\u0100TI atver <thinking> bloku. Izmanto TIKAI latvie\u0161u valodu. Decim\u0101lda\u013Cskait\u013Ci LaTeX iekav\u0101s: $3{,}14$. Debit\u012Bvs oblig\u0101ti. Nekad neraksti \u201Enav datub\u0101z\u0113\u201C.]";

  const reinforcedMessage = message + REINFORCEMENT_SUFFIX;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ragStream = runRagChainStream({
          query: reinforcedMessage,
          subject,
          grade,
          model: effectiveModel,
          conversationHistory: (conversationHistory ?? []) as ChatMessage[],
        });

        for await (const event of ragStream) {
          if (event.type === "delta") {
            const data = JSON.stringify({
              type: "chunk",
              content: event.text,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } else if (event.type === "done") {
            const sourcesData = JSON.stringify({
              type: "sources",
              chunks: event.chunks.map((c) => ({
                id: `${c.metadata.source_pdf}_p${c.metadata.page_number}`,
                subject: c.metadata.subject,
                page: c.metadata.page_number,
                section: c.metadata.section_title,
              })),
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

            // --- Update usage in Firestore ---
            const inputTokens = event.usage.prompt_tokens ?? 0;
            const outputTokens = event.usage.completion_tokens ?? 0;

            await usageRef.set(
              {
                inputTokens: FieldValue.increment(inputTokens),
                outputTokens: FieldValue.increment(outputTokens),
                queryCount: FieldValue.increment(1),
                lastQueryAt: now.toISOString(),
              },
              { merge: true },
            );
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
