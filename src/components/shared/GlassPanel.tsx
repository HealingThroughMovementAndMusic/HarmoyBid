import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

// The house "hero surface" recipe (Design Spec Phase 2, A4) — extracted from
// the Quote Engine, the reference implementation. Reserved for exactly ONE
// primary content surface per screen; never applied to repeated grid items
// (see SolidCard below for those) — glass loses its "special" read the
// moment it's the default treatment for everything.
interface GlassPanelProps extends ComponentPropsWithoutRef<'div'> {
  glow?: boolean;
}

export function GlassPanel({ className, glow = true, style, ...rest }: GlassPanelProps) {
  return (
    <div
      className={cn('rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden', className)}
      style={{ ...(glow ? { boxShadow: '0 0 60px -15px hsl(var(--primary) / 0.25)' } : undefined), ...style }}
      {...rest}
    />
  );
}

// The house "repeated grid item" recipe — solid, flat, legible at a glance.
// Used for KPI tiles, package cards, list rows — anything that appears many
// times on one screen.
type SolidCardProps = ComponentPropsWithoutRef<'div'>;

export function SolidCard({ className, ...rest }: SolidCardProps) {
  return <div className={cn('rounded-xl border border-border bg-card p-5', className)} {...rest} />;
}
