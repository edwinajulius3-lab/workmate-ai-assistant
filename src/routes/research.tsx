import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  Globe,
  Lightbulb,
  ListChecks,
  Pencil,
  RefreshCw,
  Rocket,
  Search,
  Square,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiRequiredNotice, Disclaimer, ErrorNotice, LoadingDots, PageHeader } from "@/components/app/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AIError, errorMessage, generate } from "@/lib/ai/client";
import {
  parseResearch,
  researchPrompt,
  researchToText,
  type ResearchResult,
  type ResearchSource,
} from "@/lib/ai/prompts";
import { useAISettings } from "@/lib/ai/settings";
import { fetchPageText } from "@/lib/fetch-url";
import { copyText, logActivity, readLocal, writeLocal } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "AI Research Assistant · AI Workplace Productivity Assistant" },
      { name: "description", content: "Summarise topics, articles and web pages into findings, insights and recommendations." },
      { property: "og:title", content: "AI Research Assistant" },
      { property: "og:description", content: "Turn topics, articles or URLs into decision-ready research briefings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResearchPage,
});

const SOURCES: { id: ResearchSource; label: string; icon: typeof Search }[] = [
  { id: "topic", label: "Topic", icon: Search },
  { id: "article", label: "Paste article", icon: FileText },
  { id: "url", label: "Website URL", icon: Globe },
];

const STATE_KEY = "wpa.research";

interface Saved {
  source: ResearchSource;
  topic: string;
  article: string;
  url: string;
  focus: string;
  result: ResearchResult | null;
}

const EMPTY: Saved = { source: "topic", topic: "", article: "", url: "", focus: "", result: null };

