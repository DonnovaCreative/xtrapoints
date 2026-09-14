import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "@/styles/giving-story.css";

const stages = [
  {
    label: "Choose your team",
    description:
      "Start with the school, team, or community you want to support.",
    duration: 5000,
  },
  {
    label: "Link an account",
    description: "Connect an eligible account and turn on round-up giving.",
    duration: 5500,
  },
  {
    label: "Let it add up",
    description:
      "Everyday purchases create small round-ups that accumulate toward a donation.",
    duration: 9500,
  },
] as const;

const purchases = [
  { name: "Morning coffee", cents: 465 },
  { name: "Weekly groceries", cents: 7282 },
  { name: "Game-day lunch", cents: 1238 },
] as const;
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const roundUp = (cents: number) => Math.ceil(cents / 100) * 100 - cents;
const accumulated = purchases.reduce(
  (sum, purchase) => sum + roundUp(purchase.cents),
  0,
);

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GivingReceipt() {
  return (
    <div className="giving-story-receipt">
      <div className="giving-story-receipt-top">
        <span>A few everyday purchases</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      </div>
      <div className="giving-story-transactions">
        {purchases.map((purchase, index) => (
          <div
            className="giving-story-transaction"
            key={purchase.name}
            style={{ "--receipt-row": index } as CSSProperties}
          >
            <span className="giving-story-purchase-name">{purchase.name}</span>
            <div
              className="giving-story-equation"
              aria-label={`${money(purchase.cents)} purchase plus ${money(roundUp(purchase.cents))} round-up equals ${money(purchase.cents + roundUp(purchase.cents))}`}
            >
              <span>{money(purchase.cents)}</span>
              <span className="giving-story-add">
                + {money(roundUp(purchase.cents))}
              </span>
              <span className="giving-story-equals">
                = {money(purchase.cents + roundUp(purchase.cents))}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="giving-story-total">
        <span>Round-ups accumulated</span>
        <strong>{money(accumulated)}</strong>
      </div>
      <div className="giving-story-receipt-team">
        <img src="/favicon.svg" width="30" height="30" alt="" />
        <span>
          A little change.
          <br />
          <strong>For the team you love.</strong>
        </span>
        <Check />
      </div>
    </div>
  );
}

export default function RoundUpDemo() {
  const root = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const hasStarted = useRef(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animated, setAnimated] = useState(false);
  const descriptionId = useId();
  const running =
    ready && inView && pageVisible && !userPaused && !hovered && !focused;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReducedMotion(preference.matches);
      setAnimated(!preference.matches);
      if (preference.matches) setUserPaused(true);
    };
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    setReady(true);
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) =>
              setInView(
                entry.isIntersecting && entry.intersectionRatio >= 0.35,
              ),
            { threshold: [0, 0.35] },
          )
        : null;
    if (observer && root.current) observer.observe(root.current);
    else setInView(true);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!running) {
      // Pausing reveals the complete illustration so an entrance animation
      // cannot leave someone reading a blank or partially shown scene.
      setAnimated(false);
      return;
    }
    if (!hasStarted.current) {
      hasStarted.current = true;
      setAnimated(!reducedMotion);
    }
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      elapsed.current += now - previous;
      previous = now;
      root.current?.style.setProperty(
        "--giving-story-progress",
        String(Math.min(elapsed.current / stages[step].duration, 1)),
      );
      if (elapsed.current >= stages[step].duration) {
        elapsed.current = 0;
        root.current?.style.setProperty("--giving-story-progress", "0");
        setAnimated(!reducedMotion);
        setStep((current) => (current + 1) % stages.length);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, step, reducedMotion]);

  const chooseStep = (index: number) => {
    elapsed.current = 0;
    root.current?.style.setProperty("--giving-story-progress", "0");
    setStep(index);
    setUserPaused(true);
    setAnimated(false);
  };

  return (
    <div
      ref={root}
      className="giving-story"
      data-step={step + 1}
      data-running={running ? "true" : "false"}
      data-animated={animated ? "true" : "false"}
      aria-label="An illustrated guide to round-up giving"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse")
          setHovered(!(event.target as Element).closest(".giving-story-play"));
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) =>
        setFocused(!event.target.closest(".giving-story-play"))
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div
        className="giving-story-controls"
        role="group"
        aria-label="Choose a step in the round-up giving story"
      >
        {stages.map((stage, index) => (
          <button
            type="button"
            key={stage.label}
            onClick={() => chooseStep(index)}
            aria-pressed={step === index}
            disabled={!ready}
          >
            <span className="giving-story-step-track" aria-hidden="true">
              <span />
            </span>
            <span className="giving-story-step-label">
              <span>{index + 1}</span>
              {stage.label}
            </span>
          </button>
        ))}
      </div>

      <div className="giving-story-scene" aria-describedby={descriptionId}>
        <div className="giving-story-scene-label">
          <span>Round-up giving</span>
          <span>Illustrated example</span>
        </div>
        <div className="giving-story-panel" key={step}>
          {step === 0 && (
            <div className="giving-story-team-scene">
              <div
                className="giving-story-team-shadow giving-story-team-shadow-back"
                aria-hidden="true"
              />
              <div
                className="giving-story-team-shadow giving-story-team-shadow-front"
                aria-hidden="true"
              />
              <div className="giving-story-team-card">
                <div className="giving-story-court" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                </div>
                <img
                  src="/assets/xtrapoint-logo-white.svg"
                  width="1010"
                  height="182"
                  alt="XtraPoint"
                />
                <div className="giving-story-team-copy">
                  <span>The place you believe in.</span>
                  <strong>Your team.</strong>
                  <p>Your people. Your purpose.</p>
                </div>
                <span className="giving-story-selected">
                  <Check />
                  <span>Chosen by you</span>
                </span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="giving-story-connection-scene">
              <div className="giving-story-connection">
                <div className="giving-story-account-tile">
                  <span className="giving-story-account-icon">
                    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <rect
                        x="6"
                        y="10"
                        width="28"
                        height="21"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M6 17h28M11 25h8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>Eligible account</span>
                </div>
                <div className="giving-story-link-path" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="giving-story-account-tile giving-story-program-tile">
                  <img src="/favicon.svg" width="58" height="58" alt="" />
                  <span>Your team</span>
                </div>
              </div>
              <div className="giving-story-connected">
                <span>
                  <Check />
                </span>
                <div>
                  <strong>A connection that gives back.</strong>
                  <p>Round-ups are ready for the everyday.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="giving-story-receipt-scene">
              <div className="giving-story-receipt-paper" aria-hidden="true" />
              <GivingReceipt />
            </div>
          )}
        </div>
        <p id={descriptionId} className="giving-story-description">
          {stages[step].description}
        </p>
      </div>

      <div className="giving-story-footer">
        <span>Small moments. Ongoing support.</span>
        <button
          className="giving-story-play"
          type="button"
          disabled={!ready}
          aria-label={
            userPaused
              ? "Play automatic giving story"
              : "Pause automatic giving story"
          }
          onClick={() => {
            setUserPaused((paused) => !paused);
            setAnimated(!reducedMotion);
            setHovered(false);
            setFocused(false);
          }}
        >
          {userPaused ? (
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="m6 4 10 6-10 6V4Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5 4h3v12H5zM12 4h3v12h-3z" />
            </svg>
          )}
          <span>{userPaused ? "Play story" : "Pause story"}</span>
        </button>
      </div>
      <p className="giving-story-note">
        Illustration only. Round-ups accumulate before a donation is processed.
      </p>
      <noscript>
        <style>{`.giving-story-controls,.giving-story-scene,.giving-story-footer{display:none!important}.giving-story-static{padding:24px;background:#f0f7ff}.giving-story-static .giving-story-receipt{margin:auto;transform:none}`}</style>
        <div className="giving-story-static">
          <GivingReceipt />
        </div>
      </noscript>
    </div>
  );
}
