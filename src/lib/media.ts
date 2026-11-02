"use client";

import { useSyncExternalStore } from "react";

const cache = new Map<string, MediaQueryList>();

function mql(query: string): MediaQueryList {
  let list = cache.get(query);
  if (!list) {
    list = window.matchMedia(query);
    cache.set(query, list);
  }
  return list;
}

/** Media query reativa. No servidor (e na hidratação) devolve `serverValue`. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = mql(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => mql(query).matches,
    () => serverValue,
  );
}

/** Telas abaixo de `sm` (640px): sheets abrem de baixo e aceitam arrastar. */
export const PHONE_QUERY = "(max-width: 639px)";
