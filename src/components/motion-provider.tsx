"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * O bloco `prefers-reduced-motion` do globals.css só afeta animações CSS — as do
 * framer-motion rodam em JS e passavam direto. `reducedMotion="user"` faz o
 * framer respeitar a preferência do sistema.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
