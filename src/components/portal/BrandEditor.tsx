"use client";

// The school's brand editor. Everything here writes to the Sanity DRAFT of their
// school document (see src/pages/api/portal-brand.ts). Brand changes appear in
// the current draft until an authorized administrator publishes the school.
import * as React from "react";
import { ArrowRight, Check, Loader2, Trash2, Upload } from "lucide-react";
import { brandDraftChanges, refreshBrandDraft, type BrandEditorDraft, type BrandSnapshot, type ConfirmedBrandChanges } from "./brandEditorDraft";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/portalEdit";

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
  school?: string;
  /** Stable ID for staff managing a prepared school. */
  partnerId?: string;
  /** Which image keys take a credit line (photos do, logos don't). */
  creditable: string[];
  images: ImageField[];
  colors: ColorField[];
  accept: string;
  acceptLabel: string;
  /** Read-only for a viewer account. */
  readOnly?: boolean;
  /** Staff workflow: continue to the page editor for previews and publication. */
  completionHref?: string;
}

const api = "/api/portal-brand";

export function BrandEditor({
  school,
  partnerId,
  creditable,
  images,
  colors,
  accept,
  acceptLabel,
  readOnly,
  completionHref,
}: Props) {
  const [model, setModel] = React.useState<BrandEditorDraft | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = React.useState(false);
  const operationActive = React.useRef(false);
  const confirmedChanges = React.useRef<ConfirmedBrandChanges>({});
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const state = model?.saved;
  const draft = model?.colors ?? {};
  const credits = model?.credits ?? {};
  const dirty = brandDraftChanges(model);
  const colorsDirty = dirty.colors;
  const unsaved = dirty.colors || dirty.credits;
  const disabled = Boolean(busy) || Boolean(readOnly) || needsRefresh;
  const selector = partnerId ? { partnerId } : { school };

  const refresh = React.useCallback(async () => {
    const query = partnerId ? new URLSearchParams({ partnerId }) : new URLSearchParams({ school: school ?? "" });
    const res = await fetch(`${api}?${query}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Couldn't refresh your brand settings. Try again to load the latest saved draft.");
    const data = await res.json() as BrandSnapshot;
    if (!data || !data.revision) throw new Error("Couldn't load the school draft. Try again.");
    const confirmed = confirmedChanges.current;
    setModel(current => refreshBrandDraft(current, data, colors.map(c => c.key), creditable, confirmed));
    confirmedChanges.current = {};
    setNeedsRefresh(false);
  }, [school, partnerId, colors, creditable]);

  const load = React.useCallback(async () => {
    if (operationActive.current) return;
    operationActive.current = true;
    setBusy("refresh");
    setError(null);
    try {
      await refresh();
    } catch (err) {
      setNeedsRefresh(true);
      setError((err as Error).message);
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  }, [refresh]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => () => clearTimeout(flashTimer.current), []);
  React.useEffect(() => {
    if (!unsaved && (!busy || busy === "refresh")) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, busy]);

  const flash = (message: string) => {
    clearTimeout(flashTimer.current);
    setSaved(message);
    flashTimer.current = setTimeout(() => setSaved(null), 3500);
  };

  const mutate = async (name: string, request: RequestInit, message: string, confirmed: ConfirmedBrandChanges = {}) => {
    if (disabled || operationActive.current) return;
    operationActive.current = true;
    setBusy(name);
    setError(null);
    setSaved(null);
    let committed = false;
    try {
      const res = await fetch(api, request);
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) setNeedsRefresh(true);
      if (!res.ok) throw new Error(
        res.status === 413 || data.error === "too_large" ? `That file is too large — ${MAX_IMAGE_BYTES / 1_000_000} MB is the limit.`
          : data.error === "bad_type" ? `That file type isn't accepted. Use ${acceptLabel}.`
          : (data.message ?? "The change couldn't be saved. Please try again."),
      );
      committed = true;
      confirmedChanges.current = confirmed;
      await refresh();
      flash(message);
    } catch (err) {
      if (committed) {
        setNeedsRefresh(true);
        setError("Your change was saved, but the latest draft couldn't be loaded. Try again below before making more changes. Your unsaved inputs are still here.");
      } else {
        setError((err as Error).message);
      }
    } finally {
      operationActive.current = false;
      setBusy(null);
    }
  };

  const jsonRequest = (changes: Record<string, unknown>): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...selector, revision: state?.revision, ...changes }),
  });

  const saveColors = () => mutate("colors", jsonRequest({ colors: draft }), "Colors saved to draft", { colors: { ...draft } });

  const upload = async (field: string, file: File) => {
    if (disabled || operationActive.current) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`That file is too large — ${MAX_IMAGE_BYTES / 1_000_000} MB is the limit.`);
      return;
    }
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError(`That file type isn't accepted. Use ${acceptLabel}.`);
      return;
    }
    const form = new FormData();
    if (partnerId) form.set("partnerId", partnerId);
    else if (school) form.set("school", school);
    if (state?.revision) form.set("revision", state.revision);
    form.set("image", field);
    form.set("file", file);
    await mutate(field, { method: "POST", body: form }, "Image saved to draft");
  };

  const saveCredit = (field: string) => {
    const credit = { [field]: credits[field] ?? "" };
    return mutate(`credit:${field}`, jsonRequest({ credits: credit }), "Photo credit saved to draft", { credits: credit });
  };

  const clearImage = async (field: string) => {
    const hasUnsavedCredit = (credits[field] ?? "") !== (state?.credits?.[field] ?? "");
    if (hasUnsavedCredit && !window.confirm("Removing this image also discards its unsaved photo credit. Remove the image?")) return;
    await mutate(field, jsonRequest({ clearImage: field }), "Image removed from draft", { credits: { [field]: credits[field] ?? "" } });
  };

  const submit = () => {
    if (unsaved) return;
    return mutate("submit", jsonRequest({ submit: true }), "Sent for review");
  };

  if (!state) {
    return (
      <div className="mt-8 text-sm text-gray-600">
        {error ? <div role="alert"><p>{error}</p><button disabled={Boolean(busy)} className="mt-3 font-semibold underline disabled:opacity-40" onClick={() => void load()}>Try again</button></div> : <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading your brand settings…</p>}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {needsRefresh && (
        <div role="alert" className="rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p>Load the latest saved draft before making more changes. Unsaved colors and photo credits will be kept.</p>
          <button type="button" disabled={Boolean(busy)} onClick={() => void load()} className="mt-2 font-semibold underline disabled:opacity-40">
            {busy === "refresh" ? "Loading…" : "Try again"}
          </button>
        </div>
      )}
      {unsaved && !readOnly && (
        <p role="status" className="rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          You have unsaved {dirty.colors && dirty.credits ? "colors and photo credits" : dirty.colors ? "colors" : "photo credits"}. Use the save buttons below before continuing. Image uploads save to the draft automatically.
        </p>
      )}
      {readOnly && (
        <p className="rounded-card border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          Your account can view this brand kit. A school editor or administrator can update it.
        </p>
      )}

      {/* ── Logos ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-900">Logos</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Upload the school's header logo and square logo here. Each file saves to the draft immediately. {acceptLabel}.</p>
        <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
          {images.slice(0, 2).map((f) => (
            <ImageCard
              key={f.key}
              field={f}
              url={state.images?.[f.key] ?? null}
              busy={busy === f.key}
              disabled={disabled}
              accept={accept}
              dark={f.key === "logo"}
              readOnly={readOnly}
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
                    disabled={disabled}
                    onChange={(e) => setModel(current => current && ({ ...current, colors: { ...current.colors, [c.key]: e.target.value } }))}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-1 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="#000000"
                    aria-label={`${c.label} hex value`}
                    value={draft[c.key] ?? ""}
                    disabled={disabled}
                    onChange={(e) => setModel(current => current && ({ ...current, colors: { ...current.colors, [c.key]: e.target.value } }))}
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
              disabled={!colorsDirty || disabled}
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
        <h2 className="text-sm font-bold text-gray-900">Brand imagery</h2>
        <p className="mt-1 text-sm text-gray-500">
          Optional photos and mascot cutouts for school pages and marketing materials. Landscape photos around 1600–2048px work best. Each card shows where the image is used. {acceptLabel}.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.slice(2).map((f) => (
            <ImageCard
              key={f.key}
              field={f}
              url={state.images?.[f.key] ?? null}
              busy={busy === f.key}
              disabled={disabled}
              accept={accept}
              onUpload={upload}
              onClear={clearImage}
              credit={creditable.includes(f.key) ? credits[f.key] ?? "" : undefined}
              creditSaved={(state.credits?.[f.key] ?? "") === (credits[f.key] ?? "")}
              creditBusy={busy === `credit:${f.key}`}
              onCreditChange={(v) => setModel(current => current && ({ ...current, credits: { ...current.credits, [f.key]: v } }))}
              onCreditSave={() => void saveCredit(f.key)}
              onCreditDiscard={() => setModel(current => current && ({ ...current, credits: { ...current.credits, [f.key]: current.saved.credits?.[f.key] ?? "" } }))}
              readOnly={readOnly}
            />
          ))}
        </div>
      </section>

      {/* ── Review ──────────────────────────────────────────────────────── */}
      {!readOnly && (
        <section className="rounded-card border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">{completionHref ? "Next: school details" : "Ready for review?"}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            {completionHref
              ? "Your saved logos, imagery and colors are in the school draft. Continue to edit the page content, open a private preview and publish when ready."
              : "Uploaded files and saved colors are kept in the draft. Submit the saved draft when it is ready for publication review."}
          </p>
          {completionHref ? (
            <a
              href={disabled || unsaved ? undefined : completionHref}
              aria-disabled={disabled || unsaved || undefined}
              tabIndex={disabled || unsaved ? -1 : undefined}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
            >
              Continue to school details <ArrowRight className="h-4 w-4" />
            </a>
          ) : <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || unsaved || Boolean(state.submittedForReview) || !state.pending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.submittedForReview ? "Sent for review" : "Submit for review"}
          </button>}
          {unsaved && <p className="mt-3 text-sm text-amber-800">Save your colors and photo credits before {completionHref ? "continuing" : "submitting for review"}.</p>}
          {!completionHref && state.submittedForReview && (
            <p className="mt-3 text-xs text-gray-500">
              This draft is marked for review. Further changes return it to draft so the updated version can be reviewed.
            </p>
          )}
        </section>
      )}

      {/* Status line, fixed so it's visible wherever you are on the page. */}
      {(error || saved) && (
        <div
          role={error ? "alert" : "status"}
          className={`fixed bottom-5 left-1/2 z-40 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
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
  onCreditDiscard,
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
  onCreditDiscard?: () => void;
  readOnly?: boolean;
}) {
  const inputId = `upload-${field.key.replace(/\W/g, "-")}`;
  const input = React.useRef<HTMLInputElement>(null);
  const isLogo = field.key === "logo" || field.key === "avatar";
  const contain = isLogo || field.key.startsWith("photos.cutout");

  return (
    <div className="rounded-card border border-gray-200 bg-white p-4">
      <div
        className={`flex h-24 items-center justify-center overflow-hidden rounded-lg ${
          dark ? "bg-ink p-3" : contain ? "border border-gray-100 bg-gray-50 p-3" : "bg-gray-50"
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={field.label}
            className={contain ? "max-h-full max-w-full object-contain" : "h-full w-full object-cover"}
          />
        ) : (
          <span className={`text-sm ${dark ? "text-white/75" : "text-gray-500"}`}>{isLogo ? "No logo uploaded" : "No image uploaded"}</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-bold text-gray-900">{field.label}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{field.note}</p>

      {!readOnly && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          aria-label={`${url ? "Replace" : "Upload"} ${field.label.toLowerCase()}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Saving…" : `${url ? "Replace" : "Upload"} ${isLogo ? "logo" : "image"}`}
        </button>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-label={`File for ${field.label.toLowerCase()}`}
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
            aria-label={`Remove ${field.label.toLowerCase()}`}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>}

      {/* Keep an unfinished credit recoverable if another editor removes its photo. */}
      {credit !== undefined && (url || !creditSaved) && (
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
              disabled={disabled}
              placeholder="e.g. Jane Doe"
              onChange={(e) => onCreditChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (url && !disabled && !creditSaved) onCreditSave?.();
                }
              }}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 disabled:bg-gray-50"
            />
          </label>
          {!url && <p className="mt-2 text-xs leading-relaxed text-amber-800">This image was removed from the saved draft. Copy your unsaved credit if needed, then discard it or upload an image.</p>}
          {!readOnly && !url && <button type="button" onClick={onCreditDiscard} disabled={disabled} className="mt-2 min-h-10 text-sm font-semibold text-ink underline disabled:opacity-40">Discard unsaved credit</button>}
          {!readOnly && url && <button
            type="button"
            disabled={disabled || creditSaved}
            onClick={onCreditSave}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creditBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {creditBusy ? "Saving…" : creditSaved ? "Credit saved" : "Save credit"}
          </button>}
        </div>
      )}
    </div>
  );
}

export default BrandEditor;
