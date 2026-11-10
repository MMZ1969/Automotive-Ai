// MechanicBadge — the one place mechanic badge levels are defined.
//   🏁 Certified Mechanic (gold)  isCertified: license / ASE number checked
//   ✓  Verified Mechanic (blue)   isVerified only: proven working mechanic, no license
//   🔧 Mechanic (grey)            signed up as a mechanic, not checked (no badge chip)
import React from "react";
import { Text, View } from "react-native";

export type MechanicTier = "certified" | "verified" | "mechanic" | "diyer";

type BadgeUser = { role?: string | null; isVerified?: boolean | null; isCertified?: boolean | null } | null | undefined;

export function mechanicTier(u: BadgeUser): MechanicTier {
  if (!u || u.role !== "MECHANIC") return "diyer";
  if (u.isCertified) return "certified";
  if (u.isVerified) return "verified";
  return "mechanic";
}

export const TIER_STYLE = {
  certified: { emoji: "🏁", label: "Certified Mechanic", short: "Certified", color: "#f59e0b", bg: "#3a2600", border: "#f59e0b", text: "#fde68a" },
  verified: { emoji: "✓", label: "Verified Mechanic", short: "Verified", color: "#3b82f6", bg: "#1e3a8a", border: "#60a5fa", text: "#ffffff" },
  mechanic: { emoji: "🔧", label: "Mechanic", short: "Mechanic", color: "#9ca3af", bg: "#1f2937", border: "#9ca3af", text: "#ffffff" },
} as const;

// Renders the Certified / Verified chip; nothing for unchecked mechanics or DIYers.
// size: "md" (post headers), "sm" (comments, lists), "xs" (replies).
export default function MechanicBadge({ user, size = "md", glow = false, short = false }: {
  user: BadgeUser;
  size?: "md" | "sm" | "xs";
  glow?: boolean;
  short?: boolean;
}) {
  const tier = mechanicTier(user);
  if (tier !== "certified" && tier !== "verified") return null;
  const t = TIER_STYLE[tier];
  const pad = size === "md" ? { paddingHorizontal: 8, paddingVertical: 3 } : size === "sm" ? { paddingHorizontal: 6, paddingVertical: 2 } : { paddingHorizontal: 5, paddingVertical: 1 };
  const fontSize = size === "md" ? 10 : size === "sm" ? 9 : 8;
  return (
    <View style={{
      ...pad, borderRadius: size === "md" ? 8 : 6, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg,
      ...(glow ? { shadowColor: t.color, shadowOpacity: 0.45, shadowRadius: 4, elevation: 4 } : {}),
    }}>
      <Text style={{ color: t.text, fontSize, fontWeight: "700" }}>{t.emoji} {short || size === "xs" ? t.short : t.label}</Text>
    </View>
  );
}
