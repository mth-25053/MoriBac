"use client";
import { useEffect, useState } from "react";

const PETAL_COUNT = 36;
const TONES = ["var(--celebrate)", "var(--accent)"];

/** Deterministic pseudo-random sequence (fixed seed) so server and client render the same petal layout - avoids a hydration mismatch that Math.random() would cause. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

const random = seededRandom(20260724);

const PETALS = Array.from({ length: PETAL_COUNT }, (_, index) => ({
  left: `${(random() * 98).toFixed(1)}%`,
  delay: `${(random() * 2.2).toFixed(2)}s`,
  duration: `${(2.8 + random() * 1.8).toFixed(2)}s`,
  drift: `${Math.round((random() - 0.5) * 160)}px`,
  size: Math.round(11 + random() * 11),
  rotate: Math.round(random() * 360),
  spin: Math.round(180 + random() * 220),
  tone: TONES[index % TONES.length]
}));

/** Full-screen petal shower, plays once per result view. Unmounts itself after the fall finishes, and is skipped entirely under prefers-reduced-motion rather than relying on the global animation-duration override, so reduced-motion users see no motion at all. */
export function SuccessCelebration() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(false);
      return;
    }
    const timer = setTimeout(() => setActive(false), 4600);
    return () => clearTimeout(timer);
  }, []);

  if (!active) return null;

  return <div className="petal-shower" aria-hidden="true">
    {PETALS.map((petal, index) => <svg
      key={index}
      className="petal-shower-piece"
      width={petal.size}
      height={petal.size}
      viewBox="0 0 24 24"
      style={{
        left: petal.left,
        color: petal.tone,
        animationDelay: petal.delay,
        animationDuration: petal.duration,
        ["--drift" as string]: petal.drift,
        ["--rotate-from" as string]: `${petal.rotate}deg`,
        ["--rotate-to" as string]: `${petal.rotate + petal.spin}deg`
      }}
    >
      <path fill="currentColor" d="M12 2c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8Zm0 12c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8ZM2 12c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Zm12 0c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Z" />
    </svg>)}
  </div>;
}
