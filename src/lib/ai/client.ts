import { PROVIDERS, type AISettings } from "./settings";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  settings: AISettings;
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
  /** Ask the provider for a JSON object response where supported. */
  json?: boolean;
  /** Called with each new text chunk while streaming. */
  onDelta?: (chunk: string, full: string) => void;
}

export class AIError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "rate_limit" | "quota" | "network" | "model" | "aborted" | "empty" | "unknown",
  ) {
    super(message);
    this.name = "AIError";
  }
}

function friendlyStatus(status: number, detail: string, providerName: string): AIError {
  const d = detail ? ` (${detail})` : "";
  if (status === 401 || status === 403)
    return new AIError(
      `${providerName} rejected your API key. Check it in Settings${d}.`,
      "auth",
    );
  if (status === 429)
    return new AIError(
      `${providerName} rate limit or quota reached. Wait a moment or check your plan${d}.`,
      "rate_limit",
    );
  if (status === 402)
    return new AIError(`${providerName} reports insufficient credits${d}.`, "quota");
  if (status === 404)
    return new AIError(`Model not found on ${providerName}. Check the model name in Settings${d}.`, "model");
  if (status === 400)
    return new AIError(`${providerName} could not process the request${d}.`, "model");
  return new AIError(`${providerName} returned an error (${status})${d}.`, "unknown");
}

async function errorDetail(res: Response) {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      const msg = j?.error?.message ?? j?.error ?? j?.message;
      return typeof msg === "string" ? msg.slice(0, 220) : text.slice(0, 220);
    } catch {
      return text.slice(0, 220);
    }
  } catch {
    return "";
  }
}

/** Reads a Server-Sent Events body and yields each `data:` payload. */
async function* sseData(res: Response, signal?: AbortSignal) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    if (buffer.startsWith("data:")) yield buffer.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

function buildRequest(opts: GenerateOptions): { url: string; init: RequestInit; pick: (j: any) => string } {
  const { settings, system, messages, json } = opts;
  const model = settings.model.trim() || PROVIDERS[settings.provider].defaultModel;

  if (settings.provider === "openai" || settings.provider === "openrouter") {
    const url =
      settings.provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    };
    if (settings.provider === "openrouter") {
      headers["X-Title"] = "AI Workplace Productivity Assistant";
    }
    const body: Record<string, unknown> = {
      model,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    };
    if (json) body["response_format"] = { type: "json_object" };
    return {
      url,
      init: { method: "POST", headers, body: JSON.stringify(body) },
      pick: (j) => j?.choices?.[0]?.delta?.content ?? "",
    };
  }

  if (settings.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    };
    if (json) body["generationConfig"] = { responseMimeType: "application/json" };
    return {
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
        body: JSON.stringify(body),
      },
      pick: (j) =>
        (j?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? "")
          .join(""),
    };
  }

  // Anthropic
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system,
        messages,
      }),
    },
    pick: (j) => (j?.type === "content_block_delta" ? (j?.delta?.text ?? "") : ""),
  };
}

/**
 * Calls the configured AI provider directly from the browser and streams the reply.
 * Returns the full generated text.
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const providerName = PROVIDERS[opts.settings.provider].name;
  const { url, init, pick } = buildRequest(opts);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: opts.signal ?? null });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new AIError("Generation stopped.", "aborted");
    throw new AIError(
      `Couldn't reach ${providerName}. Check your internet connection, or the provider may block browser requests.`,
      "network",
    );
  }

  if (!res.ok) throw friendlyStatus(res.status, await errorDetail(res), providerName);
  if (!res.body) throw new AIError(`${providerName} returned an empty response.`, "empty");

  let full = "";
  try {
    for await (const data of sseData(res, opts.signal)) {
      if (!data || data === "[DONE]") continue;
      let j: any;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      if (j?.error) {
        throw new AIError(
          `${providerName}: ${typeof j.error === "string" ? j.error : (j.error.message ?? "stream error")}`,
          "unknown",
        );
      }
      const chunk = pick(j);
      if (chunk) {
        full += chunk;
        opts.onDelta?.(chunk, full);
      }
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    if ((e as Error)?.name === "AbortError") throw new AIError("Generation stopped.", "aborted");
    throw new AIError(`The connection to ${providerName} was interrupted.`, "network");
  }

  if (!full.trim()) throw new AIError(`${providerName} returned an empty response. Try again.`, "empty");
  return full;
}

export function errorMessage(e: unknown) {
  if (e instanceof AIError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
