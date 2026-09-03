/// <reference types="astro/client" />
/// Declares App.Locals.auth() / currentUser(), populated by src/middleware.ts.
/// <reference types="@clerk/astro/env" />

interface ImportMetaEnv {
  // --- Public (shipped to the browser) -------------------------------------
  /** Clerk publishable key for the partner portal (see .env.example). */
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  /** hCaptcha sitekey rendered on the contact form. */
  readonly PUBLIC_HCAPTCHA_SITEKEY: string;
  /** HubSpot portal/hub id — public by design; used by the tracking script. */
  readonly PUBLIC_HUBSPOT_PORTAL_ID: string;

  // --- Server only (never give these a PUBLIC_ prefix) ---------------------
  /** hCaptcha secret, verified in src/lib/hcaptcha.ts. */
  readonly HCAPTCHA_SECRET: string;
  /** GUID of the HubSpot form the contact page submits to. */
  readonly HUBSPOT_FORM_GUID: string;
  /** Subscription type id behind the communications-consent checkbox. */
  readonly HUBSPOT_SUBSCRIPTION_TYPE_ID: string;
  /** Apps Script /exec URL for the waitlist workbook (src/lib/leadSheet.ts). */
  readonly SHEETS_WEBHOOK_URL: string;
  /** Shared secret the Apps Script checks before appending a row. */
  readonly SHEETS_SECRET: string;
  /** ARCHIVED — set only to re-enable Web3Forms email notification. */
  readonly WEB3FORMS_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
