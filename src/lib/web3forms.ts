// =============================================================================
// WEB3FORMS — ARCHIVED, deliberately kept wired.
//
// Every form used to POST to Web3Forms directly from the browser. That path was
// retired when the contact form moved to HubSpot and the two school waitlists
// moved to Google Sheets. It is kept here, working and current, rather than
// deleted or commented out, because the team may need it back if they move off
// HubSpot — and code that stays wired to the live field names doesn't rot
// against a form shape that has moved on.
//
// STATUS: dormant. It runs ONLY when WEB3FORMS_KEY is set, and that variable is
// deliberately not set in Vercel. Setting it re-enables email notification
// alongside whatever the real destination is; unsetting it turns it back off.
// That is the entire re-activation procedure.
//
// NOTE: the variable lost its PUBLIC_ prefix when it moved server-side. There is
// no reason for an access key to ship in the browser bundle any more.
// =============================================================================

import { brand } from "@/config/brand";
import type { Lead } from "@/lib/leads";

const ACCESS_KEY = import.meta.env.WEB3FORMS_KEY as string | undefined;

export const web3formsEnabled = () => Boolean(ACCESS_KEY);

/**
 * Fire-and-forget email notification. Never throws and never blocks the real
 * destination — a notification failing must not fail the user's submission.
 */
export async function notifyWeb3Forms(lead: Lead): Promise<void> {
  if (!ACCESS_KEY) return;

  const who = `${lead.firstName} ${lead.lastName}`.trim();
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: ACCESS_KEY,
        subject: `New ${brand.name} ${lead.source || lead.type}${lead.school ? ` — ${lead.school}` : ""} — ${who}`,
        from_name: `${brand.name} Website`,
        name: who,
        email: lead.email,
        phone: lead.phone || "(not provided)",
        school: lead.school ?? "",
        organization: lead.organization ?? "",
        organization_type: lead.orgType ?? "",
        message: lead.message || "(no message)",
        type: lead.source ?? lead.type,
      }),
    });
  } catch (err) {
    console.error("[web3forms] notification failed (ignored):", err);
  }
}
