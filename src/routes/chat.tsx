import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, MessageSquarePlus, MessagesSquare, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/logo.png";
import { Disclaimer, PageHeader } from "@/components/app/notices";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { AIError, errorMessage, generate, type ChatTurn } from "@/lib/ai/client";
import { MAX_CHAT_TURNS } from "@/lib/ai/request";
import { copyText, logActivity, readLocal, writeLocal } from "@/lib/storage";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Workplace Chatbot · AI Workplace Productivity Assistant" },
      { name: "description", content: "Ask workplace, business and productivity questions and get context-aware AI answers." },
      { property: "og:title", content: "AI Workplace Chatbot" },
      { property: "og:description", content: "A context-aware assistant for workplace, business and productivity questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const CHAT_KEY = "wpa.chat";

const SUGGESTIONS = [
  "How do I prioritise when everything feels urgent?",
  "Give me an agenda template for a 30-minute weekly team sync.",
  "How should I give constructive feedback to an underperforming colleague?",
  "What are good OKRs for a small customer support team?",
];

type Status = "ready" | "submitted" | "streaming" | "error";

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setMessages(readLocal<ChatMessage[]>(CHAT_KEY, []));
    loaded.current = true;
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (loaded.current && status !== "streaming") writeLocal(CHAT_KEY, messages);
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const respond = async (history: ChatMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = crypto.randomUUID();
    setStatus("submitted");
    const turns: ChatTurn[] = history
      .filter((m) => !m.error)
      .slice(-MAX_CHAT_TURNS)
      .map(({ role, content }) => ({ role, content }));
    try {
      await generate({
        task: "chat",
        messages: turns,
        signal: controller.signal,
        onDelta: (_c, full) => {
          setStatus("streaming");
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === assistantId);
            return exists
              ? prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m))
              : [...prev, { id: assistantId, role: "assistant", content: full }];
          });
        },
      });
      setStatus("ready");
    } catch (e) {
      if (e instanceof AIError && e.kind === "aborted") {
        setStatus("ready");
      } else {
        setStatus("error");
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId || m.content),
          { id: crypto.randomUUID(), role: "assistant", content: errorMessage(e), error: true },
        ]);
      }
    } finally {
      abortRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const send = (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [
      ...messages.filter((m) => !m.error),
      { id: crypto.randomUUID(), role: "user", content },
    ];
    if (messages.length === 0) logActivity("chat", content);
    setMessages(next);
    setInput("");
    void respond(next);
  };

  const onSubmit = (msg: PromptInputMessage) => send(msg.text ?? input);

  const regenerate = () => {
    if (busy) return;
    const lastUser = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUser === -1) return;
    const history = messages.slice(0, lastUser + 1);
    setMessages(history);
    void respond(history);
  };

  const newConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStatus("ready");
    writeLocal(CHAT_KEY, []);
    textareaRef.current?.focus();
  };

  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <main className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <PageHeader
        icon={MessagesSquare}
        title="AI Workplace Chatbot"
        description="Ask about workplace, business and productivity. Pinnacle remembers this conversation for context."
        actions={
          <Button variant="outline" size="sm" onClick={newConversation} disabled={messages.length === 0}>
            <MessageSquarePlus /> New conversation
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <ConversationEmptyState className="py-10">
                <img src={logo} alt="" width={56} height={56} className="size-14 rounded-2xl shadow-glow" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">Hi, I'm Pinnacle</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Your workplace assistant for planning, communication, management and productivity.
                    Try one of these:
                  </p>
                </div>
                <div className="mt-2 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-background px-3.5 py-3 text-left text-sm text-foreground transition-all hover:border-brand/50 hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((m, i) => (
                <Message key={m.id} from={m.role} className="animate-fade-up">
                  {m.error ? (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span>{m.content}</span>
                    </div>
                  ) : (
                    <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-chat-user group-[.is-user]:text-chat-user-foreground">
                      {m.role === "assistant" ? (
                        <MessageResponse
                          isAnimating={status === "streaming" && i === messages.length - 1}
                          className="text-[0.925rem] leading-relaxed"
                        >
                          {m.content}
                        </MessageResponse>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </MessageContent>
                  )}
                  {m.role === "assistant" && !(busy && i === messages.length - 1) && (
                    <MessageActions>
                      {!m.error && <CopyAction text={m.content} />}
                      {i === Math.max(lastAssistantIdx, messages.length - 1) && (
                        <MessageAction tooltip="Regenerate" onClick={regenerate}>
                          <RefreshCw className="size-3.5" />
                        </MessageAction>
                      )}
                    </MessageActions>
                  )}
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer className="text-sm">Thinking…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border/60 bg-background/60 p-3 sm:p-4">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            <PromptInput onSubmit={onSubmit} className="rounded-2xl bg-surface shadow-soft">
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder="Ask a workplace question…"
              />
              <PromptInputFooter className="justify-between">
                <span className="pl-1 text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</span>
                <PromptInputSubmit
                  status={status === "error" ? "ready" : status}
                  onStop={() => abortRef.current?.abort()}
                  disabled={!busy && !input.trim()}
                  className="rounded-xl"
                />
              </PromptInputFooter>
            </PromptInput>
            <Disclaimer />
          </div>
        </div>
      </div>
    </main>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <MessageAction
      tooltip={copied ? "Copied" : "Copy"}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1400);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  );
}
