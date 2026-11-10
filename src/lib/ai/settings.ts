import { useSyncExternalStore } from "react";

export type ProviderId = "openai" | "gemini" | "anthropic" | "openrouter";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  defaultModel: string;
  modelHint: string;
  keyPlaceholder: string;
  keyUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    modelHint: "e.g. gpt-4.1-mini, gpt-4o",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    modelHint: "e.g. gemini-2.5-flash, gemini-2.5-pro",
    keyPlaceholder: "AIza...",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-5",
    modelHint: "e.g. claude-sonnet-4-5, claude-haiku-4-5",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-4.1-mini",
    modelHint: "e.g. openai/gpt-4.1-mini, anthropic/claude-sonnet-4.5",
    keyPlaceholder: "sk-or-v1-...",
    keyUrl: "https://openrouter.ai/keys",
  },
};

export interface AISettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** true = localStorage (survives browser restarts); false = sessionStorage (cleared when the tab closes). */
  remember: boolean;
}

const STORAGE_KEY = "wpa.ai-settings";
const EVENT = "wpa:ai-settings";

let cache: AISettings | null | undefined;

function read(): AISettings | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AISettings;
    if (!parsed.apiKey || !PROVIDERS[parsed.provider]) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSettings(): AISettings | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function saveSettings(settings: AISettings) {
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
  const store = settings.remember ? window.localStorage : window.sessionStorage;
  store.setItem(STORAGE_KEY, JSON.stringify(settings));
  cache = settings;
  window.dispatchEvent(new Event(EVENT));
}

export function clearSettings() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
  cache = null;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = read();
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns `undefined` before hydration, `null` when no key is configured. */
export function useAISettings(): AISettings | null | undefined {
  return useSyncExternalStore(subscribe, getSettings, () => undefined);
}

export function maskKey(key: string) {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
