const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number) {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number) {
  return lb / LB_PER_KG;
}

export function formatWeightLb(kg: number) {
  return `${kgToLb(kg).toFixed(1)} lbs`;
}

export function formatWeightDeltaLb(kgDelta: number) {
  const lbDelta = kgToLb(kgDelta);
  if (lbDelta === 0) return "0.0";
  return `${lbDelta > 0 ? "+" : "−"}${Math.abs(lbDelta).toFixed(1)}`;
}
