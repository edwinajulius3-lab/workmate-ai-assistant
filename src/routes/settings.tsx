import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Disclaimer, ErrorNotice, PageHeader } from "@/components/app/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorMessage, generate } from "@/lib/ai/client";
import {
  PROVIDERS,
  clearSettings,
  maskKey,
  saveSettings,
  useAISettings,
  type AISettings,
  type ProviderId,
} from "@/lib/ai/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "AI Settings · AI Workplace Productivity Assistant" },
      { name: "description", content: "Connect your own OpenAI, Gemini, Claude or OpenRouter API key." },
      { property: "og:title", content: "AI Settings · AI Workplace Productivity Assistant" },
      { property: "og:description", content: "Connect your own AI provider key to power every assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const current = useAISettings();
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(PROVIDERS.openai.defaultModel);
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current) {
      setProvider(current.provider);
      setModel(current.model);
      setRemember(current.remember);
    }
  }, [current]);

  const pickProvider = (id: ProviderId) => {
    setProvider(id);
    setModel(PROVIDERS[id].defaultModel);
    setError(null);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim() || (current?.provider === provider ? current.apiKey : "");
    if (!key) {
      setError("Enter your API key.");
      return;
    }
    const next: AISettings = { provider, apiKey: key, model: model.trim() || PROVIDERS[provider].defaultModel, remember };
    setTesting(true);
    setError(null);
    try {
      // Verify the key with a tiny real request before saving.
      await generate({
        settings: next,
        system: "Reply with the single word: OK",
        messages: [{ role: "user", content: "Connection test" }],
      });
      saveSettings(next);
      setApiKey("");
      toast.success(`Connected to ${PROVIDERS[provider].name}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const info = PROVIDERS[provider];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8 animate-fade-up">
      <PageHeader
        icon={KeyRound}
        title="AI Settings"
        description="Connect your own AI provider. Requests go straight from your browser to the provider — this app has no server and never sees your key."
      />

      {current && (
        <Card className="border-success/30 bg-success-soft shadow-none">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <CheckCircle2 className="size-5 text-success" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">
                Connected to {PROVIDERS[current.provider].name} · {current.model}
              </p>
              <p className="text-muted-foreground">
                Key {maskKey(current.apiKey)} ·{" "}
                {current.remember ? "remembered on this device" : "cleared when you close this tab"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearSettings();
                toast("API key removed");
              }}
            >
              <Trash2 /> Remove key
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">{current ? "Change connection" : "Connect a provider"}</CardTitle>
          <CardDescription>Choose a provider, paste your key and pick a model.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickProvider(id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all",
                    provider === id
                      ? "border-brand bg-brand-soft text-accent-foreground shadow-soft"
                      : "border-border bg-surface text-foreground hover:border-brand/50",
                  )}
                  aria-pressed={provider === id}
                >
                  {PROVIDERS[id].name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="api-key">{info.name} API key</Label>
                <a
                  href={info.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-deep hover:underline"
                >
                  Get a key <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="relative">
                <Input
                  id="api-key"
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    current?.provider === provider ? `Saved: ${maskKey(current.apiKey)} — paste to replace` : info.keyPlaceholder
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-11 pr-11 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide key" : "Show key"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} className="h-11" />
              <p className="text-xs text-muted-foreground">{info.modelHint}. Use any model your key has access to.</p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl bg-muted p-4">
              <div>
                <Label htmlFor="remember" className="font-semibold">Remember on this device</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Off: the key is kept only for this browser tab and cleared when you close it. On: it's
                  stored in this browser until you remove it. Don't enable on shared computers.
                </p>
              </div>
              <Switch id="remember" checked={remember} onCheckedChange={setRemember} />
            </div>

            {error && <ErrorNotice message={error} />}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="brand" size="lg" disabled={testing}>
                {testing ? <Loader2 className="animate-spin" /> : <Lock />}
                {testing ? "Testing connection…" : "Test & save"}
              </Button>
              <p className="text-xs text-muted-foreground">We send one tiny test request to confirm the key works.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">About browser API keys</p>
          <p>
            Your key lives only in this browser's storage and is sent only to {info.name}. Anyone with
            access to this browser profile could read it, so use a key with a spending limit and
            revoke it if you stop using the app.
          </p>
          <Disclaimer />
        </CardContent>
      </Card>
    </main>
  );
}
