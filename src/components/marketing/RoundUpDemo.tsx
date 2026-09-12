import { useState } from "react";

const purchases = [
  {
    name: "Morning coffee",
    total: 465,
    icon: "coffee",
    detail: "Your usual order. A little extra for your team.",
  },
  {
    name: "Weekly groceries",
    total: 7282,
    icon: "basket",
    detail: "The weekly essentials. Another way to show up.",
  },
  {
    name: "Game-day lunch",
    total: 1238,
    icon: "meal",
    detail: "Fuel for the afternoon. Support for the season.",
  },
] as const;
const money = (cents: number) => (cents / 100).toFixed(2);
export default function RoundUpDemo() {
  const [selected, setSelected] = useState(0);
  const purchase = purchases[selected];
  const rounded = Math.ceil(purchase.total / 100) * 100;
  return (
    <div className="roundup-demo">
      <div
        className="roundup-choices"
        role="group"
        aria-label="Choose an example purchase"
      >
        {purchases.map((p, index) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="roundup-stage">
        <div className="roundup-orbit" aria-hidden="true">
          <span>+</span>
          <span>+</span>
          <span>+</span>
        </div>
        <div className="roundup-receipt" aria-live="polite" aria-atomic="true">
          <div className="receipt-top">
            <span>Everyday purchase</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
              <path d="M9 8h6M9 12h6" />
            </svg>
          </div>
          <div className="receipt-purchase" key={purchase.name}>
            <span>{purchase.name}</span>
            <strong>${money(purchase.total)}</strong>
          </div>
          <div className="receipt-rule" />
          <div className="receipt-roundup">
            <span>Your round-up</span>
            <strong>+ ${money(rounded - purchase.total)}</strong>
          </div>
          <div className="receipt-total">
            <span>Rounded total</span>
            <span>${money(rounded)}</span>
          </div>
          <div className="receipt-team">
            <img src="/favicon.svg" width="30" height="30" alt="" />
            <span>
              A little change.
              <br />
              <strong>For the team you love.</strong>
            </span>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
        </div>
      </div>
      <p className="roundup-note">
        Illustrative purchase. Round-ups accumulate before a donation is
        processed.
      </p>
    </div>
  );
}
