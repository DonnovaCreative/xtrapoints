import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "../../styles/ambassador-wall.css";

const examples = [
  {
    image: "11-coffee-campus-walk",
    title: "Coffee on campus",
    scene:
      "a student with an iced coffee sharing the XtraPoint page on a campus sidewalk",
  },
  {
    image: "22-bedroom-streamer-hoodie",
    title: "From the streaming setup",
    scene: "a student wearing an XtraPoint hoodie at a bedroom streaming setup",
  },
  {
    image: "15-stadium-bleachers",
    title: "From the stands",
    scene: "a student holding the XtraPoint page in the stadium bleachers",
  },
  {
    image: "03-man-court",
    title: "A courtside introduction",
    scene:
      "a student demonstrating the giving screen at an outdoor basketball court",
  },
  {
    image: "23-dorm-jersey-unpacking",
    title: "The dorm-room unboxing",
    scene: "a student unpacking an XtraPoint jersey in a dorm room",
  },
  {
    image: "06-woman-student-center",
    title: "At the student center",
    scene: "a student showing the giving screen inside a student center",
  },
  {
    image: "20-stadium-concourse",
    title: "Before kickoff",
    scene: "a student sharing the XtraPoint page from a stadium concourse",
  },
  {
    image: "25-late-night-streamer",
    title: "After-hours conversation",
    scene: "a student wearing an XtraPoint hoodie at a desk with a microphone",
  },
  {
    image: "12-basketball-seated",
    title: "Between games",
    scene:
      "a student seated with a basketball and the XtraPoint page on a phone",
  },
  {
    image: "02-woman-dorm",
    title: "A dorm-room introduction",
    scene:
      "a student in a blue sweatshirt showing the giving screen in a dorm room",
  },
  {
    image: "19-campus-crosswalk",
    title: "On the way to class",
    scene: "a student sharing the XtraPoint page on a campus street",
  },
  {
    image: "27-bedroom-flag-show",
    title: "Showing the colors",
    scene: "a student displaying an XtraPoint flag in a bedroom",
  },
  {
    image: "01-man-campus",
    title: "A campus conversation",
    scene: "a student pointing to the giving screen outside a campus building",
  },
  {
    image: "26-stadium-seat-selfie",
    title: "Game-day selfie",
    scene: "a student wearing an XtraPoint cap and shirt in the stadium stands",
  },
  {
    image: "17-gym-courtside",
    title: "Inside the gym",
    scene: "a student sharing the XtraPoint page beside a basketball court",
  },
  {
    image: "21-morning-kitchen-self-recording",
    title: "Part of the morning",
    scene:
      "a student in an XtraPoint shirt sharing the program over an iced coffee",
  },
  {
    image: "18-library-steps",
    title: "Outside the library",
    scene:
      "a student carrying books and sharing the XtraPoint page on library steps",
  },
  {
    image: "30-desk-streamer-cap",
    title: "A new way to represent",
    scene: "a student wearing an XtraPoint cap at a desk with a microphone",
  },
  {
    image: "14-football-sideline",
    title: "On the sideline",
    scene: "a student showing the XtraPoint page at a football field",
  },
  {
    image: "08-woman-room",
    title: "Sharing how it works",
    scene: "a student demonstrating the giving screen in a room",
  },
  {
    image: "24-campus-walking-selfie",
    title: "Around campus",
    scene: "a student wearing an XtraPoint cap and shirt on a campus walk",
  },
  {
    image: "13-cafeteria-lunch",
    title: "Over lunch",
    scene: "a student at a cafeteria table with the XtraPoint page on a phone",
  },
  {
    image: "05-man-dorm",
    title: "From the dorm",
    scene: "a student pointing to the giving screen in a dorm room",
  },
  {
    image: "10-woman-track",
    title: "After practice",
    scene:
      "a student demonstrating the giving screen at an outdoor running track",
  },
];

const source = (image: string, small = false) =>
  `/images/ambassadors/${image}${small ? "-320" : ""}.webp`;
const durations = [228, 264, 242, 282, 252];
const offsets = [0.025, 0.84, 0.13, 0.98, 0.18];

