import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useMotionValueEvent } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter?: (value: number) => string;
  className?: string;
}

/**
 * Renders a number that smoothly counts up/down to `value` whenever it
 * changes, instead of snapping instantly.
 *
 * Implementation note (root-caused live, not assumed): `useSpring(value,
 * config)` where `value` is a plain number that changes across renders does
 * NOT animate between renders — each render re-creates a spring already
 * initialized AT that number, so it never has anywhere to animate from.
 * The fix is framer-motion's own documented pattern: hold the number in a
 * stable `useMotionValue` (created once), update *that* via `.set()`
 * whenever the prop changes, and let `useSpring` track *that* motion value
 * (its "track another motion value" mode, which genuinely auto-animates).
 */
export default function AnimatedNumber({ value, formatter = (v) => Math.round(v).toString(), className }: AnimatedNumberProps) {
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { stiffness: 140, damping: 22, mass: 0.6 });
  const [display, setDisplay] = useState(() => formatter(value));

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useMotionValueEvent(spring, 'change', (latest) => {
    setDisplay(formatter(latest));
  });

  return <motion.span className={className}>{display}</motion.span>;
}
