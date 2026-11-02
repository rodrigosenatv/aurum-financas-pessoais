import { memo, type CSSProperties } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CarFront,
  Coins,
  CreditCard,
  Fuel,
  Gamepad2,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Laptop,
  PiggyBank,
  Plane,
  ReceiptText,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Utensils,
  CarFront,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  ShoppingBag,
  Repeat,
  ReceiptText,
  BriefcaseBusiness,
  Laptop,
  TrendingUp,
  ShieldCheck,
  Plane,
  Wallet,
  Target,
  CreditCard,
  PiggyBank,
  Coins,
  Heart,
  Activity,
  Fuel,
  Smartphone,
  Sparkles,
};

export const CategoryIcon = memo(function CategoryIcon({
  icon,
  color,
  size = 17,
  chip = 38,
  radius = 12,
}: {
  icon: string;
  color: string;
  size?: number;
  chip?: number;
  radius?: number;
}) {
  const Icon = ICON_MAP[icon] ?? Wallet;
  return (
    <span
      aria-hidden
      // `cat-fg` escurece a cor da categoria no tema claro para manter o contraste
      className="cat-fg grid shrink-0 place-items-center"
      style={
        {
          "--cat": color,
          width: chip,
          height: chip,
          borderRadius: radius,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`,
        } as CSSProperties
      }
    >
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
});

export const BareIcon = memo(function BareIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Wallet;
  return <Icon size={size} strokeWidth={1.9} aria-hidden />;
});

/** Cor de categoria ajustada ao tema, para usar em `style={{ color }}`. */
export function catColor(color: string): CSSProperties {
  return { "--cat": color, color: "color-mix(in oklab, var(--cat) var(--cat-strength), #000)" } as CSSProperties;
}
