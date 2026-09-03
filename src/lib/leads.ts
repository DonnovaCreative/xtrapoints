// =============================================================================
// LEAD CAPTURE — shared shape for every form on the site.
//
// Three forms, three destinations, ONE payload shape:
//   • "contact"    → HubSpot CRM   (B2B sales inquiry, /contact)
//   • "donor"      → Google Sheets (per-school donor waitlist)
//   • "ambassador" → Google Sheets (per-school ambassador waitlist)
//
// The forms don't know any of that. They POST this object to /api/lead and the
// route decides where it goes, so swapping a destination later touches one file
// instead of three React components.
// =============================================================================

/** Which form this came from. Decides the destination in /api/lead. */
export type LeadType = "contact" | "donor" | "ambassador";

export interface Lead {
  type: LeadType;

  // Every form collects these three. First/last are stored separately rather
  // than as one "full name" because HubSpot requires firstname + lastname as
  // distinct properties, and splitting a typed name on whitespace guesses wrong
  // on anyone with a compound surname ("Van Der Berg") — permanently, in the CRM.
  firstName: string;
  lastName: string;
  email: string;

  /** Consumer forms only (optional field). */
  phone?: string;
  /** School display name, e.g. "University at Albany". Empty on /contact. */
  school?: string;

  // B2B contact form only.
  organization?: string;
  orgType?: string;
  message?: string;

  // --- Consent (contact form only) -----------------------------------------
  // HubSpot's form has "Data privacy options" enabled with two REQUIRED
  // checkboxes. Critically, the submissions API does NOT enforce them: a
  // submission with no consent at all still returns 200 and creates the contact
  // with no consent recorded. So these are validated on our side, or the
  // checkboxes are decoration and the CRM quietly holds contacts with no legal
  // basis attached.
  /** "I agree to allow XtraPoint to store and process my personal data." */
  consentToProcess?: boolean;
  /** "I agree to receive other communications from XtraPoint." */
  consentToComms?: boolean;

  /** Human label for the submission, e.g. "Ambassador waitlist". */
  source?: string;
  /** URL the form was submitted from — attribution in both Sheets and HubSpot. */
  page?: string;
  /**
   * The page's actual <title>, sent as HubSpot's `pageName`.
   *
   * Distinct from `source` on purpose: `source` is our own label for the
   * submission ("Contact form", "Ambassador waitlist") and names the Sheets tab,
   * whereas HubSpot means pageName to be the page title — it groups
   * form-submission analytics by it, and renders it on the contact timeline as
   * "submitted X on <pageName>".
   */
  pageTitle?: string;
  /**
   * HubSpot's `hubspotutk` cookie, read client-side and forwarded. This is what
   * ties a submission to that browser's page-view history in HubSpot. It only
   * exists AFTER the visitor accepts cookies, so treat it as optional forever —
   * a missing hutk is a normal decline, not an error.
   */
  hutk?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-side validation. The forms validate too (for fast feedback), but a
 * POST to /api/lead is a public endpoint — anything the browser checked, the
 * server must check again.
 *
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateLead(lead: Partial<Lead>): string[] {
  const problems: string[] = [];

  if (!lead.type || !["contact", "donor", "ambassador"].includes(lead.type)) {
    problems.push("Unknown form type.");
  }
  if (!lead.firstName?.trim()) problems.push("First name is required.");
  if (!lead.lastName?.trim()) problems.push("Last name is required.");
  if (!lead.email?.trim()) problems.push("Email is required.");
  else if (!EMAIL_RE.test(lead.email.trim())) problems.push("Email is not valid.");

  // The B2B form maps onto HubSpot Company properties, both of which the form
  // in HubSpot marks required — a submission missing either is rejected there,
  // so catch it here where we can still show the user a useful message.
  if (lead.type === "contact") {
    if (!lead.organization?.trim()) problems.push("Organization is required.");
    if (!lead.orgType?.trim()) problems.push("Organization type is required.");

    // Both are marked required on the HubSpot form, and HubSpot won't enforce
    // that for API submissions — this is the only thing that does.
    if (!lead.consentToProcess) {
      problems.push("Please agree to let us store and process your data.");
    }
    if (!lead.consentToComms) {
      problems.push("Please agree to receive communications from us.");
    }
  }

  return problems;
}

/** Trim every string field, so " a@b.com " and stray tabs never reach a CRM row. */
export function normalizeLead(raw: Record<string, unknown>): Partial<Lead> {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  return {
    type: str(raw.type) as LeadType | undefined,
    firstName: str(raw.firstName),
    lastName: str(raw.lastName),
    email: str(raw.email),
    phone: str(raw.phone),
    school: str(raw.school),
    organization: str(raw.organization),
    orgType: str(raw.orgType),
    message: str(raw.message),
    consentToProcess: raw.consentToProcess === true,
    consentToComms: raw.consentToComms === true,
    source: str(raw.source),
    page: str(raw.page),
    pageTitle: str(raw.pageTitle),
    hutk: str(raw.hutk),
  };
}
