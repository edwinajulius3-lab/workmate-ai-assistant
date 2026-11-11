import { createFileRoute } from "@tanstack/react-router";
import { GatewayError, streamResponse } from "@lovable.dev/ai-gateway";

import { CHAT_SYSTEM_PROMPT, emailPrompt, researchPrompt } from "@/lib/ai/prompts";
import { aiRequestSchema, type AIRequest } from "@/lib/ai/request";

const MODEL = "openai/gpt-6-astra";

type Turn = { role: "system" | "user" | "assistant"; content: string };

function buildInput(req: AIRequest): { input: Turn[]; json: boolean } {
  if (req.task === "email") {
    const { system, user } = emailPrompt(req.input);
    return { input: [{ role: "system", content: system }, { role: "user", content: user }], json: false };
  }
  if (req.task === "research") {
    const { system, user } = researchPrompt(req.input);
    return { input: [{ role: "system", content: system }, { role: "user", content: user }], json: true };
  }
  return { input: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...req.messages], json: false };
}

function friendly(e: unknown): { message: string; kind: string } {
  if (e instanceof GatewayError) {
    console.error("AI gateway error", e.code, e.httpStatus, e.ids);
    switch (e.name) {
      case "RateLimitError":
        return { message: "The AI is busy right now. Please wait a moment and try again.", kind: "rate_limit" };
      case "PaymentRequiredError":
        return { message: "AI credits have run out for this workspace. Top up credits to continue.", kind: "quota" };
      case "PermissionDeniedError":
        return { message: "The AI service refused this request.", kind: "auth" };
      case "TimeoutError":
      case "NetworkError":
        return { message: "The AI took too long to respond. Please try again.", kind: "network" };
    }
    return { message: "The AI couldn't complete this request. Please try again.", kind: "unknown" };
  }
  console.error("AI route error", e);
  return { message: "Something went wrong while generating. Please try again.", kind: "unknown" };
}

const line = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj) + "\n");

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request.", kind: "model" }, { status: 400 });
        }
        const parsed = aiRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "That request is too long or incomplete.", kind: "model" }, { status: 400 });
        }
        const { input, json } = buildInput(parsed.data);

        let stream;
        try {
          stream = await streamResponse(
            {
              model: MODEL,
              input,
              stream: true,
              ...(json ? { text: { format: { type: "json_object" as const } } } : {}),
            },
            { signal: request.signal },
          );
        } catch (e) {
          const f = friendly(e);
          const status = f.kind === "rate_limit" ? 429 : f.kind === "quota" ? 402 : 502;
          return Response.json({ error: f.message, kind: f.kind }, { status });
        }

        // Newline-delimited JSON: {"d": "text"} chunks, then {"done": true} or {"error": "..."}.
        const out = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const ev of stream) {
                const e = ev as { type?: string; delta?: unknown; refusal?: unknown };
                if (e.type === "response.output_text.delta" && typeof e.delta === "string") {
                  controller.enqueue(line({ d: e.delta }));
                } else if (e.type === "response.refusal.done" && typeof e.refusal === "string") {
                  controller.enqueue(line({ error: `The AI declined: ${e.refusal}`, kind: "refusal" }));
                }
              }
              controller.enqueue(line({ done: true }));
            } catch (e) {
              if (!request.signal.aborted) controller.enqueue(line({ error: friendly(e).message, kind: friendly(e).kind }));
            } finally {
              controller.close();
            }
          },
        });
        return new Response(out, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