export default function AmbassadorWall() {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const browseButton = useRef<HTMLButtonElement>(null);
  const dialogTitle = useId();
  const [enhanced, setEnhanced] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interactionOverride, setInteractionOverride] = useState(false);
  const [columnCount, setColumnCount] = useState(5);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isOpen = activeIndex !== null;
  const staticGallery = !enhanced || reduced;
  const running =
    !staticGallery &&
    !paused &&
    (!(hovered || focused) || interactionOverride) &&
    inView &&
    pageVisible &&
    !isOpen;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(media.matches);
    const updatePage = () => setPageVisible(!document.hidden);
    updateMotion();
    updatePage();
    setEnhanced(true);
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updatePage);
    const intersection = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    const resize = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumnCount(width < 600 ? 2 : width < 960 ? 3 : width < 1200 ? 4 : 5);
    });
    if (root.current) {
      intersection.observe(root.current);
      resize.observe(root.current);
    }
    return () => {
      intersection.disconnect();
      resize.disconnect();
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updatePage);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !dialog.current) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
      browseButton.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const columns = Array.from({ length: columnCount }, (_, column) =>
    examples
      .map((example, index) => ({ ...example, index }))
      .filter((_, index) => index % columnCount === column),
  );
  const active = activeIndex === null ? null : examples[activeIndex];
  const step = (direction: number) =>
    setActiveIndex(
      (index) => ((index ?? 0) + direction + examples.length) % examples.length,
    );

  return (
    <div
      className="ambassador-wall"
      ref={root}
      data-static={staticGallery}
      data-running={running}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          setHovered(true);
          setInteractionOverride(false);
        }
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => {
        setFocused(true);
        setInteractionOverride(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setFocused(false);
      }}
    >
      <div
        className="ambassador-wall__viewport"
        aria-hidden={!staticGallery || undefined}
        role={staticGallery ? "region" : undefined}
        aria-label={staticGallery ? "Ambassador content examples" : undefined}
      >
        <div
          className="ambassador-wall__columns"
          style={{ "--aw-columns": columnCount } as CSSProperties}
        >
          {columns.map((column, columnIndex) => (
            <div className="ambassador-wall__column" key={columnIndex}>
              <div
                className="ambassador-wall__track"
                style={
                  {
                    "--aw-duration": `${durations[columnIndex]}s`,
                    "--aw-delay": `${-durations[columnIndex] * offsets[columnIndex]}s`,
                    "--aw-direction": columnIndex % 2 ? "reverse" : "normal",
                  } as CSSProperties
                }
              >
                {[0, 1].map((copy) => (
                  <div
                    className={`ambassador-wall__group${copy ? " ambassador-wall__duplicate" : ""}`}
                    key={copy}
                    aria-hidden={copy ? true : undefined}
                  >
                    {column.map((example) => (
                      <a
                        className="ambassador-wall__card"
                        key={example.image}
                        href={source(example.image)}
                        tabIndex={staticGallery && copy === 0 ? 0 : -1}
                        aria-label={`View ${example.title.toLowerCase()} — ambassador content mockup`}
                        onClick={(event) => {
                          event.preventDefault();
                          setActiveIndex(example.index);
                        }}
                      >
                        <img
                          src={source(example.image, true)}
                          srcSet={`${source(example.image, true)} 320w, ${source(example.image)} 600w`}
                          sizes="(max-width: 639px) 46vw, (max-width: 999px) 30vw, (max-width: 1255px) 23vw, (max-width: 1599px) 19vw, 300px"
                          width="600"
                          height="1066"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          alt={`Ambassador content mockup of ${example.scene}.`}
                        />
                        <span
                          className="ambassador-wall__expand"
                          aria-hidden="true"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" />
                          </svg>
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ambassador-wall__controls">
        <p>Ambassador content examples</p>
        <div className="ambassador-wall__actions">
          {enhanced && !reduced && (
            <button
              className="ambassador-wall__motion"
              type="button"
              onClick={() => {
                setPaused((value) => !value);
                setInteractionOverride(paused);
              }}
              aria-label={
                paused
                  ? "Play ambassador gallery motion"
                  : "Pause ambassador gallery motion"
              }
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                {paused ? (
                  <path d="m6 3 11 7-11 7V3Z" />
                ) : (
                  <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
                )}
              </svg>
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <button
            className="ambassador-wall__browse"
            ref={browseButton}
            hidden={!enhanced}
            type="button"
            onClick={() => setActiveIndex(0)}
            aria-haspopup="dialog"
          >
            View all {examples.length} examples{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        className="ambassador-wall__dialog"
        aria-labelledby={dialogTitle}
        onClose={() => setActiveIndex(null)}
        onCancel={() => setActiveIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setActiveIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
      >
        <div className="ambassador-wall__viewer">
          <div className="ambassador-wall__viewer-heading">
            <div>
              <p>Ambassador content mockup</p>
              <h3 id={dialogTitle}>{active?.title ?? "Ambassador content"}</h3>
            </div>
            <button
              type="button"
              className="ambassador-wall__close"
              aria-label="Close ambassador gallery"
              onClick={() => setActiveIndex(null)}
              autoFocus
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </div>
          {active && (
            <img
              className="ambassador-wall__full-image"
              src={source(active.image)}
              width="600"
              height="1066"
              alt={`Ambassador content mockup of ${active.scene}.`}
            />
          )}
          <div className="ambassador-wall__viewer-navigation">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous ambassador example"
            >
              <span aria-hidden="true">←</span> Previous
            </button>
            <p aria-live="polite" aria-atomic="true">
              {(activeIndex ?? 0) + 1} of {examples.length}
            </p>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next ambassador example"
            >
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
