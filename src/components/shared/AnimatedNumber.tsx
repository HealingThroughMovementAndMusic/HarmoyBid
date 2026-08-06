import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter?: (value: number) => string;
  className?: string;
}

/**
 * Renders a number that smoothly counts up/down to `value` whenever it
 * changes (e.g. after a slider drag or a billing-cycle toggle), instead of
 * snapping instantly. Used across the pricing calculator per the UI/UX
 * micro-interactions convention (Skill 2).
 */
export default function AnimatedNumber({ value, formatter = (v) => Math.round(v).toString(), className }: AnimatedNumberProps) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  const [display, setDisplay] = useState(() => formatter(value));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => setDisplay(formatter(latest)));
    return unsubscribe;
  }, [spring, formatter]);

  return <motion.span className={className}>{display}</motion.span>;
}
