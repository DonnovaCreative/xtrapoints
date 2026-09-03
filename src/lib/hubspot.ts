// =============================================================================
// HUBSPOT — B2B contact form → CRM.
//
// Uses the Forms submission API, NOT the CRM contacts API:
//   POST /submissions/v3/integration/submit/{portalId}/{formGuid}
//
// Why the Forms API: it needs no auth token at all (portal id + form guid are
// public by design), and it runs the form's HubSpot-side automation — notification
// emails, workflows, lifecycle stage — so sales can change routing without a
// deploy. It also accepts the `hutk` cookie, which is what links a submission to
// that visitor's page-view history. The CRM API can do none of that.
//
// TWO THINGS THAT WILL BITE YOU
//
// 1. CAPTCHA. If "bot protection" is ever re-enabled on the form in HubSpot, the
//    API refuses EVERY submission with FORM_HAS_RECAPTCHA_ENABLED. Spam
//    prevention for this form is our job now (src/lib/hcaptcha.ts).
//
// 2. UNKNOWN FIELDS. HubSpot rejects the ENTIRE submission if you send a field
//    the form doesn't define. So FIELD_MAP below must mirror the HubSpot form.
//    Verified 2026-09-03 against form 06b72b72-87b2-4e70-814a-cdeb1ee40df5 —
//    required there: firstname, lastname, email, 0-2/name, 0-2/organization_type.
//
// objectTypeId: "0-1" = Contact, "0-2" = Company. `organization_type` was created
// as a COMPANY property, which is why it carries the 0-2 prefix and not 0-1.
// =============================================================================

import type { Lead } from "@/lib/leads";
import { CONSENT_COMMS_TEXT, CONSENT_PROCESS_TEXT } from "@/lib/consent";

const PORTAL_ID = import.meta.env.PUBLIC_HUBSPOT_PORTAL_ID as string | undefined;
const FORM_GUID = import.meta.env.HUBSPOT_FORM_GUID as string | undefined;

// Numeric id of the HubSpot subscription type behind the "receive other
// communications" checkbox (the form uses "One to One").
// Find it: Settings → Marketing → Email → Subscription Types → click the type;
// the id is in the URL.
//
// Without it we cannot record the COMMUNICATIONS half of consent, so the code
// degrades deliberately: it still records data-processing consent, and simply
// omits the subscription opt-in. That errs toward recording LESS consent than
// the person gave, which is the safe direction to be wrong in — the opposite
// would have us emailing people under a subscription we can't evidence.
const SUBSCRIPTION_TYPE_ID = import.meta.env.HUBSPOT_SUBSCRIPTION_TYPE_ID as
  | string
  | undefined;

/**
 * Lead field → HubSpot form field. Edit this to match the HubSpot form; if a
 * field is removed there, remove the line here or every submission starts
 * failing with UNKNOWN_FIELD.
 */
const FIELD_MAP: Array<{
  objectTypeId: "0-1" | "0-2";
  name: string;
  value: (lead: Lead) => string | undefined;
}> = [
  // Contact properties.
  { objectTypeId: "0-1", name: "firstname", value: (l) => l.firstName },
  { objectTypeId: "0-1", name: "lastname", value: (l) => l.lastName },
  { objectTypeId: "0-1", name: "email", value: (l) => l.email },
  { objectTypeId: "0-1", name: "phone", value: (l) => l.phone },
  { objectTypeId: "0-1", name: "message", value: (l) => l.message },
  // Company properties.
  { objectTypeId: "0-2", name: "name", value: (l) => l.organization },
  { objectTypeId: "0-2", name: "organization_type", value: (l) => l.orgType },
];

export interface HubSpotResult {
  ok: boolean;
  /** HubSpot's error detail, for server logs. */
  error?: string;
}

/** True when both env vars are present — lets the route skip HubSpot cleanly. */
export const hubspotConfigured = () => Boolean(PORTAL_ID && FORM_GUID);

export async function submitToHubSpot(
  lead: Lead,
  /**
   * The visitor's IP, taken from the REQUEST — never from the posted payload.
   *
   * We submit server-to-server, so without this HubSpot sees Vercel's
   * datacenter IP and (correctly) records none at all, leaving geolocation and
   * form analytics blank. Passing it restores country/region/city on the
   * contact.
   *
   * It must come from context.clientAddress rather than the request body: a
   * client-supplied IP would let anyone spoof their location in your CRM.
   */
  ipAddress?: string,
): Promise<HubSpotResult> {
  if (!hubspotConfigured()) {
    return { ok: false, error: "PUBLIC_HUBSPOT_PORTAL_ID / HUBSPOT_FORM_GUID not set" };
  }

  // Empty values are dropped rather than sent as "" — HubSpot treats an empty
  // string as a real value and will happily blank out an existing contact's
  // phone number on a repeat submission.
  const fields = FIELD_MAP.flatMap((f) => {
    const value = f.value(lead);
    return value ? [{ objectTypeId: f.objectTypeId, name: f.name, value }] : [];
  });

  // Consent. HubSpot stores the `text` next to the value as the record of what
  // the person was shown, which is why these strings come from the same module
  // the form renders from (src/lib/consent.ts) rather than being retyped here.
  //
  // ⚠ The submissions API does NOT enforce the form's required consent
  // checkboxes — a payload with no legalConsentOptions returns 200 and creates a
  // contact with no consent recorded at all. Validation in src/lib/leads.ts is
  // what actually guarantees this block is populated.
  const legalConsentOptions = {
    consent: {
      consentToProcess: Boolean(lead.consentToProcess),
      text: CONSENT_PROCESS_TEXT,
      communications:
        lead.consentToComms && SUBSCRIPTION_TYPE_ID
          ? [
              {
                value: true,
                subscriptionTypeId: Number(SUBSCRIPTION_TYPE_ID),
                text: CONSENT_COMMS_TEXT,
              },
            ]
          : [],
    },
  };

  const payload = {
    submittedAt: Date.now(),
    fields,
    legalConsentOptions,
    context: {
      // Only sent when the visitor accepted cookies and HubSpot's script set the
      // cookie. Omitted entirely otherwise — sending an empty hutk is an error.
      ...(lead.hutk ? { hutk: lead.hutk } : {}),
      ...(lead.page ? { pageUri: lead.page } : {}),
      // The page's real <title>. NOT lead.source — that's our own submission
      // label, and HubSpot groups page analytics by pageName, so putting a form
      // label here mislabels the reporting as well as the timeline entry.
      pageName: lead.pageTitle || lead.source || "XtraPoint contact form",
      ...(ipAddress ? { ipAddress } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok) return { ok: true };

    const detail = await res.text();
    return { ok: false, error: `HTTP ${res.status} — ${detail.slice(0, 500)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
