// =============================================================================
// POST /api/lead — the ONE endpoint every form on the site posts to.
//
//   { type: "contact" }    → HubSpot CRM   (falls back to Sheets if HubSpot errors)
//   { type: "donor" }      → Google Sheets, "<School> — Donors" tab
//   { type: "ambassador" } → Google Sheets, "<School> — Ambassadors" tab
//
// The forms are dumb on purpose: they collect fields and POST this shape. Which
// vendor receives it is decided here, so switching destinations is a one-file
// change instead of an edit to three React components.
//
// WHY A SERVER ROUTE AT ALL, when the old forms posted straight to Web3Forms:
//   • The Apps Script /exec URL and the hCaptcha secret must not ship to the
//     browser. Client-side posting means a public write endpoint to your sheet.
//   • The captcha token has to be verified somewhere a bot can't skip.
//   • One place to fan out — CRM, sheet, and (dormant) email notification.
//
// NOT in src/middleware.ts's SCOPE, deliberately: these submissions are
// anonymous. Adding it there would put Clerk in front of a public form.
// =============================================================================

export const prerender = false;

import type { APIRoute } from "astro";
import { normalizeLead, validateLead, type Lead } from "@/lib/leads";
import { verifyCaptcha } from "@/lib/hcaptcha";
import { submitToHubSpot, hubspotConfigured } from "@/lib/hubspot";
import { appendLeadToSheet, sheetConfigured } from "@/lib/leadSheet";
import { notifyWeb3Forms } from "@/lib/web3forms";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Malformed request." }, 400);
  }

  // Honeypot. Bots fill hidden fields; humans never see it. Answer 200 so the
  // bot believes it succeeded and doesn't come back to probe for what tripped.
  if (typeof raw.botcheck === "string" && raw.botcheck.length > 0) {
    return json({ ok: true });
  }

  const lead = normalizeLead(raw);
  const problems = validateLead(lead);
  if (problems.length) return json({ ok: false, error: problems[0] }, 400);

  // Captcha is only rendered on the B2B contact form — the two waitlist forms
  // are one-line sign-ups where a captcha would cost more conversions than the
  // spam is worth, and they rely on the honeypot plus being write-only.
  if (lead.type === "contact") {
    const captcha = await verifyCaptcha(raw.captchaToken as string | undefined, clientAddress);
    if (!captcha.ok) {
      console.warn("[lead] captcha rejected:", captcha.reason);
      return json({ ok: false, error: "Captcha verification failed. Please try again." }, 400);
    }
  }

  const full = lead as Lead;

  if (full.type === "contact") {
    const result = await submitToHubSpot(full);

    if (result.ok) {
      void notifyWeb3Forms(full); // dormant unless WEB3FORMS_KEY is set
      return json({ ok: true });
    }

    // HubSpot rejected it (most likely cause: a field in FIELD_MAP that the form
    // no longer defines, or bot protection switched back on). A sales lead is
    // too expensive to drop over a form-config mistake, so it goes to the
    // spreadsheet instead and the reason is logged loudly.
    console.error("[lead] HubSpot submission failed:", result.error);

    if (sheetConfigured()) {
      const fallback = await appendLeadToSheet(full);
      if (fallback.ok) {
        void notifyWeb3Forms(full);
        return json({ ok: true });
      }
      console.error("[lead] Sheets fallback ALSO failed:", fallback.error);
    }

    if (!hubspotConfigured()) {
      return json({ ok: false, error: "Form isn’t configured yet. Please email us directly." }, 500);
    }
    return json({ ok: false, error: "We couldn’t submit that. Please try again or email us." }, 502);
  }

  // Donor + ambassador waitlists.
  const result = await appendLeadToSheet(full);
  if (!result.ok) {
    console.error("[lead] Sheets append failed:", result.error);
    return json({ ok: false, error: "We couldn’t save that. Please try again." }, 502);
  }

  void notifyWeb3Forms(full);
  return json({ ok: true });
};

/** Anything that isn't a POST gets a clear 405 rather than a confusing 404. */
export const ALL: APIRoute = () =>
  json({ ok: false, error: "Method not allowed." }, 405);
