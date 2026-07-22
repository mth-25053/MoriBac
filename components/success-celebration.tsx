const PETALS = [
  { left: "8%", delay: "0s", duration: "3.4s", drift: "24px", size: 14 },
  { left: "22%", delay: ".4s", duration: "3.9s", drift: "-18px", size: 10 },
  { left: "38%", delay: ".2s", duration: "3.1s", drift: "30px", size: 16 },
  { left: "58%", delay: ".6s", duration: "3.7s", drift: "-26px", size: 11 },
  { left: "74%", delay: ".1s", duration: "3.3s", drift: "20px", size: 15 },
  { left: "90%", delay: ".5s", duration: "3.6s", drift: "-16px", size: 12 }
];

const CONFETTI = [
  { left: "14%", delay: ".05s", duration: "2.8s", color: "var(--celebrate)", rotate: 8 },
  { left: "30%", delay: ".35s", duration: "3.2s", color: "var(--accent)", rotate: -10 },
  { left: "50%", delay: ".15s", duration: "2.6s", color: "var(--celebrate)", rotate: 6 },
  { left: "66%", delay: ".45s", duration: "3.1s", color: "var(--accent)", rotate: -8 },
  { left: "82%", delay: ".25s", duration: "2.9s", color: "var(--celebrate)", rotate: 10 }
];

const SPARKLES = [
  { top: "10%", left: "20%", delay: ".3s", duration: "1.6s", size: 12 },
  { top: "18%", left: "80%", delay: ".8s", duration: "1.8s", size: 10 },
  { top: "40%", left: "10%", delay: "1.2s", duration: "1.7s", size: 9 },
  { top: "34%", left: "90%", delay: "1.6s", duration: "1.5s", size: 11 }
];

/** Restrained, hand-tuned CSS-only celebration - no animation dependency. Every layer runs exactly once (3-5s total) and respects prefers-reduced-motion globally. */
export function SuccessCelebration() {
  return <div className="petal-field" aria-hidden="true">
    {PETALS.map((petal, index) => <svg
      key={`petal-${index}`}
      className="petal"
      width={petal.size}
      height={petal.size}
      viewBox="0 0 24 24"
      style={{ left: petal.left, animationDelay: petal.delay, animationDuration: petal.duration, ["--drift" as string]: petal.drift }}
    >
      <path fill="currentColor" d="M12 2c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8Zm0 12c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8ZM2 12c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Zm12 0c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Z" />
    </svg>)}
    {CONFETTI.map((piece, index) => <span
      key={`confetti-${index}`}
      className="confetti-piece"
      style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, background: piece.color, width: 7, height: 10, borderRadius: 2, transform: `rotate(${piece.rotate}deg)` }}
    />)}
    {SPARKLES.map((sparkle, index) => <svg
      key={`sparkle-${index}`}
      className="sparkle"
      width={sparkle.size}
      height={sparkle.size}
      viewBox="0 0 24 24"
      style={{ top: sparkle.top, left: sparkle.left, animationDelay: sparkle.delay, animationDuration: sparkle.duration }}
    >
      <path fill="currentColor" d="M12 0c.6 5 3 7.4 8 8-5 .6-7.4 3-8 8-.6-5-3-7.4-8-8 5-.6 7.4-3 8-8Z" />
    </svg>)}
  </div>;
}
