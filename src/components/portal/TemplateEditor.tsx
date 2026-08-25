"use client";

// The customise screen for one generated template.
//
// Left: the fields a school may change, from src/lib/templateFields.ts. Right: a
// live preview of the actual sheet — the same page the PDF is printed from, in
// an iframe — so "what I see is what exports" is literally true rather than a
// promise.
//
// Every field carries its derived default as the input's PLACEHOLDER, not its
// value. That's what makes the model legible without explaining it: an empty box
// shows what the flyer says today, typing overrides it, and clearing it puts the
// automatic value back. There's no separate "reset" concept to learn per field.
import * as React from "react";
import { Check, Download, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";

export interface EditorField {
  key: string;
  label: string;
  help?: string;
  control: "text" | "textarea" | "url" | "color" | "image" | "list";
  maxLength?: number;
  maxItems?: number;
  itemMaxLength?: number;
  group: string;
  /** What the template computes when this is empty — shown as placeholder. */
  derived?: string;
  derivedItems?: string[];
}

interface Props {
  school: string;
  template: string;
  title: string;
  groups: { id: string; title: string; blurb?: string }[];
  fields: EditorField[];
  previewHref: string;
  exportHref: string;
  accept: string;
  acceptLabel: string;
  readOnly?: boolean;
}

interface Loaded {
  values: Record<string, string>;
  lists: Record<string, string[]>;
  images: Record<string, string>;
  updatedAt: string | null;
}

const api = "/api/portal-template";

export function TemplateEditor({
  school,
  template,
  title,
  groups,
  fields,
  previewHref,
  exportHref,
  accept,
  acceptLabel,
  readOnly,
}: Props) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [lists, setLists] = React.useState<Record<string, string[]>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  // Bumped after every successful write to force the preview iframe to re-fetch.
  const [previewKey, setPreviewKey] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `${api}?school=${encodeURIComponent(school)}&template=${encodeURIComponent(template)}`,
      );
      if (!res.ok) {
        // Report the status. A bare "couldn't load" sent someone hunting through
        // the wrong layer once already — a 500 here means the endpoint broke, a
        // 401 means the session did, and those have nothing to do with each other.
        const detail = await res
          .json()
          .then((d) => d.message ?? d.error)
          .catch(() => null);
        throw new Error(`Couldn't load your changes (${res.status}${detail ? `: ${detail}` : ""}).`);
      }
      const data: Loaded = await res.json();
      setLoaded(data);
      setValues(data.values ?? {});
      setLists(data.lists ?? {});
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [school, template]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const say = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 2500);
  };

  const refresh = async () => {
    await load();
    setPreviewKey((k) => k + 1);
  };

  const post = async (body: unknown, label: string, tag: string) => {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ school, template, ...(body as object) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "That didn't save.");
      await refresh();
      say(label);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const dirty = React.useMemo(() => {
    if (!loaded) return false;
    const scalarsChanged = fields
      .filter((f) => f.control !== "image" && f.control !== "list")
      .some((f) => (values[f.key] ?? "") !== (loaded.values[f.key] ?? ""));
    const listsChanged = fields
      .filter((f) => f.control === "list")
      .some(
        (f) =>
          JSON.stringify((lists[f.key] ?? []).filter(Boolean)) !==
          JSON.stringify(loaded.lists[f.key] ?? []),
      );
    return scalarsChanged || listsChanged;
  }, [loaded, values, lists, fields]);

  const saveAll = () => {
    const scalarKeys = fields.filter((f) => f.control !== "image" && f.control !== "list");
    const listKeys = fields.filter((f) => f.control === "list");
    void post(
      {
        values: Object.fromEntries(scalarKeys.map((f) => [f.key, values[f.key] ?? ""])),
        lists: Object.fromEntries(
          listKeys.map((f) => [f.key, (lists[f.key] ?? []).filter(Boolean)]),
        ),
      },
      "Saved",
      "save",
    );
  };

  const upload = async (key: string, file: File) => {
    setBusy(key);
    setError(null);
    try {
      const form = new FormData();
      form.set("school", school);
      form.set("template", template);
      form.set("image", key);
      form.set("file", file);
      const res = await fetch(api, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error === "too_large"
            ? "That file is too large — 8 MB is the limit."
            : data.error === "bad_type"
              ? `That file type isn't accepted. Use ${acceptLabel}.`
              : (data.message ?? "Upload failed"),
        );
      }
      await refresh();
      say("Image updated");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const exportUrl = loaded?.updatedAt
    ? `${exportHref}?v=${encodeURIComponent(loaded.updatedAt)}`
    : exportHref;

  // Nothing to edit yet. The error branch matters: this early return sits above
  // the form's own error box, so without it a failed load spins forever and the
  // reason never reaches the person looking at it.
  if (!loaded) {
    return error ? (
      <div className="mt-8 rounded-card border border-red-200 bg-red-50 px-5 py-4">
        <p className="text-sm font-semibold text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 text-sm font-semibold text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    ) : (
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your flyer…
      </div>
    );
  }

  const field = (f: EditorField) => {
    const busyHere = busy === f.key;

    if (f.control === "image") {
      const current = loaded.images[f.key];
      return (
        <div key={f.key} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{f.label}</div>
              {f.help && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{f.help}</p>}
            </div>
            {current && (
              <img
                src={`${current}?w=160&fit=max&auto=format`}
                alt=""
                className="h-12 w-20 shrink-0 rounded border border-gray-200 bg-gray-50 object-contain"
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
              {busyHere ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {current ? "Replace" : "Upload"}
              <input
                type="file"
                accept={accept}
                className="hidden"
                disabled={readOnly || busyHere}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(f.key, file);
                  e.target.value = "";
                }}
              />
            </label>
            {current && (
              <button
                type="button"
                disabled={readOnly || busyHere}
                onClick={() => void post({ clear: f.key }, "Back to your default", f.key)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Use my brand default
              </button>
            )}
          </div>
        </div>
      );
    }

    if (f.control === "list") {
      const items = lists[f.key] ?? [];
      const shown = items.length ? items : (f.derivedItems ?? []);
      const usingDefault = !items.length;
      return (
        <div key={f.key} className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900">{f.label}</div>
          {f.help && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{f.help}</p>}
          {usingDefault && (
            <p className="mt-2 text-xs font-medium text-gray-400">
              Using your automatic list — edit any line to take it over.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {shown.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item}
                  maxLength={f.itemMaxLength}
                  disabled={readOnly}
                  onChange={(e) => {
                    const next = [...shown];
                    next[i] = e.target.value;
                    setLists({ ...lists, [f.key]: next });
                  }}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setLists({ ...lists, [f.key]: shown.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:text-red-600"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              disabled={readOnly || (f.maxItems ? shown.length >= f.maxItems : false)}
              onClick={() => setLists({ ...lists, [f.key]: [...shown, ""] })}
              className="text-xs font-semibold text-lime-dark hover:underline disabled:text-gray-300 disabled:no-underline"
            >
              + Add line
            </button>
            {f.maxItems && (
              <span className="text-xs text-gray-400">
                {shown.length}/{f.maxItems}
              </span>
            )}
          </div>
        </div>
      );
    }

    const value = values[f.key] ?? "";
    const over = f.maxLength ? value.length > f.maxLength : false;

    return (
      <div key={f.key} className="rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-semibold text-gray-900" htmlFor={`f-${f.key}`}>
          {f.label}
        </label>
        {f.help && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{f.help}</p>}

        <div className="mt-2 flex items-center gap-2">
          {f.control === "color" && (
            <input
              type="color"
              aria-label={`${f.label} swatch`}
              value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#222222"}
              disabled={readOnly}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-1"
            />
          )}
          {f.control === "textarea" ? (
            <textarea
              id={`f-${f.key}`}
              rows={3}
              value={value}
              placeholder={f.derived}
              disabled={readOnly}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          ) : (
            <input
              id={`f-${f.key}`}
              value={value}
              placeholder={f.derived}
              disabled={readOnly}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {value ? "Yours" : "Automatic — leave empty to keep it"}
          </span>
          {f.maxLength && (
            <span className={`text-xs ${over ? "font-semibold text-red-600" : "text-gray-400"}`}>
              {value.length}/{f.maxLength}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      {/* ============ Controls ============ */}
      <div className="min-w-0">
        {readOnly && (
          <p className="mb-4 rounded-card border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            You're viewing this as XtraPoint staff — this is read-only here.
          </p>
        )}

        <div className="space-y-6">
          {groups.map((g) => {
            const inGroup = fields.filter((f) => f.group === g.id);
            if (!inGroup.length) return null;
            return (
              <section key={g.id} className="rounded-card border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-bold text-gray-900">{g.title}</h2>
                {g.blurb && (
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{g.blurb}</p>
                )}
                <div className="mt-4 space-y-3">{inGroup.map(field)}</div>
              </section>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={readOnly || !dirty || busy === "save"}
            onClick={saveAll}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
          >
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {dirty ? "Save changes" : "Saved"}
          </button>

          {loaded.updatedAt && (
            <button
              type="button"
              disabled={readOnly || busy === "reset"}
              onClick={() => {
                if (confirm("Put every part of this flyer back to its automatic version?")) {
                  void post({ reset: true }, "Back to the original", "reset");
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
            >
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
          )}

          {flash && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime-dark">
              <Check className="h-4 w-4" /> {flash}
            </span>
          )}
        </div>
      </div>

      {/* ============ Live preview ============ */}
      <div className="min-w-0 lg:sticky lg:top-20">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">{title} preview</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {dirty ? "Save to see your latest changes here." : "Exactly what exports."}
            </p>
          </div>
          <a
            href={exportUrl}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Export PDF
          </a>
        </div>

        <div className="mt-3 overflow-hidden rounded-card border border-gray-200 bg-gray-100">
          {/* 8.5:11 — the sheet's real proportions, so nothing is cropped. */}
          <div className="relative w-full" style={{ aspectRatio: "8.5 / 11" }}>
            <iframe
              key={previewKey}
              src={`${previewHref}?bare=1&t=${previewKey}`}
              title={`${title} preview`}
              className="absolute inset-0 h-full w-full border-0"
              // The sheet is 816px wide; scale it down to whatever the column is.
              style={{ colorScheme: "light" }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Changes here only affect this flyer — your pages and your brand kit stay
          as they are.
        </p>
      </div>
    </div>
  );
}

export default TemplateEditor;
