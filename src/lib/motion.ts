"use client";

import { useSyncExternalStore } from "react";

/**
 * Telas pequenas ou ponteiro grosseiro (touch) — onde a GPU é fraca e efeitos
 * como backdrop-filter, animação de `width` e stagger longo derrubam frames.
 */
const LIGHT_QUERY = "(max-width: 1023px), (pointer: coarse)";

let mql: MediaQueryList | null = null;

function query(): MediaQueryList {
  mql ??= window.matchMedia(LIGHT_QUERY);
  return mql;
}

function subscribe(onChange: () => void) {
  const m = query();
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/**
 * `true` quando as animações devem rodar no modo leve: mais curtas, sem blur e
 * restritas a `opacity`/`transform`. As animações continuam existindo — só
 * param de custar repaint por frame.
 */
export function useLightMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query().matches,
    () => false,
  );
}

/** Escolhe entre o valor leve (mobile) e o completo (desktop). */
export function pick<T>(light: boolean, lightValue: T, fullValue: T): T {
  return light ? lightValue : fullValue;
}
