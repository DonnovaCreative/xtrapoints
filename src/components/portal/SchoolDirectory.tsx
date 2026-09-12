import { useEffect, useState } from "react";
import { Search, Plus, ArrowRight, Loader2 } from "lucide-react";
const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base";
export default function SchoolDirectory() {
  const [customSlug, setCustomSlug] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", short: "", mascot: "", fund: "", slug: "" });
  async function load(after = "") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin-schools?" + new URLSearchParams({ q, after }));
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Unable to load schools.");
      setSchools((old) => (after ? [...old, ...b.schools] : b.schools));
      setNext(b.next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { slug, ...fields } = form;
      const r = await fetch("/api/admin-schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", slug, fields }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Unable to create school.");
      window.location.href = `/admin/schools/${encodeURIComponent(b.partnerId)}`;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const merged = Array.from(
    new Map(schools.map((s) => [s._id.replace(/^drafts\./, ""), s])).values(),
  );
  return (
    <div className="mt-8">
      <div className="flex flex-wrap justify-between gap-4">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search schools</span>
            <input
              className={input}
              placeholder="Search schools or page addresses"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            className="min-h-11 rounded-lg border border-gray-300 px-4"
            disabled={busy}
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </form>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 py-2.5 font-semibold text-white"
          onClick={() => setCreating(!creating)}
        >
          <Plus size={18} />
          Create school
        </button>
      </div>
      {error && (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-900" role="alert">
          {error}
        </p>
      )}
      {creating && (
        <form onSubmit={create} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-xl font-bold">Start with a school</h2>
          <p className="mt-2 text-gray-600">
            Create the record during your sales call. You'll get a draft to customize before sharing
            a private preview.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["name", "School or organization name"],
              ["short", "Short name"],
              ["mascot", "Mascot or community name"],
              ["fund", "Fund or beneficiary organization"],
              ["slug", "Page address"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm font-semibold">
                {label}
                <input
                  className={input + " mt-2"}
                  required
                  value={form[key as keyof typeof form]}
                  onChange={(e) => {
                    if (key === "slug") setCustomSlug(true);
                    setForm({
                      ...form,
                      [key]: e.target.value,
                      ...(key === "short" && !customSlug
                        ? {
                            slug: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, ""),
                          }
                        : {}),
                    });
                  }}
                />
                {key === "slug" && (
                  <span className="mt-1 block font-normal text-gray-600">
                    /schools/{form.slug || "school-name"}
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="min-h-11 rounded-lg bg-ink px-5 py-2.5 font-semibold text-white"
              disabled={busy}
            >
              {busy ? "Creating…" : "Create draft school"}
            </button>
            <button type="button" className="px-4 underline" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="mt-7 overflow-hidden rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-600">
          Schools and partner organizations
        </div>
        <ul className="divide-y divide-gray-200">
          {merged.map((s) => (
            <li key={s._id}>
              <a
                href={`/admin/schools/${encodeURIComponent(s._id.replace(/^drafts\./, ""))}`}
                className="flex items-center gap-4 px-5 py-5 hover:bg-gray-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 font-bold text-ink">
                  {s.logo ? (
                    <img src={s.logo} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    (s.short ?? s.name ?? "?").slice(0, 2)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.name || "Untitled school"}</span>
                  <span className="block text-sm text-gray-600">
                    {s.slug ? `/schools/${s.slug}` : "Page address needed"}
                  </span>
                </span>
                <span className="hidden text-sm text-gray-600 sm:inline">
                  {s.productionStatus === "live"
                    ? "Published"
                    : s._id.startsWith("drafts.")
                      ? "Draft"
                      : "Private preparation"}
                </span>
                <ArrowRight size={18} />
              </a>
            </li>
          ))}
        </ul>
        {!schools.length && !busy && (
          <p className="p-8 text-center text-gray-600">
            {q ? "No schools match this search." : "Create a school to start preparing its pages."}
          </p>
        )}
      </div>
      {busy && (
        <p className="mt-4 flex gap-2" role="status">
          <Loader2 className="animate-spin" size={18} />
          Loading…
        </p>
      )}
      {next && (
        <button
          className="mt-5 rounded-lg border border-gray-300 px-5 py-2.5 font-semibold"
          disabled={busy}
          onClick={() => load(next)}
        >
          Load more schools
        </button>
      )}
    </div>
  );
}
