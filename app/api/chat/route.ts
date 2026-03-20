import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runRagChainStream } from "@/lib/rag/chain";
import type { ChatMessage } from "@/lib/ai/deepseek";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
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

  const { message, subject, grade, conversationHistory } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ragStream = runRagChainStream({
          query: message,
          subject,
          grade,
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
