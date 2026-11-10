import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Check, Copy, Loader2, Mail, RefreshCw, Smile, Square, Target, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiRequiredNotice, Disclaimer, ErrorNotice, LoadingDots, PageHeader } from "@/components/app/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AIError, errorMessage, generate } from "@/lib/ai/client";
import { emailPrompt, parseEmail, type EmailLength, type EmailTone } from "@/lib/ai/prompts";
import { useAISettings } from "@/lib/ai/settings";
import { copyText, logActivity, readLocal, writeLocal } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator · AI Workplace Productivity Assistant" },
      { name: "description", content: "Turn quick instructions into formal, friendly or persuasive professional emails." },
      { property: "og:title", content: "Smart Email Generator" },
      { property: "og:description", content: "Personalised professional emails in Formal, Friendly or Persuasive tones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailPage,
});

const TONES: { id: EmailTone; label: string; icon: typeof Briefcase; hint: string }[] = [
  { id: "formal", label: "Formal", icon: Briefcase, hint: "Polished & precise" },
  { id: "friendly", label: "Friendly", icon: Smile, hint: "Warm & approachable" },
  { id: "persuasive", label: "Persuasive", icon: Target, hint: "Benefit-led & convincing" },
];

const LENGTHS: { id: EmailLength; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const EXAMPLES = [
  "Ask my manager for Friday off next week to attend a family event; I'll hand over the client report on Thursday.",
  "Follow up with a client who hasn't replied to our proposal sent two weeks ago.",
  "Pitch a 4-week pilot of our scheduling tool to the operations director at a logistics company.",
];

const DRAFT_KEY = "wpa.email-draft";

interface Draft {
  instructions: string;
  recipient: string;
  sender: string;
  context: string;
  tone: EmailTone;
  length: EmailLength;
  subject: string;
  body: string;
}

const EMPTY: Draft = {
  instructions: "",
  recipient: "",
  sender: "",
  context: "",
  tone: "formal",
  length: "medium",
  subject: "",
  body: "",
};

function EmailPage() {
  const settings = useAISettings();
  const [d, setD] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setD({ ...EMPTY, ...readLocal<Partial<Draft>>(DRAFT_KEY, {}) });
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current && !loading) writeLocal(DRAFT_KEY, d);
  }, [d, loading]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const run = async () => {
    if (!settings) return;
    if (d.instructions.trim().length < 8) {
      setError("Describe what the email should say (at least a sentence).");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setD((p) => ({ ...p, subject: "", body: "" }));
    const { system, user } = emailPrompt(d);
    try {
      const full = await generate({
        settings,
        system,
        messages: [{ role: "user", content: user }],
        signal: controller.signal,
        onDelta: (_c, text) => {
          const parsed = parseEmail(text);
          setD((p) => ({ ...p, subject: parsed.subject, body: parsed.body }));
        },
      });
      const parsed = parseEmail(full);
      setD((p) => ({ ...p, subject: parsed.subject, body: parsed.body }));
      logActivity("email", parsed.subject || d.instructions);
    } catch (e) {
      if (!(e instanceof AIError && e.kind === "aborted")) setError(errorMessage(e));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const onCopy = async () => {
    const text = d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body;
    if (await copyText(text)) {
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } else toast.error("Couldn't copy — select the text and copy manually.");
  };

  const hasOutput = Boolean(d.subject || d.body);
  const disabled = !settings;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8 animate-fade-up">
      <PageHeader
        icon={Mail}
        title="Smart Email Generator"
        description="Describe what you need and get a personalised, professional email you can edit, copy and send."
      />

      {settings === null && <ApiRequiredNotice />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className="h-fit border-border/60 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-base">Your instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="instructions">What should the email say?</Label>
              <Textarea
                id="instructions"
                rows={5}
                placeholder="e.g. Thank the team for hitting the Q3 target and invite them to a celebration lunch on Friday at 1pm."
                value={d.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                className="resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => set("instructions", ex)}
                    className="max-w-full truncate rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
                  >
                    {ex.slice(0, 42)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set("tone", t.id)}
                    aria-pressed={d.tone === t.id}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                      d.tone === t.id
                        ? "border-brand bg-brand-soft shadow-soft"
                        : "border-border bg-surface hover:border-brand/50",
                    )}
                  >
                    <t.icon className={cn("size-4", d.tone === t.id ? "text-brand-deep" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold text-foreground">{t.label}</span>
                    <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient</Label>
                <Input id="recipient" placeholder="e.g. Sarah, Head of Sales" value={d.recipient} onChange={(e) => set("recipient", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender">Your name</Label>
                <Input id="sender" placeholder="e.g. Edwina" value={d.sender} onChange={(e) => set("sender", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Extra context <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="context" placeholder="Relationship, deadlines, key facts…" value={d.context} onChange={(e) => set("context", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Length</Label>
              <div className="inline-flex rounded-lg bg-muted p-1">
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set("length", l.id)}
                    aria-pressed={d.length === l.id}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                      d.length === l.id ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Button variant="outline" size="lg" className="w-full" onClick={() => abortRef.current?.abort()}>
                <Square /> Stop generating
              </Button>
            ) : (
              <Button variant="brand" size="lg" className="w-full" onClick={run} disabled={disabled}>
                <Wand2 /> Generate email
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[520px] flex-col border-border/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
            <CardTitle className="font-display text-base">Draft</CardTitle>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={onCopy} disabled={!hasOutput || loading}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="soft" onClick={run} disabled={!hasOutput || loading || disabled}>
                <RefreshCw /> Regenerate
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear draft"
                onClick={() => setD((p) => ({ ...p, subject: "", body: "" }))}
                disabled={!hasOutput || loading}
              >
                <Trash2 />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {error && <ErrorNotice message={error} onRetry={settings ? run : undefined} />}
            {!hasOutput && !loading ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Mail className="size-5" />
                </div>
                <p className="mt-3 font-semibold text-foreground">Your email will appear here</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Everything generated is fully editable — tweak the wording before you copy it.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
                  <Input
                    id="subject"
                    value={d.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    readOnly={loading}
                    className="h-11 font-semibold"
                  />
                </div>
                <div className="flex flex-1 flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="body" className="text-xs uppercase tracking-wide text-muted-foreground">Body</Label>
                    {loading ? (
                      <LoadingDots label="Writing…" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{d.body.trim().split(/\s+/).filter(Boolean).length} words · editable</span>
                    )}
                  </div>
                  <Textarea
                    id="body"
                    value={d.body}
                    onChange={(e) => set("body", e.target.value)}
                    readOnly={loading}
                    className="min-h-[340px] flex-1 resize-y leading-relaxed"
                  />
                </div>
              </>
            )}
            {loading && !hasOutput && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-brand" /> Contacting AI…
              </div>
            )}
            <Disclaimer className="pt-2" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
