"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeclaredDetails, DocStatus, DocType, ExtractionMethod, OcrProviderName, ValidationResult } from "./types";

export interface Doc {
  id: string;
  customerId: string | null;
  declaredType: DocType | null;
  declared: DeclaredDetails;
  ocrProvider: OcrProviderName | null;
  validation: ValidationResult | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  docType: DocType;
  status: DocStatus;
  rawText: string | null;
  ocrConfidence: number | null;
  extractionMethod: ExtractionMethod | null;
  fields: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  total: number;
  byType: Partial<Record<DocType, number>>;
  byStatus: Partial<Record<DocStatus, number>>;
  aiEnabled: boolean;
  providers?: { textract: boolean; perfios: boolean };
}

export interface DocEvent {
  id: string;
  fromStatus: DocStatus | null;
  toStatus: DocStatus;
  action: string;
  actor: string;
  note: string | null;
  createdAt: string;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Fetch JSON, re-fetch when `url` changes, and keep polling while `poll(data)` is true. */
export function useFetch<T>(url: string | null, poll?: (data: T) => boolean) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [nonce, setNonce] = useState(0);
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const d = await api<T>(url);
      setData(d);
      setError(undefined);
      return d;
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = async () => {
      const d = await load();
      if (alive && d && pollRef.current?.(d)) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load, nonce]);

  /** Re-fetch and restart polling. */
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, refresh, setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function relativeTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
