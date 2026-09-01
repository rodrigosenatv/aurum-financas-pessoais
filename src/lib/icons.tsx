import { memo } from "react";
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
      className="grid shrink-0 place-items-center"
      style={{
        width: chip,
        height: chip,
        borderRadius: radius,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)`,
      }}
    >
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
});

export const BareIcon = memo(function BareIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Wallet;
  return <Icon size={size} strokeWidth={1.9} />;
});
