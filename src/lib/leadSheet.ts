// =============================================================================
// GOOGLE SHEETS — donor + ambassador waitlists.
//
// Posts to a Google Apps Script Web App bound to the workbook (source lives in
// scripts/apps-script/Code.gs, checked in so it isn't only inside Google).
//
// WHY APPS SCRIPT over the Sheets API v4: no GCP project, no service account, no
// private key to rotate, no new npm dependency — and the person who owns the
// spreadsheet owns the script. For an MVP waitlist that's the whole job.
//
// WHY THIS IS SERVER-SIDE: the /exec URL accepts an unauthenticated POST (it has
// to — that's how "Anyone" deployment works), so if it shipped in the browser
// bundle anyone could append rows to your spreadsheet forever. It lives in a
// non-PUBLIC env var and only this module ever sees it. SHEETS_SECRET is the
// shared secret the script checks before writing.
//
// PER-SCHOOL SEPARATION: one workbook, two tabs per school ("Albany — Donors",
// "Albany — Ambassadors"), created automatically on that school's first
// submission. Note that tabs separate DATA, not ACCESS — Google sharing is
// per-file. If schools ever need to see their own leads, do NOT split this into
// one file per school; serve it from /portal/[school], which is already
// Clerk-gated per school organization.
// =============================================================================

import type { Lead } from "@/lib/leads";

const WEBHOOK_URL = import.meta.env.SHEETS_WEBHOOK_URL as string | undefined;
const SHEETS_SECRET = import.meta.env.SHEETS_SECRET as string | undefined;

export interface SheetResult {
  ok: boolean;
  error?: string;
}

export const sheetConfigured = () => Boolean(WEBHOOK_URL && SHEETS_SECRET);

/**
 * Append one row. `kind` picks the tab suffix so a single school's donors and
 * ambassadors stay in separate tabs.
 */
export async function appendLeadToSheet(lead: Lead): Promise<SheetResult> {
  if (!sheetConfigured()) {
    return { ok: false, error: "SHEETS_WEBHOOK_URL / SHEETS_SECRET not set" };
  }

  try {
    const res = await fetch(WEBHOOK_URL!, {
      method: "POST",
      // text/plain deliberately: Apps Script reads the raw body either way, and
      // it avoids a CORS preflight if this is ever called from a browser.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      // Apps Script /exec answers with a 302 to script.googleusercontent.com;
      // fetch follows it by default, which is why there's no redirect handling.
      body: JSON.stringify({
        secret: SHEETS_SECRET,
        type: lead.type,
        school: lead.school || "Unassigned",
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone ?? "",
        organization: lead.organization ?? "",
        orgType: lead.orgType ?? "",
        message: lead.message ?? "",
        source: lead.source ?? "",
        page: lead.page ?? "",
      }),
    });

    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} — ${text.slice(0, 300)}` };

    // The script returns JSON; a non-JSON body means Google served an error page
    // (most often: the deployment isn't set to "Anyone" access).
    try {
      const json = JSON.parse(text) as { ok?: boolean; error?: string };
      return json.ok ? { ok: true } : { ok: false, error: json.error || text.slice(0, 300) };
    } catch {
      return { ok: false, error: `Non-JSON response — ${text.slice(0, 300)}` };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
