import {
  ArrowUpRight,
  CircleDot,
  CupSoda,
  Flame,
  HeartPulse,
  Shield,
  Square,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  target: Target,
  basketball: CircleDot,
  'arrow-up-right': ArrowUpRight,
  shield: Shield,
  users: Users,
  'heart-pulse': HeartPulse,
  cup: CupSoda,
};

export function BlockTypeIcon({ icon, className = 'h-3.5 w-3.5' }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Square;
  return <Icon className={className} aria-hidden="true" />;
}
