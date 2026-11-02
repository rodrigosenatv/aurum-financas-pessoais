"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { fmt, fmtAxis } from "@/lib/format";
import { useLightMotion } from "@/lib/motion";

/* Cores dos gráficos vêm dos tokens CSS (globals.css), então acompanham o tema
   sem re-render. Atributos SVG aceitam var() nos navegadores atuais. */
const C = {
  income: "var(--accent)",
  expense: "var(--negative)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  base: "var(--line-strong)",
  track: "var(--track)",
  surface: "var(--surface)",
  fg: "var(--fg)",
} as const;

/* ------------------------------------------------------------------------ */
/* hooks                                                                     */
/* ------------------------------------------------------------------------ */

export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        const r = entry.contentRect;
        setSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
      });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, []);
  return [ref, size] as const;
}

const COUNT_SPRING = { stiffness: 46, damping: 15, mass: 0.9 };
const COUNT_SPRING_LIGHT = { stiffness: 140, damping: 22, mass: 0.6 };

export const Money = memo(function Money({
  cents,
  withCents = false,
  className,
}: {
  cents: number;
  withCents?: boolean;
  className?: string;
}) {
  const light = useLightMotion();
  const spring = useSpring(0, light ? COUNT_SPRING_LIGHT : COUNT_SPRING);
  useEffect(() => {
    spring.set(cents);
  }, [cents, spring]);
  const text = useTransform(spring, (v) => fmt(Math.round(v), withCents));
  return (
    <>
      {/* leitores de tela recebem o valor final, não cada quadro da contagem */}
      <span className="sr-only">{fmt(cents, withCents)}</span>
      <motion.span aria-hidden className={`num-anim ${className ?? ""}`}>
        {text}
      </motion.span>
    </>
  );
});

export const Percent = memo(function Percent({ value, className }: { value: number; className?: string }) {
  const light = useLightMotion();
  const spring = useSpring(0, light ? COUNT_SPRING_LIGHT : COUNT_SPRING);
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, (v) => `${Math.round(v)}%`);
  return (
    <>
      <span className="sr-only">{`${Math.round(value)}%`}</span>
      <motion.span aria-hidden className={`num-anim ${className ?? ""}`}>
        {text}
      </motion.span>
    </>
  );
});

/* ------------------------------------------------------------------------ */
/* path helpers                                                              */
/* ------------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/* ------------------------------------------------------------------------ */
/* cash-flow area chart                                                      */
/* ------------------------------------------------------------------------ */

export interface FlowPoint {
  label: string;
  income: number;
  expense: number;
}

const EASE = [0.65, 0, 0.35, 1] as const;

/**
 * Gráfico de área receitas × despesas. Com `fill`, ocupa a altura disponível
 * do card (respeitando um mínimo); sem ele, a altura acompanha a largura.
 */
