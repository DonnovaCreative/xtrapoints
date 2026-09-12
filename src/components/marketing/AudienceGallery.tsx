import { useState } from "react";
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
export default function AudienceGallery() {
  const [selected, setSelected] = useState(0);
  const audience = audiences[selected];
  return (
    <div className="audience-gallery">
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
            onClick={() => setSelected(i)}
          >
            {a.title}
          </button>
        ))}
      </div>
      <div className="audience-scene">
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
        <div className="audience-story" aria-live="polite">
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
