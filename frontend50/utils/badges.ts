export const getBadge = (repPoints: number) => {
  if (repPoints >= 2000) return { emoji: "🏆", label: "Legend", color: "#f59e0b" };
  if (repPoints >= 500) return { emoji: "⚡", label: "Wrench Master", color: "#345bff" };
  if (repPoints >= 100) return { emoji: "🔧", label: "Gearhead", color: "#10b981" };
  return { emoji: "🔩", label: "Rookie", color: "#9ca3af" };
};