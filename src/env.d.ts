/// <reference types="astro/client" />
/// Declares App.Locals.auth() / currentUser(), populated by src/middleware.ts.
/// <reference types="@clerk/astro/env" />

interface ImportMetaEnv {
  /** Web3Forms access key for the contact form (see .env.example). */
  readonly PUBLIC_WEB3FORMS_KEY: string;
  /** Clerk publishable key for the partner portal (see .env.example). */
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
