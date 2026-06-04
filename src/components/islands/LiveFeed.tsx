import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Donor {
  initials: string;
  name: string;
  tag: string;
  type: string;
  amount: number;
  color: string;
}

const DONORS: Donor[] = [
  { initials: "SK", name: "Sarah K.", tag: "'12", type: "Round-up", amount: 0.43, color: "#2b8ffc" },
  { initials: "MT", name: "Marcus T.", tag: "Booster", type: "Recurring", amount: 25, color: "#a3d234" },
  { initials: "JR", name: "Jennifer R.", tag: "'08", type: "Game-day match", amount: 100, color: "#f5b921" },
  { initials: "DL", name: "David L.", tag: "Coach tribute", type: "In honor of", amount: 50, color: "#1750b4" },
  { initials: "AP", name: "Amir P.", tag: "'19", type: "Round-up", amount: 0.78, color: "#97cc04" },
  { initials: "TC", name: "Tara C.", tag: "Parent", type: "Recurring", amount: 15, color: "#0d3191" },
  { initials: "RG", name: "Rosa G.", tag: "'04", type: "Game-day match", amount: 250, color: "#2170d8" },
];

interface FeedItem extends Donor {
  id: number;
  born: number;
}

const ago = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
};

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function LiveFeed() {
  const seed = () =>
    [3, 1, 2, 0].map((idx, i) => ({
      ...DONORS[idx],
      id: -i - 1,
      born: Date.now() - (i + 1) * 11000,
    }));

  const [items, setItems] = useState<FeedItem[]>(seed);
  const [total, setTotal] = useState(2847);
  const [now, setNow] = useState(Date.now());
  const nextId = useRef(1);

  // Push a fresh donation periodically.
  useEffect(() => {
    if (reduced()) return;
    const push = () => {
      const d = DONORS[Math.floor(Math.random() * DONORS.length)];
      const item: FeedItem = { ...d, id: nextId.current++, born: Date.now() };
      setItems((prev) => [item, ...prev].slice(0, 4));
      setTotal((t) => Math.round((t + d.amount) * 100) / 100);
    };
    const interval = setInterval(push, 2800);
    return () => clearInterval(interval);
  }, []);

  // Re-render the relative timestamps once a second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          Booster activity
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-soft px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-lime">
          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-lime" />
          Live
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <motion.span
          key={total}
          initial={{ scale: 1.08, color: "#aaf10a" }}
          animate={{ scale: 1, color: "#ffffff" }}
          transition={{ duration: 0.5 }}
          className="text-[2rem] font-bold leading-none tracking-tight text-white"
        >
          ${total.toLocaleString("en-US")}
        </motion.span>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-white/50">
          in the last hour
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-center gap-3"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold text-white"
                style={{ backgroundColor: item.color }}
              >
                {item.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold text-white">
                  {item.name} · {item.tag}
                </span>
                <span className="block font-mono text-[0.625rem] tracking-[0.02em] text-white/50">
                  {item.type} · {ago(now - item.born)}
                </span>
              </span>
              <span className="whitespace-nowrap text-sm font-bold text-lime">
                +${item.amount.toFixed(2)}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
