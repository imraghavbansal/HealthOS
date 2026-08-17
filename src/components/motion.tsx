import { AnimatePresence, motion, useInView, useMotionValue, useSpring, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Reveal children with a stagger when scrolled into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Grid/list wrapper: children animate in sequence. Use with <Stagger.Item>. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={staggerParent}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Subtle lift + press feedback for cards and tiles. */
export function Lift({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.div
      className={className}
      whileHover={disabled ? undefined : { y: -4, transition: { duration: 0.2, ease: EASE } }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
    >
      {children}
    </motion.div>
  );
}

/** Spring-animated number counter. */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 18 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  useEffect(() => spring.on("change", (v) => setDisplay(v)), [spring]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Animated ring/progress arc used for scores. */
export function ProgressRing({
  value,
  size = 132,
  stroke = 10,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.min(100, Math.max(0, value)) / 100) * c }}
          transition={{ duration: 1.1, ease: EASE }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" />
            <stop offset="100%" stopColor="var(--chart-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        {label}
        {sublabel}
      </div>
    </div>
  );
}

export { motion, AnimatePresence };
