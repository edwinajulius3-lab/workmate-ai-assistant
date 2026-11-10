import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock, KeyRound, Mail, MessagesSquare, ShieldCheck, Zap } from "lucide-react";

import { Disclaimer } from "@/components/app/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PROVIDERS, useAISettings } from "@/lib/ai/settings";
import { ACTIVITY_KEY, useLocalValue, type ActivityItem } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · AI Workplace Productivity Assistant" },
      {
        name: "description",
        content: "Your AI workspace for writing emails, researching topics and answering workplace questions.",
      },
      { property: "og:title", content: "AI Workplace Productivity Assistant" },
      {
        property: "og:description",
        content: "Smart emails, research briefings and a workplace chatbot powered by your own AI key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const TOOLS = [
  {
    to: "/email",
    title: "Smart Email Generator",
    description: "Turn quick notes into polished emails in Formal, Friendly or Persuasive tones.",
    icon: Mail,
    tag: "Write",
  },
  {
    to: "/research",
    title: "AI Research Assistant",
    description: "Summarise topics, articles or web pages into findings, insights and next steps.",
    icon: BookOpen,
    tag: "Analyse",
  },
  {
    to: "/chat",
    title: "Workplace Chatbot",
    description: "Ask anything about work, business or productivity and get context-aware answers.",
    icon: MessagesSquare,
    tag: "Ask",
  },
] as const;

const KIND_ICON = { email: Mail, research: BookOpen, chat: MessagesSquare } as const;
const KIND_LINK = { email: "/email", research: "/research", chat: "/chat" } as const;

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function Dashboard() {
  const settings = useAISettings();
  const activity = useLocalValue<ActivityItem[]>(ACTIVITY_KEY, []);
  const counts = {
    email: activity.filter((a) => a.kind === "email").length,
    research: activity.filter((a) => a.kind === "research").length,
    chat: activity.filter((a) => a.kind === "chat").length,
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-hero p-6 shadow-card sm:p-10 animate-fade-up">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="size-3.5" /> Your AI workspace
          </span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Get through your workday <span className="text-gradient-brand">faster</span>.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Draft emails, research anything and get answers to workplace questions — powered by the AI
            provider you connect.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="brand" size="lg">
              <Link to="/email">
                Write an email <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-surface">
              <Link to="/chat">Ask the chatbot</Link>
            </Button>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-brand/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full bg-brand-deep/10 blur-3xl" />
      </section>

      <ConnectionCard connected={settings} />

      <section className="grid gap-4 md:grid-cols-3">
        {TOOLS.map((t, i) => (
          <Link
            key={t.to}
            to={t.to}
            className="group animate-fade-up"
            style={{ animationDelay: `${0.05 + i * 0.06}s` }}
          >
            <Card className="h-full border-border/60 shadow-soft transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-card">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep transition-colors group-hover:bg-gradient-brand group-hover:text-brand-foreground">
                    <t.icon className="size-5" />
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t.tag}</span>
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">{t.title}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{t.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-deep">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Clock className="size-4 text-brand-deep" /> Recent activity
              </h2>
              <span className="text-xs text-muted-foreground">Saved in this browser</span>
            </div>
            {activity.length === 0 ? (
              <p className="mt-6 rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                Nothing yet. Your generated emails, briefings and chats will show up here.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border/70">
                {activity.slice(0, 6).map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <li key={a.id}>
                      <Link to={KIND_LINK[a.kind]} className="flex items-center gap-3 py-3 hover:text-brand-deep">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-deep">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-foreground">This browser</h2>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Emails", counts.email],
                  ["Briefings", counts.research],
                  ["Chats", counts.chat],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-xl bg-muted/70 p-3 text-center">
                  <p className="font-display text-2xl font-semibold text-foreground">{n}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4 text-brand-deep" /> Use AI responsibly
              </p>
              <Disclaimer className="mt-2 [&>svg]:hidden" />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function ConnectionCard({ connected }: { connected: ReturnType<typeof useAISettings> }) {
  if (connected === undefined) return <div className="h-[76px]" />;
  return (
    <Card
      className={cn(
        "border shadow-none animate-fade-up",
        connected ? "border-success/25 bg-success-soft" : "border-warning/30 bg-warning-soft",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface">
          <KeyRound className={cn("size-5", connected ? "text-success" : "text-warning")} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            {connected ? `AI connected · ${PROVIDERS[connected.provider].name}` : "Connect an AI provider to get started"}
          </p>
          <p className="text-sm text-muted-foreground">
            {connected
              ? `All assistants use ${connected.model}. Requests go straight from your browser to the provider.`
              : "Every assistant generates real AI responses, so an API key is required. Nothing is simulated."}
          </p>
        </div>
        <Button asChild variant={connected ? "outline" : "brand"} className={cn(connected && "bg-surface")}>
          <Link to="/settings">{connected ? "Manage" : "Add API key"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