function ResearchPage() {
  const settings = useAISettings();
  const [s, setS] = useState<Saved>(EMPTY);
  const [phase, setPhase] = useState<"idle" | "fetching" | "thinking">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setS({ ...EMPTY, ...readLocal<Partial<Saved>>(STATE_KEY, {}) });
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current && phase === "idle") writeLocal(STATE_KEY, s);
  }, [s, phase]);

  const set = <K extends keyof Saved>(k: K, v: Saved[K]) => setS((p) => ({ ...p, [k]: v }));
  const loading = phase !== "idle";

  const run = async () => {
    if (!settings) return;
    setError(null);
    const raw = s.source === "topic" ? s.topic : s.source === "article" ? s.article : s.url;
    if (s.source === "topic" && raw.trim().length < 3) return setError("Enter a topic to research.");
    if (s.source === "article" && raw.trim().length < 200)
      return setError("Paste a longer article (at least a few paragraphs) for a meaningful summary.");
    if (s.source === "url" && !raw.trim()) return setError("Enter a website URL.");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let content = raw;
      if (s.source === "url") {
        setPhase("fetching");
        content = await fetchPageText(raw, controller.signal);
      }
      setPhase("thinking");
      const { system, user } = researchPrompt({ source: s.source, content, focus: s.focus, url: raw });
      const full = await generate({
        settings,
        system,
        messages: [{ role: "user", content: user }],
        json: true,
        signal: controller.signal,
      });
      const result = parseResearch(full);
      setS((p) => ({ ...p, result }));
      logActivity("research", result.title);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || (e instanceof AIError && e.kind === "aborted")) return;
      setError(errorMessage(e));
    } finally {
      setPhase("idle");
      abortRef.current = null;
    }
  };

  const update = (patch: Partial<ResearchResult>) =>
    setS((p) => (p.result ? { ...p, result: { ...p.result, ...patch } } : p));

  const copyAll = async () => {
    if (!s.result) return;
    if (await copyText(researchToText(s.result))) toast.success("Briefing copied to clipboard");
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8 animate-fade-up">
      <PageHeader
        icon={BookOpen}
        title="AI Research Assistant"
        description="Research a topic, summarise an article or read a web page — get a summary, key findings, insights and recommendations."
      />

      {settings === null && <ApiRequiredNotice />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <Card className="h-fit border-border/60 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-base">Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {SOURCES.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => set("source", src.id)}
                  aria-pressed={s.source === src.id}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:text-sm",
                    s.source === src.id ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <src.icon className="size-3.5" /> {src.label}
                </button>
              ))}
            </div>

            {s.source === "topic" && (
              <div className="space-y-2">
                <Label htmlFor="topic">Topic or question</Label>
                <Textarea
                  id="topic"
                  rows={4}
                  className="resize-none"
                  placeholder="e.g. Best practices for running effective hybrid team meetings"
                  value={s.topic}
                  onChange={(e) => set("topic", e.target.value)}
                />
              </div>
            )}
            {s.source === "article" && (
              <div className="space-y-2">
                <Label htmlFor="article">Article text</Label>
                <Textarea
                  id="article"
                  rows={10}
                  className="resize-y"
                  placeholder="Paste the full article, report or meeting notes here…"
                  value={s.article}
                  onChange={(e) => set("article", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{s.article.length.toLocaleString()} characters</p>
              </div>
            )}
            {s.source === "url" && (
              <div className="space-y-2">
                <Label htmlFor="url">Web page address</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={s.url}
                  onChange={(e) => set("url", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The page's text is read via the free Jina Reader service. Paywalled or login-only pages
                  won't work — paste the text instead.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="focus">Focus <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="focus"
                placeholder="e.g. implications for a 20-person marketing team"
                value={s.focus}
                onChange={(e) => set("focus", e.target.value)}
              />
            </div>

            {loading ? (
              <Button variant="outline" size="lg" className="w-full" onClick={() => abortRef.current?.abort()}>
                <Square /> Stop
              </Button>
            ) : (
              <Button variant="brand" size="lg" className="w-full" onClick={run} disabled={!settings}>
                <Wand2 /> Generate briefing
              </Button>
            )}
            <Disclaimer />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error && <ErrorNotice message={error} onRetry={settings ? run : undefined} />}

          {loading ? (
            <Card className="border-border/60 shadow-card">
              <CardContent className="space-y-5 p-6">
                <LoadingDots label={phase === "fetching" ? "Reading the web page…" : "Analysing and building your briefing…"} />
                <Skeleton className="h-7 w-2/3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                </div>
              </CardContent>
            </Card>
          ) : s.result ? (
            <ResultView result={s.result} onChange={update} onCopyAll={copyAll} onRegenerate={run} canRegenerate={!!settings} />
          ) : (
            <Card className="border-dashed border-border bg-muted/40 shadow-none">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <BookOpen className="size-5" />
                </div>
                <p className="mt-3 font-semibold text-foreground">Your research briefing will appear here</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Summary, key findings, insights and recommendations — every section is editable.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function ResultView({
  result,
  onChange,
  onCopyAll,
  onRegenerate,
  canRegenerate,
}: {
  result: ResearchResult;
  onChange: (p: Partial<ResearchResult>) => void;
  onCopyAll: () => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
}) {
  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="overflow-hidden border-border/60 bg-gradient-hero shadow-card">
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Input
              aria-label="Briefing title"
              value={result.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="h-auto border-transparent bg-transparent px-0 font-display text-xl font-semibold shadow-none focus-visible:border-input focus-visible:bg-surface focus-visible:px-2 md:text-xl"
            />
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="outline" onClick={onCopyAll}>
                <Copy /> Copy all
              </Button>
              <Button size="sm" variant="soft" onClick={onRegenerate} disabled={!canRegenerate}>
                <RefreshCw /> Regenerate
              </Button>
            </div>
          </div>
          <EditableSection
            label="Summary"
            icon={FileText}
            value={result.summary}
            onSave={(v) => onChange({ summary: v.trim() })}
            render={(v) => <p className="text-sm leading-relaxed text-foreground">{v}</p>}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard label="Key findings" icon={ListChecks} items={result.keyFindings} onSave={(v) => onChange({ keyFindings: v })} />
        <ListCard label="Insights" icon={Lightbulb} items={result.insights} onSave={(v) => onChange({ insights: v })} />
      </div>
      <ListCard
        label="Actionable recommendations"
        icon={Rocket}
        items={result.recommendations}
        onSave={(v) => onChange({ recommendations: v })}
        numbered
      />
    </div>
  );
}

function ListCard({
  label,
  icon,
  items,
  onSave,
  numbered,
}: {
  label: string;
  icon: typeof Search;
  items: string[];
  onSave: (items: string[]) => void;
  numbered?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-5">
        <EditableSection
          label={label}
          icon={icon}
          value={items.join("\n")}
          hint="One point per line"
          onSave={(v) => onSave(v.split("\n").map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean))}
          render={() => (
            <ul className="space-y-2.5">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      numbered ? "bg-gradient-brand text-brand-foreground" : "bg-brand-soft text-brand-deep",
                    )}
                  >
                    {numbered ? i + 1 : "•"}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        />
      </CardContent>
    </Card>
  );
}

function EditableSection({
  label,
  icon: Icon,
  value,
  onSave,
  render,
  hint,
}: {
  label: string;
  icon: typeof Search;
  value: string;
  onSave: (v: string) => void;
  render: (v: string) => React.ReactNode;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-brand-deep" /> {label}
        </h3>
        <div className="flex gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Copy ${label}`}
            onClick={async () => {
              if (await copyText(value)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit ${label}`}
            onClick={() => {
              setDraft(value);
              setEditing((e) => !e);
            }}
          >
            <Pencil />
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} autoFocus className="text-sm leading-relaxed" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{hint}</span>
            <div className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button
                size="xs"
                variant="brand"
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        render(value)
      )}
    </div>
  );
}
