import type { AIRequest } from "./request";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type GenerateOptions = AIRequest & {
  signal?: AbortSignal;
  /** Called with each new text chunk while streaming. */
  onDelta?: (chunk: string, full: string) => void;
};

export class AIError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "rate_limit" | "quota" | "network" | "model" | "aborted" | "empty" | "refusal" | "unknown",
  ) {
    super(message);
    this.name = "AIError";
  }
}

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

/**
 * Asks the app's built-in AI (Lovable AI, run on the server) to perform a task and streams the reply.
 * Returns the full generated text.
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const { signal, onDelta, ...request } = opts;

  let res: Response;
  try {
    res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: signal ?? null,
    });
  } catch (e) {
    if (isAbort(e)) throw new AIError("Generation stopped.", "aborted");
    throw new AIError("Couldn't reach the AI. Check your internet connection and try again.", "network");
  }

  if (!res.ok) {
    let msg = `The AI returned an error (${res.status}). Please try again.`;
    let kind: AIError["kind"] = "unknown";
    try {
      const j = (await res.json()) as { error?: string; kind?: AIError["kind"] };
      if (j.error) msg = j.error;
      if (j.kind) kind = j.kind;
    } catch {
      /* keep defaults */
    }
    throw new AIError(msg, kind);
  }
  if (!res.body) throw new AIError("The AI returned an empty response.", "empty");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finished = false;

  const handle = (raw: string) => {
    if (!raw.trim()) return;
    let j: { d?: string; done?: boolean; error?: string; kind?: AIError["kind"] };
    try {
      j = JSON.parse(raw);
    } catch {
      return;
    }
    if (j.error) throw new AIError(j.error, j.kind ?? "unknown");
    if (j.done) finished = true;
    if (j.d) {
      full += j.d;
      onDelta?.(j.d, full);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        handle(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    }
    handle(buffer);
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (isAbort(e) || signal?.aborted) throw new AIError("Generation stopped.", "aborted");
    throw new AIError("The connection to the AI was interrupted.", "network");
  } finally {
    reader.releaseLock();
  }

  if (signal?.aborted) throw new AIError("Generation stopped.", "aborted");
  if (!finished && !full) throw new AIError("The connection to the AI was interrupted.", "network");
  if (!full.trim()) throw new AIError("The AI returned an empty response. Try again.", "empty");
  return full;
}

export function errorMessage(e: unknown) {
  if (e instanceof AIError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
