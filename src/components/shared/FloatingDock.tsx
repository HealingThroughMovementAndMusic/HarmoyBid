import { useRef, useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

// "Rationed Voltage Dark" motion rule: 150ms, cubic-bezier(0.4,0,0.2,1),
// no spring/overshoot. Applied to this file's discrete (settle-to-target)
// transitions — the desktop dock's mouse-proximity magnification spring is
// a deliberate, documented exception (see IconContainer's springConfig).
const VOLTAGE_TRANSITION = { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const };

// Adapted from Aceternity UI's "Floating Dock" (motion/react → framer-motion,
// already the project's sole animation dependency; @tabler/icons-react →
// lucide-react, already the project's sole icon library; href/<a> →
// onClick/<button>, since this app has no real routing — see CLAUDE.md /
// Design Spec Motion Strategy for why a second animation/icon library was
// deliberately avoided here). Retextured onto Harmony's design tokens
// instead of the original's hardcoded gray/neutral palette, so it follows
// the light/dark toggle automatically.

export interface FloatingDockItem {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}

interface FloatingDockProps {
  items: FloatingDockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}

export function FloatingDock({ items, desktopClassName, mobileClassName }: FloatingDockProps) {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
}

function FloatingDockMobile({ items, className }: { items: FloatingDockItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative block md:hidden', className)}>
      <AnimatePresence>
        {open && (
          <motion.div layoutId="harmony-dock-nav" className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2">
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { ...VOLTAGE_TRANSITION, delay: idx * 0.05 } }}
                transition={{ ...VOLTAGE_TRANSITION, delay: (items.length - 1 - idx) * 0.05 }}
              >
                <button
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  aria-label={item.title}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
                >
                  <div className="h-4 w-4 text-muted-foreground">{item.icon}</div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'סגור פעולות מהירות' : 'פתח פעולות מהירות'}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
      >
        <ChevronUp className={cn('h-5 w-5 text-muted-foreground transition-transform', open ? '' : 'rotate-180')} aria-hidden="true" />
      </button>
    </div>
  );
}

function FloatingDockDesktop({ items, className }: { items: FloatingDockItem[]; className?: string }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'mx-auto hidden h-16 items-end gap-4 rounded-2xl border border-border bg-card px-4 pb-3 md:flex',
        className
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
}

function IconContainer({ mouseX, title, icon, onClick }: FloatingDockItem & { mouseX: MotionValue }) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  const heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);

  // Deliberate exception to the flat VOLTAGE_TRANSITION rule above: this is
  // a continuous, live mouse-position-driven interpolation (magnification
  // follows mouseX in real time), not a discrete settle-to-target animation
  // that could overshoot — a duration-based cubic-bezier can't reproduce a
  // drag-follow effect, and converting it would remove the feature, not
  // restyle it.
  const springConfig = { mass: 0.1, stiffness: 150, damping: 12 };
  const width = useSpring(widthTransform, springConfig);
  const height = useSpring(heightTransform, springConfig);
  const widthIcon = useSpring(widthTransformIcon, springConfig);
  const heightIcon = useSpring(heightTransformIcon, springConfig);

  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      style={{ width, height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={title}
      className="relative flex aspect-square items-center justify-center rounded-full bg-primary/10"
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%', transition: VOLTAGE_TRANSITION }}
            exit={{ opacity: 0, y: 2, x: '-50%', transition: VOLTAGE_TRANSITION }}
            className="absolute -top-8 left-1/2 w-fit whitespace-pre rounded-md border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground"
          >
            {title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div style={{ width: widthIcon, height: heightIcon }} className="flex items-center justify-center text-primary">
        {icon}
      </motion.div>
    </motion.button>
  );
}
