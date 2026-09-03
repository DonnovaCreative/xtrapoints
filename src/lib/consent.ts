// =============================================================================
// CONSENT TEXT — one source of truth, shared by the form UI and the HubSpot
// payload.
//
// This matters more than it looks. HubSpot records the consent `text` alongside
// the checkbox value, and that stored string is the evidence of what the person
// actually agreed to. If the wording rendered on the page and the wording sent
// to the API drift apart, your CRM holds a record of consent to something nobody
// was ever shown. So both sides import from here — never retype these strings.
//
// They mirror the "Data privacy options" configured on the HubSpot form
// (form 06b72b72…). If you edit the wording in HubSpot, edit it here too.
// =============================================================================

/** Intro line above the checkboxes. */
export const CONSENT_INTRO =
  "By checking the boxes below, you agree to receive communications from XtraPoint. You can unsubscribe anytime.";

/** Marketing/communications opt-in — maps to legalConsentOptions.communications. */
export const CONSENT_COMMS_TEXT =
  "I agree to receive other communications from XtraPoint.";

/** Lead-in for the data-processing checkbox. */
export const CONSENT_PROCESS_INTRO =
  "To process your request, we need your permission to store and process your personal data. Please check the box below to confirm your consent:";

/** Data-processing consent — maps to legalConsentOptions.consentToProcess. */
export const CONSENT_PROCESS_TEXT =
  "I agree to allow XtraPoint to store and process my personal data.";

/** Closing privacy line. The link target is a real published page (/privacy-policy). */
export const CONSENT_PRIVACY_PREFIX = "We care about your privacy. Learn how we handle your data in our ";
export const CONSENT_PRIVACY_LINK_TEXT = "Privacy Policy";
export const CONSENT_PRIVACY_HREF = "/privacy-policy";
