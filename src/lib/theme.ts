"use client";

import { useSyncExternalStore } from "react";
import { THEME_COLORS, THEME_STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

const listeners = new Set<() => void>();
let preference: ThemePreference | null = null;
let wired = false;

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): Theme {
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function resolve(pref: ThemePreference): Theme {
  return pref === "system" ? systemTheme() : pref;
}

function syncThemeColor(pref: ThemePreference, theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (pref === "system") {
      const media = meta.getAttribute("media") ?? "";
      meta.content = media.includes("light") ? THEME_COLORS.light : media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS[theme];
    } else {
      meta.content = THEME_COLORS[theme];
    }
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Aplica o tema no <html>. A troca acontece de uma vez (sem transições de cor
 * elemento a elemento); onde houver View Transitions, com um crossfade curto.
 */
function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  const pref = getThemePreference();
  if (root.dataset.theme === theme) {
    syncThemeColor(pref, theme);
    return;
  }

  const commit = () => {
    root.dataset.theme = theme;
    syncThemeColor(pref, theme);
  };

  root.classList.add("theme-switching");
  const release = () => root.classList.remove("theme-switching");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (animate && !reduceMotion && typeof doc.startViewTransition === "function") {
    doc.startViewTransition(commit).finished.finally(release);
  } else {
    commit();
    requestAnimationFrame(() => requestAnimationFrame(release));
  }
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;

  window.matchMedia(LIGHT_QUERY).addEventListener("change", () => {
    if (getThemePreference() === "system") applyTheme(systemTheme(), true);
    emit();
  });

  // mantém abas abertas em sincronia
  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    preference = readPreference();
    applyTheme(resolve(preference), false);
    emit();
  });

  // o script inline pode ter rodado antes das <meta theme-color> existirem
  syncThemeColor(getThemePreference(), getResolvedTheme());
}

export function getThemePreference(): ThemePreference {
  if (preference === null) preference = readPreference();
  return preference;
}

export function getResolvedTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* modo privado sem storage: o tema vale só para esta sessão */
  }
  applyTheme(resolve(next), true);
  emit();
}

function subscribe(listener: () => void) {
  wire();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getThemePreference, () => "system" as ThemePreference);
  const resolved = useSyncExternalStore(subscribe, getResolvedTheme, () => "dark" as Theme);
  return { preference: pref, theme: resolved, setPreference: setThemePreference };
}

/* -------------------------------------------------------------------------- */

const noop = () => () => {};

/**
 * `false` no servidor e durante a hidratação; `true` depois. Use para conteúdo
 * que depende do relógio/fuso do usuário (saudação, data de hoje), que o
 * servidor — em outro fuso — renderizaria diferente.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
