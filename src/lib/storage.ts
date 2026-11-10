import { useEffect, useState } from "react";

/** JSON localStorage helpers. Reads only happen client-side (in effects/handlers). */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("wpa:storage", { detail: key }));
  } catch {
    /* storage full or disabled — ignore */
  }
}

export interface ActivityItem {
  id: string;
  kind: "email" | "research" | "chat";
  title: string;
  at: number;
}

export const ACTIVITY_KEY = "wpa.activity";

export function logActivity(kind: ActivityItem["kind"], title: string) {
  const items = readLocal<ActivityItem[]>(ACTIVITY_KEY, []);
  const next = [{ id: crypto.randomUUID(), kind, title: title.slice(0, 90), at: Date.now() }, ...items].slice(0, 12);
  writeLocal(ACTIVITY_KEY, next);
}

/** Subscribes to a localStorage key; returns fallback during SSR and first render. */
export function useLocalValue<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const load = () => setValue(readLocal(key, fallback));
    load();
    const onChange = (e: Event) => {
      const k = (e as CustomEvent).detail ?? (e as StorageEvent).key;
      if (k === key) load();
    };
    window.addEventListener("wpa:storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("wpa:storage", onChange);
      window.removeEventListener("storage", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
