"use client";

import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  sublabel?: boolean;
}

export function AurumEmblem({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <linearGradient id="aurumEmblemBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#182210" />
          <stop offset="50%" stop-color="#0b1007" />
          <stop offset="100%" stop-color="#050704" />
        </linearGradient>
        <linearGradient id="aurumEmblemBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#b6f244" stop-opacity="0.85" />
          <stop offset="50%" stop-color="#eccb6b" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#b6f244" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="aurumEmblemGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dbfb73" />
          <stop offset="45%" stop-color="#b6f244" />
          <stop offset="85%" stop-color="#84c519" />
          <stop offset="100%" stop-color="#e8cd68" />
        </linearGradient>
        <linearGradient id="aurumEmblemLeaf" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7ebc16" />
          <stop offset="60%" stop-color="#b6f244" />
          <stop offset="100%" stop-color="#f5e28a" />
        </linearGradient>
        <filter id="aurumEmblemShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.5" />
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#b6f244" flood-opacity="0.35" />
        </filter>
      </defs>

      {/* Outer Rounded Container */}
      <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#aurumEmblemBg)" />
      <rect x="24" y="24" width="464" height="464" rx="112" fill="none" stroke="url(#aurumEmblemBorder)" stroke-width="12" />

      {/* Emblem Vectors */}
      <g filter="url(#aurumEmblemShadow)">
        <path
          d="M256 108 C256 108 368 236 368 324 C368 376 324 404 274 404 C236 404 204 384 192 352 C216 352 248 338 266 316 C288 290 292 254 284 224 L256 108 Z"
          fill="url(#aurumEmblemGold)"
        />
        <path
          d="M256 108 C256 108 144 236 144 324 C144 366 172 396 210 402 C196 376 196 342 208 314 C222 282 250 252 256 214 L256 108 Z"
          fill="url(#aurumEmblemLeaf)"
          opacity="0.95"
        />
        <path
          d="M256 180 C276 220 312 250 316 290 C320 326 296 354 262 354 C244 354 232 344 226 332 C220 318 222 298 232 278 C242 258 252 232 256 180 Z"
          fill="#dbfb73"
        />
        <polygon points="256,128 266,154 256,180 246,154" fill="#ffffff" opacity="0.95" />
      </g>
    </svg>
  );
}

export function AurumLogo({ size = 36, showText = true, sublabel = true, className = "" }: LogoProps) {
  if (!showText) {
    return <AurumEmblem size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <AurumEmblem size={size} />
      <div className="min-w-0">
        <h1 className="font-display text-[19px] font-bold leading-none tracking-tight text-cream">
          aurum<span className="text-accent">.</span>
        </h1>
        {sublabel && (
          <p className="mt-1 text-[10px] font-medium tracking-[0.2em] uppercase text-faint">
            finanças pessoais
          </p>
        )}
      </div>
    </div>
  );
}
