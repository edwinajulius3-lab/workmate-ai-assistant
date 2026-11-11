import { z } from "zod";

/** Max earlier turns the chatbot sends for context. */
export const MAX_CHAT_TURNS = 40;

const text = (max: number) => z.string().max(max);

/**
 * What the browser may ask the AI to do. The server builds the prompts from this,
 * so the browser can never send its own instructions.
 */
export const aiRequestSchema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("email"),
    input: z.object({
      instructions: text(4000).min(1),
      tone: z.enum(["formal", "friendly", "persuasive"]),
      length: z.enum(["short", "medium", "long"]),
      recipient: text(200).optional(),
      sender: text(200).optional(),
      context: text(4000).optional(),
    }),
  }),
  z.object({
    task: z.literal("research"),
    input: z.object({
      source: z.enum(["topic", "article", "url"]),
      content: text(80000).min(1),
      focus: text(500).optional(),
      url: text(2000).optional(),
    }),
  }),
  z.object({
    task: z.literal("chat"),
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: text(20000).min(1) }))
      .min(1)
      .max(MAX_CHAT_TURNS),
  }),
]);

export type AIRequest = z.infer<typeof aiRequestSchema>;
