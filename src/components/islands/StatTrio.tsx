import CountUp from "./CountUp";

const stats = [
  { label: "Setup", value: 2, suffix: " hrs", decimals: 0 },
  { label: "Upfront cost", value: 0, prefix: "$", decimals: 0 },
  { label: "Avg donor lift", value: 3.4, suffix: "x", decimals: 1 },
];

/** Hero stat trio — counts up on view. */
export default function StatTrio() {
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-ink/40 px-5 py-5">
          <dt className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-white/45">
            {s.label}
          </dt>
          <dd className="font-display text-3xl leading-none text-lime sm:text-4xl">
            <CountUp
              value={s.value}
              prefix={s.prefix}
              suffix={s.suffix}
              decimals={s.decimals}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
