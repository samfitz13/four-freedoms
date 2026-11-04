import { HeartPulse, Hourglass, MapPin, Sprout } from "lucide-react";
import type { FreedomKey } from "@/lib/freedoms/types";

export function FreedomIcon({ freedom, size = 22 }: { freedom: FreedomKey; size?: number }) {
  const icons = { financial: Sprout, location: MapPin, time: Hourglass, health: HeartPulse };
  const Icon = icons[freedom];
  return <Icon size={size} strokeWidth={1.7} aria-hidden />;
}
