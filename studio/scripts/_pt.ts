// Shared Portable Text builder for the legal / policy seed scripts
// (seed-legal.ts, seed-legal-extra.ts). Keeps one implementation of the tiny
// markdown-ish → Portable Text conversion the seeds rely on.
//
// Deterministic keys (no Math.random) so re-running a seed produces a stable
// document (createOrReplace won't churn keys). keySeq is per-process, and each
// `sanity exec` runs in its own process, so scripts don't share counters.

let keySeq = 0;
const key = (p: string) => `${p}${(keySeq++).toString(36)}`;

export interface Span {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}
export interface MarkDef {
  _key: string;
  _type: "link";
  href: string;
}
export interface Block {
  _type: "block";
  _key: string;
  style: string;
  markDefs: MarkDef[];
  children: Span[];
  listItem?: "bullet" | "number";
  level?: number;
}

// Parse inline `[label](href)` links and `**strong**` runs into spans + markDefs.
function inline(text: string): { children: Span[]; markDefs: MarkDef[] } {
  const markDefs: MarkDef[] = [];
  const children: Span[] = [];
  const push = (t: string, marks: string[] = []) => {
    if (t) children.push({ _type: "span", _key: key("s"), text: t, marks });
  };
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const dk = key("l");
      markDefs.push({ _key: dk, _type: "link", href: m[2] });
      children.push({ _type: "span", _key: key("s"), text: m[1], marks: [dk] });
    } else {
      children.push({ _type: "span", _key: key("s"), text: m[3], marks: ["strong"] });
    }
    last = re.lastIndex;
  }
  push(text.slice(last));
  if (children.length === 0) push("");
  return { children, markDefs };
}

export const block = (
  style: string,
  text: string,
  extra: Partial<Block> = {},
): Block => {
  const { children, markDefs } = inline(text);
  return { _type: "block", _key: key("b"), style, markDefs, children, ...extra };
};
export const h2 = (t: string) => block("h2", t);
export const h3 = (t: string) => block("h3", t);
export const p = (t: string) => block("normal", t);
export const quote = (t: string) => block("blockquote", t);
export const bullets = (items: string[]) =>
  items.map((t) => block("normal", t, { listItem: "bullet", level: 1 }));
export const numbers = (items: string[]) =>
  items.map((t) => block("normal", t, { listItem: "number", level: 1 }));
