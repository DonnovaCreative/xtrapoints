import { useEffect, useRef, useState } from "react";
const audiences = [
  {
    title: "Athletics",
    image: "otto-basketball-team",
    headline: "More than a game.",
    copy: "Help the people in the stands become part of what happens on the court, on the field, and all season long.",
    alt: "Otto joins a basketball team and their coach in a gym huddle.",
  },
  {
    title: "Schools & alumni",
    image: "otto-campus-community",
    headline: "The connection continues.",
    copy: "Give students, families, and alumni an everyday way to stay connected to the school that brings them together.",
    alt: "Otto walks with students along a sunny campus path.",
  },
  {
    title: "Booster clubs",
    image: "otto-booster-community",
    headline: "Back the people who show up.",
    copy: "Turn the enthusiasm of parents, fans, and your booster community into ongoing support for your program.",
    alt: "Otto stands with a group of athletic supporters in a campus lounge.",
  },
  {
    title: "Youth sports",
    image: "otto-youth-sports",
    headline: "Big dreams start here.",
    copy: "Bring families and local supporters together around the teams helping the next generation grow.",
    alt: "Otto celebrates with children and their coach on a youth sports field.",
  },
  {
    title: "Community",
    image: "otto-community-fundraiser",
    headline: "Good things grow together.",
    copy: "Build a culture of participation around the people, programs, and causes your community cares about.",
    alt: "Otto and volunteers gather at an outdoor community fundraiser.",
  },
];
const INTERVAL = 6500;
export default function AudienceGallery() {
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduced, setReduced] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const running =
    playing && visible && pageVisible && !reduced && !hovered && !focused;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(media.matches);
    const updatePage = () => setPageVisible(!document.hidden);
    updateMotion();
    updatePage();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updatePage);
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: 0.35 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updatePage);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setSelected((value) => (value + 1) % audiences.length),
      INTERVAL,
    );
    return () => window.clearTimeout(timer);
  }, [running, selected]);
  useEffect(() => {
    if (!visible) return;
    const next = new Image();
    next.src = `/images/brand-refresh/${audiences[(selected + 1) % audiences.length].image}${window.innerWidth <= 700 ? "-720" : ""}.webp`;
  }, [visible, selected]);
  const audience = audiences[selected];
  const choose = (index: number) => {
    setSelected(index);
    setPlaying(false);
  };
  return (
    <div
      className="audience-gallery"
      ref={root}
      data-running={running}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setFocused(false);
      }}
    >
      <div className="audience-controls">
        <div
          className="audience-select"
          role="group"
          aria-label="Explore your community"
        >
          {audiences.map((a, i) => (
            <button
              type="button"
              key={a.title}
              aria-pressed={selected === i}
              onClick={() => choose(i)}
            >
              {a.title}
              {selected === i && playing && !reduced && (
                <span
                  key={`${selected}-${running}`}
                  className="audience-timer"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            className="audience-playback"
            onClick={() => {
              if (!playing) {
                setFocused(false);
                setHovered(false);
              }
              setPlaying((p) => !p);
            }}
            aria-label={
              playing
                ? "Pause automatic community slideshow"
                : "Play automatic community slideshow"
            }
          >
            <svg
              viewBox="0 0 20 20"
              width="13"
              height="13"
              fill="currentColor"
              aria-hidden="true"
            >
              {playing ? (
                <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
              ) : (
                <path d="m6 3 11 7-11 7V3Z" />
              )}
            </svg>
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
      <div
        className="audience-scene"
        aria-roledescription="slideshow"
        aria-label="Communities XtraPoint serves"
      >
        <img
          key={audience.image}
          src={`/images/brand-refresh/${audience.image}.webp`}
          srcSet={`/images/brand-refresh/${audience.image}-720.webp 720w, /images/brand-refresh/${audience.image}.webp 1536w`}
          sizes="(max-width:700px) 100vw, 75vw"
          width="1536"
          height="1024"
          alt={audience.alt}
          loading="lazy"
        />
        <div className="audience-story" aria-live={playing ? "off" : "polite"}>
          <span className="xp-caption">Your community. Your impact.</span>
          <h3>{audience.headline}</h3>
          <p>{audience.copy}</p>
          <a href="/contact" className="xp-text-link">
            Bring XtraPoint to your community <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
