"use client";

// The school's brand editor. Everything here writes to the Sanity DRAFT of their
// school document (see src/pages/api/portal-brand.ts), so nothing they do is
// live until XtraPoint reviews and publishes it. The UI says that plainly rather
// than pretending changes are instant — a school that thinks their logo is live
// when it isn't will email you about it.
import * as React from "react";
import { Check, Loader2, Trash2, Upload } from "lucide-react";

interface ImageField {
  key: string;
  label: string;
  note: string;
}
interface ColorField {
  key: string;
  label: string;
  note: string;
}

interface Props {
  school: string;
  /** Which image keys take a credit line (photos do, logos don't). */
  creditable: string[];
  images: ImageField[];
  colors: ColorField[];
  accept: string;
  acceptLabel: string;
  /** Read-only for staff viewing someone else's portal. */
  readOnly?: boolean;
}

interface State {
  colors: Record<string, string>;
  images: Record<string, string | null>;
  credits?: Record<string, string | null>;
  submittedForReview?: boolean;
  pending?: boolean;
}

const api = "/api/portal-brand";

export function BrandEditor({
  school,
  creditable,
  images,
  colors,
  accept,
  acceptLabel,
  readOnly,
}: Props) {
  const [state, setState] = React.useState<State | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [credits, setCredits] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`${api}?school=${encodeURIComponent(school)}`);
    if (!res.ok) {
      setError("Couldn't load your brand settings. Refresh and try again.");
      return;
    }
    const data = await res.json();
    setState(data);
    setDraft(
      Object.fromEntries(colors.map((c) => [c.key, (data.colors?.[c.key] as string) ?? ""])),
    );
    setCredits(
      Object.fromEntries(creditable.map((k) => [k, (data.credits?.[k] as string) ?? ""])),
    );
  }, [school, colors, creditable]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const flash = (message: string) => {
    setSaved(message);
    setTimeout(() => setSaved(null), 2500);
  };

  const saveColors = async () => {
    setBusy("colors");
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ school, colors: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't save those colors");
      await load();
      flash("Colors saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (field: string, file: File) => {
    setBusy(field);
    setError(null);
    try {
      const form = new FormData();
      form.set("school", school);
      form.set("image", field);
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
      await load();
      flash("Uploaded");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveCredit = async (field: string) => {
    setBusy(`credit:${field}`);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ school, credits: { [field]: credits[field] ?? "" } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't save that credit");
      await load();
      flash("Credit saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const clearImage = async (field: string) => {
    setBusy(field);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ school, clearImage: field }),
      });
      if (!res.ok) throw new Error("Couldn't remove that image");
      await load();
      flash("Removed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ school, submit: true }),
      });
      if (!res.ok) throw new Error("Couldn't submit for review");
      await load();
      flash("Sent for review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your brand settings…
      </div>
    );
  }

  const colorsDirty = colors.some((c) => (draft[c.key] ?? "") !== (state.colors?.[c.key] ?? ""));

  return (
    <div className="mt-8 space-y-8">
      {readOnly && (
        <p className="rounded-card border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          You're viewing this as XtraPoint staff, so editing is turned off here —
          make changes in the Studio instead.
        </p>
      )}

      {/* ── Logos ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-900">Logos</h2>
        <p className="mt-1 text-sm text-gray-500">{acceptLabel}.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-lg">
          {images.slice(0, 2).map((f) => (
            <ImageCard
              key={f.key}
              field={f}
              url={state.images?.[f.key] ?? null}
              busy={busy === f.key}
              disabled={Boolean(busy) || readOnly}
              accept={accept}
              dark
              onUpload={upload}
              onClear={clearImage}
            />
          ))}
        </div>
      </section>

      {/* ── Colors ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-900">Colors</h2>
        <p className="mt-1 text-sm text-gray-500">
          The hover, text and soft-fill shades are worked out from these
          automatically. Leave one empty to use the XtraPoint default.
        </p>
        <div className="mt-4 rounded-card border border-gray-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {colors.map((c) => (
              <label key={c.key} className="block">
                <span className="block text-sm font-semibold text-gray-900">{c.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{c.note}</span>
                <span className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${c.label} colour picker`}
                    value={/^#[0-9a-fA-F]{6}$/.test(draft[c.key] ?? "") ? draft[c.key] : "#ffffff"}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-1 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="#000000"
                    aria-label={`${c.label} hex value`}
                    value={draft[c.key] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase text-gray-900 disabled:bg-gray-50"
                  />
                </span>
              </label>
            ))}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void saveColors()}
              disabled={!colorsDirty || Boolean(busy)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "colors" && <Loader2 className="h-4 w-4 animate-spin" />}
              {colorsDirty ? "Save colors" : "Saved"}
            </button>
          )}
        </div>
      </section>

      {/* ── Photos ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-900">Photos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Used across your two pages. Each is optional — the page still looks
          right without them. Landscape shots around 1600–2048px work best.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.slice(2).map((f) => (
            <ImageCard
              key={f.key}
              field={f}
              url={state.images?.[f.key] ?? null}
              busy={busy === f.key}
              disabled={Boolean(busy) || readOnly}
              accept={accept}
              onUpload={upload}
              onClear={clearImage}
              credit={credits[f.key] ?? ""}
              creditSaved={(state.credits?.[f.key] ?? "") === (credits[f.key] ?? "")}
              creditBusy={busy === `credit:${f.key}`}
              onCreditChange={(v) => setCredits({ ...credits, [f.key]: v })}
              onCreditSave={() => void saveCredit(f.key)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </section>

      {/* ── Review ──────────────────────────────────────────────────────── */}
      {!readOnly && (
        <section className="rounded-card border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Ready for us to look?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Your changes are saved as you go, but they don't reach your live pages
            until the XtraPoint team has reviewed them. Send them over when you're
            happy and we'll take it from there.
          </p>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={Boolean(busy) || state.submittedForReview}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.submittedForReview ? "Sent for review" : "Submit for review"}
          </button>
          {state.submittedForReview && (
            <p className="mt-3 text-xs text-gray-500">
              We've got it. You can keep editing — just send it again when you're done.
            </p>
          )}
        </section>
      )}

      {/* Status line, fixed so it's visible wherever you are on the page. */}
      {(error || saved) && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
            error ? "bg-red-600 text-white" : "bg-gray-900 text-white"
          }`}
        >
          {error ?? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              {saved}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ImageCard({
  field,
  url,
  busy,
  disabled,
  accept,
  dark,
  onUpload,
  onClear,
  credit,
  creditSaved,
  creditBusy,
  onCreditChange,
  onCreditSave,
  readOnly,
}: {
  field: ImageField;
  url: string | null;
  busy: boolean;
  disabled: boolean;
  accept: string;
  dark?: boolean;
  onUpload: (field: string, file: File) => Promise<void>;
  onClear: (field: string) => Promise<void>;
  /** Photos only — undefined means this image takes no credit. */
  credit?: string;
  creditSaved?: boolean;
  creditBusy?: boolean;
  onCreditChange?: (value: string) => void;
  onCreditSave?: () => void;
  readOnly?: boolean;
}) {
  const inputId = `upload-${field.key.replace(/\W/g, "-")}`;

  return (
    <div className="rounded-card border border-gray-200 bg-white p-4">
      <div
        className={`flex h-24 items-center justify-center overflow-hidden rounded-lg ${
          dark ? "bg-ink p-3" : "bg-gray-50"
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={field.label}
            className={dark ? "max-h-full max-w-full object-contain" : "h-full w-full object-cover"}
          />
        ) : (
          <span className="text-xs text-gray-400">Not set</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-bold text-gray-900">{field.label}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{field.note}</p>

      <div className="mt-3 flex items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold text-lime-dark ${
            disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:underline"
          }`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {url ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so picking the same file twice still fires a change event.
            e.target.value = "";
            if (file) void onUpload(field.key, file);
          }}
        />
        {url && !disabled && (
          <button
            type="button"
            onClick={() => void onClear(field.key)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>

      {/* Photo credit. Only rendered for photos, and only once there's a photo
          to credit — an empty box under an empty slot is just noise. */}
      {credit !== undefined && url && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700">Photo credit</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Optional — shown as a small caption on the photo.
            </span>
            <input
              type="text"
              value={credit}
              maxLength={120}
              disabled={readOnly || creditBusy}
              placeholder="e.g. Jane Doe"
              onChange={(e) => onCreditChange?.(e.target.value)}
              onBlur={() => {
                if (!creditSaved) onCreditSave?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 disabled:bg-gray-50"
            />
          </label>
          <p className="mt-1 h-4 text-xs text-gray-400">
            {creditBusy ? "Saving…" : creditSaved ? "" : "Press Enter or click away to save"}
          </p>
        </div>
      )}
    </div>
  );
}

export default BrandEditor;
