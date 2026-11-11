/** Structured prompts for every assistant. Kept in one place so behaviour is consistent. */

export type EmailTone = "formal" | "friendly" | "persuasive";
export type EmailLength = "short" | "medium" | "long";

export const TONE_GUIDE: Record<EmailTone, string> = {
  formal:
    "Formal: polished, respectful and precise. Use complete sentences, no slang or emojis, a courteous greeting and a professional sign-off.",
  friendly:
    "Friendly: warm, approachable and conversational while still professional. Light, positive phrasing; contractions are fine; no emojis unless asked.",
  persuasive:
    "Persuasive: confident and benefit-led. Open with a hook relevant to the recipient, support the request with clear reasons or evidence, address likely objections, and end with one specific call to action.",
};

const LENGTH_GUIDE: Record<EmailLength, string> = {
  short: "60-110 words in the body",
  medium: "120-200 words in the body",
  long: "220-350 words in the body",
};

export interface EmailInput {
  instructions: string;
  tone: EmailTone;
  length: EmailLength;
  recipient?: string | undefined;
  sender?: string | undefined;
  context?: string | undefined;
}

export function emailPrompt(input: EmailInput) {
  const system = [
    "You are an expert business communication writer who drafts clear, personalised workplace emails.",
    "",
    "RULES:",
    `- Tone: ${TONE_GUIDE[input.tone]}`,
    `- Length: ${LENGTH_GUIDE[input.length]}.`,
    "- Personalise using every detail the user gives (names, dates, numbers, context). Never invent facts, figures, dates or commitments the user did not provide; use clear placeholders in square brackets like [date] when a needed detail is missing.",
    "- Structure: greeting, purpose in the first 1-2 sentences, supporting details in short paragraphs, a clear next step, sign-off.",
    "- Plain text only. No markdown, no bold, no bullet symbols unless a list genuinely helps.",
    "",
    "OUTPUT FORMAT (exactly):",
    "Subject: <concise subject line>",
    "",
    "<email body including greeting and sign-off>",
  ].join("\n");

  const user = [
    `What the email should achieve: ${input.instructions.trim()}`,
    input.recipient?.trim() ? `Recipient: ${input.recipient.trim()}` : "Recipient: not specified (use a neutral greeting)",
    input.sender?.trim() ? `Sender (sign-off name): ${input.sender.trim()}` : "Sender: not specified (use [Your name])",
    input.context?.trim() ? `Extra context: ${input.context.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

/** Splits a "Subject: ..." first line from the email body. Works on partial (streaming) text. */
export function parseEmail(text: string): { subject: string; body: string } {
  const trimmed = text.replace(/^\s+/, "");
  const match = trimmed.match(/^\**subject\**\s*:\s*(.*)(?:\r?\n|$)/i);
  if (!match) return { subject: "", body: trimmed };
  const subject = (match[1] ?? "").replace(/\*+$/, "").trim();
  const body = trimmed.slice(match[0].length).replace(/^\s*\n/, "");
  return { subject, body };
}

export type ResearchSource = "topic" | "article" | "url";

export interface ResearchInput {
  source: ResearchSource;
  content: string;
  focus?: string | undefined;
  url?: string | undefined;
}

export interface ResearchResult {
  title: string;
  summary: string;
  keyFindings: string[];
  insights: string[];
  recommendations: string[];
}

export function researchPrompt(input: ResearchInput) {
  const system = [
    "You are a meticulous workplace research analyst. You turn topics and source material into decision-ready briefings for busy professionals.",
    "",
    "RULES:",
    input.source === "topic"
      ? "- The user gave a topic, not a source. Draw on well-established general knowledge. Do not fabricate statistics, quotes or citations; when a point is uncertain or time-sensitive, say so explicitly."
      : "- Base everything strictly on the provided source text. Do not add facts that are not in the source. If the source is thin, say so in the summary.",
    "- Be specific and concrete. Avoid filler and generic advice.",
    "- keyFindings: 4-6 factual points (what the material says).",
    "- insights: 3-5 analytical points (what it means, implications, patterns, risks, tensions).",
    "- recommendations: 3-5 actionable next steps, each starting with a verb, practical for a workplace team.",
    input.focus?.trim() ? `- Prioritise this angle requested by the user: ${input.focus.trim()}` : "",
    "",
    "Respond with ONLY a JSON object, no prose before or after, matching:",
    '{"title": string, "summary": string (3-5 sentences), "keyFindings": string[], "insights": string[], "recommendations": string[]}',
  ]
    .filter(Boolean)
    .join("\n");

  const label =
    input.source === "topic"
      ? "TOPIC"
      : input.source === "url"
        ? `WEB PAGE CONTENT (from ${input.url})`
        : "ARTICLE TEXT";
  const user = `${label}:\n"""\n${input.content.trim().slice(0, 60000)}\n"""`;
  return { system, user };
}

/** Extracts and validates the JSON research object from a model reply. */
export function parseResearch(text: string): ResearchResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The AI response was not in the expected format. Try regenerating.");
  let obj: { title?: unknown; summary?: unknown; keyFindings?: unknown; insights?: unknown; recommendations?: unknown };
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("The AI response was not in the expected format. Try regenerating.");
  }
  const list = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  const result: ResearchResult = {
    title: typeof obj.title === "string" ? obj.title.trim() : "Research briefing",
    summary: typeof obj.summary === "string" ? obj.summary.trim() : "",
    keyFindings: list(obj.keyFindings),
    insights: list(obj.insights),
    recommendations: list(obj.recommendations),
  };
  if (!result.summary && result.keyFindings.length === 0)
    throw new Error("The AI response was empty. Try regenerating.");
  return result;
}

export function researchToText(r: ResearchResult) {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((i) => `• ${i}`).join("\n")}` : "";
  return [
    r.title,
    "",
    "Summary",
    r.summary,
    "",
    section("Key findings", r.keyFindings),
    "",
    section("Insights", r.insights),
    "",
    section("Recommendations", r.recommendations),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const CHAT_SYSTEM_PROMPT = [
  "You are Pinnacle, an AI workplace productivity assistant inside the 'AI Workplace Productivity Assistant' app.",
  "You help professionals with workplace, business, management, career, communication and productivity questions.",
  "",
  "HOW TO ANSWER:",
  "- Use the full conversation history for context; refer back to earlier details instead of asking again.",
  "- Lead with the direct answer, then supporting detail. Prefer short paragraphs, bullet lists and numbered steps.",
  "- Make advice practical: concrete steps, templates, frameworks (e.g. Eisenhower matrix, SMART goals, RACI) when they genuinely help.",
  "- If a question is ambiguous, state your assumption briefly or ask one focused clarifying question.",
  "- Be honest about uncertainty. Never invent statistics, laws or sources. For legal, medical, financial or HR-sensitive matters, give general guidance and recommend a qualified professional or the relevant policy.",
  "- If asked something unrelated to work, answer briefly and helpfully.",
  "- Format with Markdown.",
].join("\n");
