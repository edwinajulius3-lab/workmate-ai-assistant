import { Link } from "@tanstack/react-router";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApiRequiredNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-center",
        className,
      )}
      role="status"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-warning">
        <KeyRound className="size-5" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground">AI connection required</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          This tool generates real AI responses, so it needs an API key from OpenAI, Google Gemini,
          Anthropic or OpenRouter. Nothing is simulated — without a key, generation is switched off.
        </p>
      </div>
      <Button asChild variant="brand">
        <Link to="/settings">Connect AI</Link>
      </Button>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm animate-fade-up"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="flex-1 text-foreground">{message}</p>
      {onRetry && (
        <Button size="xs" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs leading-relaxed text-muted-foreground", className)}>
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-deep" />
      <span>
        <strong className="font-semibold text-foreground">Responsible AI:</strong> AI-generated
        content can be inaccurate, incomplete or biased. Review, fact-check and edit before you rely
        on or send it. Avoid sharing confidential or personal data — your prompts go directly to
        the AI provider you connect.
      </span>
    </p>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Icon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-[1.75rem]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

export function LoadingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-brand animate-pulse-dot"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
