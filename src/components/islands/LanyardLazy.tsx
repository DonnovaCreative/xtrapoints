import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";

// Heavy 3D chunk (three + rapier + the 2.4MB model) is only imported when the
// section scrolls into view — so it doesn't load on page load, and the card's
// "fall into frame" physics entrance plays exactly when the user sees it.
const Lanyard = lazy(() => import("./Lanyard"));

type Props = ComponentProps<typeof Lanyard>;

export default function LanyardLazy(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }, // mount once ~20% of the panel is visible
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {show ? (
        <Suspense fallback={null}>
          <Lanyard {...props} />
        </Suspense>
      ) : null}
    </div>
  );
}
