"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TbLoader } from "./TbLoader";

const SILENT_HEADER = "x-tb-loader";
const SHOW_DELAY_MS = 140;
const HIDE_DELAY_MS = 180;

let pending = 0;
const listeners = new Set<(count: number) => void>();
let installed = false;

function bump(delta: number) {
  pending = Math.max(0, pending + delta);
  listeners.forEach((fn) => fn(pending));
}

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === name);
    return hit?.[1] ?? null;
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key as keyof typeof headers]) : null;
}

function shouldTrack(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = readUrl(input);
  if (!url.includes("/api/")) return false;
  if (url.includes("global=1")) return false;
  if (headerValue(init?.headers, SILENT_HEADER) === "silent") return false;
  if (input instanceof Request && input.headers.get(SILENT_HEADER) === "silent") return false;
  return true;
}

function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const track = shouldTrack(input, init);
    if (track) bump(1);
    try {
      return original(input, init).finally(() => {
        if (track) bump(-1);
      });
    } catch (error) {
      if (track) bump(-1);
      throw error;
    }
  }) as typeof fetch;
}

export function RequestLoaderProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(pending);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    installFetchInterceptor();
    listeners.add(setCount);
    setCount(pending);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  useEffect(() => {
    if (count > 0) {
      const show = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => window.clearTimeout(show);
    }
    const hide = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => window.clearTimeout(hide);
  }, [count]);

  useEffect(() => {
    if (!visible) return;
    document.body.setAttribute("aria-busy", "true");
    return () => document.body.removeAttribute("aria-busy");
  }, [visible]);

  return (
    <>
      <div className="h-full" inert={visible}>
        {children}
      </div>
      {visible ? <TbLoader hint="Please wait" /> : null}
    </>
  );
}
