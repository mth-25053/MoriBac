const PETALS = [
  { left: "8%", delay: "0s", duration: "3.4s", drift: "24px", size: 14 },
  { left: "22%", delay: ".4s", duration: "3.9s", drift: "-18px", size: 10 },
  { left: "38%", delay: ".2s", duration: "3.1s", drift: "30px", size: 16 },
  { left: "58%", delay: ".6s", duration: "3.7s", drift: "-26px", size: 11 },
  { left: "74%", delay: ".1s", duration: "3.3s", drift: "20px", size: 15 },
  { left: "90%", delay: ".5s", duration: "3.6s", drift: "-16px", size: 12 }
];

/** Restrained, hand-tuned CSS-only celebration - no animation dependency, respects prefers-reduced-motion globally. */
export function SuccessCelebration() {
  return <div className="petal-field" aria-hidden="true">
    {PETALS.map((petal, index) => <svg
      key={index}
      className="petal"
      width={petal.size}
      height={petal.size}
      viewBox="0 0 24 24"
      style={{ left: petal.left, animationDelay: petal.delay, animationDuration: petal.duration, ["--drift" as string]: petal.drift }}
    >
      <path fill="currentColor" d="M12 2c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8Zm0 12c2.2 3 2.2 6 0 8-2.2-2-2.2-5 0-8ZM2 12c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Zm12 0c3-2.2 6-2.2 8 0-2 2.2-5 2.2-8 0Z" />
    </svg>)}
  </div>;
}
