import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import CountUp from "./CountUp";
import { brand } from "@/config/brand";

const stats = [
  { label: "Net giving", value: 776.39, prefix: "$", suffix: "k", decimals: 2, trend: "12.4% MoM" },
  { label: "Active donors", value: 3481, decimals: 0, trend: "8.1% MoM" },
  { label: "Avg gift", value: 22.94, prefix: "$", decimals: 2, trend: "3.6% MoM" },
];

// 12 monthly points, gently climbing — drawn in a 320×96 viewBox.
const points = [62, 58, 60, 52, 48, 50, 42, 38, 40, 30, 26, 18];
const stepX = 320 / (points.length - 1);
const line = points.map((y, i) => `${i * stepX},${y}`).join(" ");
const area = `0,96 ${line} 320,96`;
const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const tabs = ["Overview", "Donors", "Campaigns"];

export default function DonorDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_30px_60px_-24px_rgba(3,17,109,0.25)]"
    >
      {/* window chrome / url bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        </span>
        <span className="ml-2 truncate font-mono text-[11px] text-gray-400">
          {brand.appHost} / bobcat-athletics / overview
        </span>
      </div>

      <div className="p-5 sm:p-6">
        {/* brand + tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary-800 to-primary-600 text-xs font-bold text-white">
              B
            </span>
            Bobcat Athletics Fund
          </div>
        </div>
        <div className="mt-4 flex gap-5 border-b border-gray-100">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={`-mb-px border-b-2 pb-2 text-xs font-medium ${
                i === 0
                  ? "border-ink text-gray-900"
                  : "border-transparent text-gray-500"
              }`}
            >
              {t}
            </span>
          ))}
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500">
                {s.label}
              </div>
              <div className="text-xl font-bold leading-none tracking-tight text-gray-900">
                <CountUp
                  value={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals}
                />
              </div>
              <div className="mt-1.5 font-mono text-[10px] font-bold text-lime-dark">
                ↑ {s.trend}
              </div>
            </div>
          ))}
        </div>

        {/* chart */}
        <div className="mt-6">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500">
            Giving · last 12 months
          </div>
          <svg viewBox="0 0 320 96" className="h-24 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-lime)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-lime)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.polygon
              points={area}
              fill="url(#dash-fill)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.6 }}
            />
            <motion.polyline
              points={line}
              fill="none"
              stroke="var(--color-lime-dark)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-gray-400">
            {months.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
