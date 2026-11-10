import { describe, expect, it } from "vitest";

import { emailPrompt, parseEmail, parseResearch } from "@/lib/ai/prompts";

describe("email output parsing", () => {
  it("splits the subject line from the body", () => {
    const r = parseEmail("Subject: Friday leave request\n\nHi Sarah,\n\nCould I take Friday off?");
    expect(r.subject).toBe("Friday leave request");
    expect(r.body).toBe("Hi Sarah,\n\nCould I take Friday off?");
  });

  it("keeps everything as body when no subject is given", () => {
    expect(parseEmail("Hi team,").subject).toBe("");
  });

  it("includes the chosen tone in the instructions", () => {
    const { system } = emailPrompt({ instructions: "Ask for budget", tone: "persuasive", length: "short" });
    expect(system).toContain("Persuasive");
  });
});

describe("research output parsing", () => {
  it("reads JSON even when wrapped in a code fence", () => {
    const r = parseResearch(
      '```json\n{"title":"T","summary":"S","keyFindings":["a"],"insights":["b"],"recommendations":["c"]}\n```',
    );
    expect(r.keyFindings).toEqual(["a"]);
    expect(r.recommendations).toEqual(["c"]);
  });

  it("rejects non-JSON replies instead of showing fake content", () => {
    expect(() => parseResearch("Sorry, I can't help")).toThrow();
  });
});