export const FlowChart = memo(function FlowChart({
  data,
  height = 300,
  seriesKey,
  fill = false,
}: {
  data: FlowPoint[];
  height?: number;
  seriesKey: string;
  fill?: boolean;
}) {
  const [ref, size] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const light = useLightMotion();
  const uid = useId().replace(/:/g, "");

  const width = size.width;
  const w = Math.max(width, 10);
  const auto = w < 420 ? 210 : w < 768 ? 240 : height;
  const h = fill ? Math.max(size.height, 200) : auto;
  const pad = {
    l: w < 420 ? 34 : 46,
    r: 14,
    t: 20,
    b: 30,
  };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const max = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 100) * 1.18;

  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const incomePts = data.map((d, i) => ({ x: x(i), y: y(d.income) }));
  const expensePts = data.map((d, i) => ({ x: x(i), y: y(d.expense) }));
  const base = y(0);

  const incomeLine = smoothPath(incomePts);
  const expenseLine = smoothPath(expensePts);
  const incomeArea = `${incomeLine} L ${x(data.length - 1)} ${base} L ${x(0)} ${base} Z`;
  const expenseArea = `${expenseLine} L ${x(data.length - 1)} ${base} L ${x(0)} ${base} Z`;

  const grid = [1, 0.75, 0.5, 0.25].map((f) => max * f);

  const indexAt = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const t = (clientX - rect.left - pad.l) / innerW;
    return Math.max(0, Math.min(data.length - 1, Math.round(t * (data.length - 1))));
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (data.length === 0 || innerW <= 0) return;
    setHover(indexAt(e.clientX, e.currentTarget.ownerSVGElement as SVGSVGElement));
  };

  const onTouch = (e: React.TouchEvent<SVGRectElement>) => {
    if (data.length === 0 || innerW <= 0 || !e.touches[0]) return;
    setHover(indexAt(e.touches[0].clientX, e.currentTarget.ownerSVGElement as SVGSVGElement));
  };

  const hovered = hover !== null ? data[hover] : null;

  const tooltipWidth = Math.min(168, Math.max(136, w * 0.5));
  let tooltipLeft = 0;
  if (hover !== null) {
    const rawLeft = x(hover) > w * 0.6 ? x(hover) - tooltipWidth - 14 : x(hover) + 14;
    tooltipLeft = Math.max(8, Math.min(w - tooltipWidth - 8, rawLeft));
  }

  const gIncome = `${uid}-in`;
  const gExpense = `${uid}-ex`;

  const total = data.reduce((s, d) => s + d.income - d.expense, 0);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Receitas e despesas dos últimos ${data.length} meses. Saldo acumulado no período: ${fmt(total)}.`}
      className={fill ? "relative min-h-[210px] w-full flex-1 sm:min-h-[250px]" : "relative w-full"}
      style={fill ? undefined : { height: h }}
    >
      {width > 40 && (
        <svg width={w} height={h} className={`block overflow-visible ${fill ? "absolute inset-0" : ""}`}>
          <defs>
            <linearGradient id={gIncome} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.income} stopOpacity="0.26" />
              <stop offset="100%" stopColor={C.income} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={gExpense} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.expense} stopOpacity="0.18" />
              <stop offset="100%" stopColor={C.expense} stopOpacity="0" />
            </linearGradient>
          </defs>

          {grid.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={C.grid} strokeDasharray="3 5" />
              <text
                x={pad.l - (w < 420 ? 6 : 10)}
                y={y(v) + 3}
                textAnchor="end"
                fontSize={w < 420 ? "10" : "10.5"}
                fill={C.axis}
                fontFamily="var(--font-grotesk)"
              >
                {fmtAxis(v)}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={w - pad.r} y1={base} y2={base} stroke={C.base} />

          <motion.path
            key={`a-e-${seriesKey}`}
            d={expenseArea}
            fill={`url(#${gExpense})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: light ? 0.45 : 1, delay: light ? 0.22 : 0.5 }}
          />
          <motion.path
            key={`a-i-${seriesKey}`}
            d={incomeArea}
            fill={`url(#${gIncome})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: light ? 0.45 : 1, delay: light ? 0.16 : 0.35 }}
          />

          <motion.path
            key={`l-e-${seriesKey}`}
            d={expenseLine}
            fill="none"
            stroke={C.expense}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: light ? 0.6 : 1.3, ease: EASE }}
          />
          <motion.path
            key={`l-i-${seriesKey}`}
            d={incomeLine}
            fill="none"
            stroke={C.income}
            strokeWidth={2.4}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: light ? 0.6 : 1.3, ease: EASE, delay: light ? 0.06 : 0.12 }}
          />

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t - 6} y2={base} stroke={C.base} strokeDasharray="2 4" />
              <circle cx={x(hover)} cy={y(data[hover].income)} r={5} fill={C.surface} stroke={C.income} strokeWidth={2.4} />
              <circle cx={x(hover)} cy={y(data[hover].expense)} r={5} fill={C.surface} stroke={C.expense} strokeWidth={2.4} />
            </g>
          )}

          {data.map((d, i) => {
            const skip = w < 250 && data.length > 4 && i % 2 !== 0 && hover !== i;
            if (skip) return null;
            return (
              <text
                key={d.label + i}
                x={x(i)}
                y={h - 8}
                textAnchor="middle"
                fontSize={w < 380 ? "10" : "11"}
                fontWeight={hover === i ? 600 : 400}
                fill={hover === i ? C.fg : C.axis}
                fontFamily="var(--font-grotesk)"
                style={{ textTransform: "capitalize" }}
              >
                {d.label}
              </text>
            );
          })}

          <rect
            x={pad.l}
            y={pad.t - 10}
            width={Math.max(0, innerW)}
            height={Math.max(0, innerH + 12)}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onTouchStart={onTouch}
            onTouchMove={onTouch}
            onTouchEnd={() => setHover(null)}
          />
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-1/2 rounded-xl border border-line-strong bg-surface/95 px-3 py-2 shadow-pop sm:px-3.5 sm:py-2.5 lg:backdrop-blur-md"
          style={{
            top: Math.max(54, y(Math.max(hovered.income, hovered.expense))),
            left: tooltipLeft,
            width: tooltipWidth,
          }}
        >
          <p className="mb-1 font-display text-[12px] font-semibold tracking-wide text-fg capitalize">{hovered.label}</p>
          <div className="space-y-1 text-[11.5px]">
            <p className="flex items-center justify-between gap-2 sm:gap-3">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <i className="h-1.5 w-1.5 rounded-full bg-accent" /> Receitas
              </span>
              <span className="font-display font-medium text-fg">{fmt(hovered.income)}</span>
            </p>
            <p className="flex items-center justify-between gap-2 sm:gap-3">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <i className="h-1.5 w-1.5 rounded-full bg-negative" /> Despesas
              </span>
              <span className="font-display font-medium text-fg">{fmt(hovered.expense)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-1 sm:gap-3">
              <span className="text-fg-muted">Balanço</span>
              <span
                className={`font-display font-semibold ${
                  hovered.income - hovered.expense >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {fmt(hovered.income - hovered.expense)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------------ */
/* donut                                                                     */
/* ------------------------------------------------------------------------ */

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export const Donut = memo(function Donut({
  slices,
  total,
  active,
  onActive,
  size = 208,
}: {
  slices: DonutSlice[];
  total: number;
  active: string | null;
  onActive: (id: string | null) => void;
  size?: number;
}) {
  const stroke = 24;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  const gapAngle = slices.length > 1 ? 3 : 0;

  const activeSlice = slices.find((s) => s.id === active) ?? null;

  return (
    <div className="relative grid aspect-square w-full shrink-0 place-items-center" style={{ maxWidth: size, maxHeight: size }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" className="-rotate-90" aria-hidden>
        <circle cx={100} cy={100} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        {slices.map((s, index) => {
          const frac = total > 0 ? s.value / total : 0;
          const angle = frac * 360;
          const len = (Math.max(0, angle - gapAngle) / 360) * circumference;
          const dash = `${len} ${circumference - len}`;
          const acc = slices
            .slice(0, index)
            .reduce((sum, previous) => sum + (total > 0 ? previous.value / total : 0) * 360, 0);
          const offset = (acc / 360) * circumference;
          const isActive = active === s.id;
          return (
            <motion.circle
              key={s.id}
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={s.color}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              // strokeWidth precisa estar no `initial`: sem origem resolvida o
              // framer avisa "undefined is not animatable" e ainda assim escreve
              // o atributo a cada frame, uma vez por fatia do donut.
              initial={{ opacity: 0, strokeWidth: stroke }}
              animate={{
                opacity: active && !isActive ? 0.25 : 1,
                strokeWidth: isActive ? 31 : stroke,
              }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              onMouseEnter={() => onActive(s.id)}
              onMouseLeave={() => onActive(null)}
              onClick={() => onActive(isActive ? null : s.id)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div className="max-w-[70%] px-2">
          <p className="eyebrow mb-1 truncate">{activeSlice ? activeSlice.label : "despesas"}</p>
          <p className="font-display text-[clamp(1.05rem,4.6vw,1.625rem)] font-semibold leading-none tracking-tight text-fg">
            {fmt(activeSlice ? activeSlice.value : total)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-fg-subtle">
            {activeSlice && total > 0 ? `${Math.round((activeSlice.value / total) * 100)}% do mês` : "no mês"}
          </p>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------------ */
/* progress ring                                                             */
/* ------------------------------------------------------------------------ */

export const ProgressRing = memo(function ProgressRing({
  value,
  size = 76,
  stroke = 7,
  color = C.income,
  delay = 0,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  delay?: number;
}) {
  const light = useLightMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        transition={{ duration: light ? 0.55 : 1.1, ease: EASE, delay }}
      />
    </svg>
  );
});

/* ------------------------------------------------------------------------ */
/* sparkline                                                                 */
/* ------------------------------------------------------------------------ */

export const Sparkline = memo(function Sparkline({
  values,
  color = C.income,
  height = 44,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const [ref, { width }] = useMeasure();
  const light = useLightMotion();
  const gradient = `${useId().replace(/:/g, "")}-spark`;
  const path = useMemo(() => {
    if (values.length < 2 || width < 20) return { line: "", area: "" };
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => ({
      x: (i / (values.length - 1)) * width,
      y: height - 4 - ((v - min) / span) * (height - 10),
    }));
    const line = smoothPath(pts);
    return { line, area: `${line} L ${width} ${height} L 0 ${height} Z` };
  }, [values, width, height]);

  return (
    <div ref={ref} className="w-full" style={{ height }} aria-hidden>
      {width > 20 && (
        <svg width={width} height={height} className="block">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={path.area}
            fill={`url(#${gradient})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: light ? 0.4 : 0.9, delay: light ? 0.2 : 0.5 }}
          />
          <motion.path
            d={path.line}
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: light ? 0.55 : 1.2, ease: EASE, delay: light ? 0.1 : 0.2 }}
          />
        </svg>
      )}
    </div>
  );
});
