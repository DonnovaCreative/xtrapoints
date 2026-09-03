// =============================================================================
// hCAPTCHA VERIFICATION (server side).
//
// WHY THIS FILE EXISTS: the contact form has rendered an hCaptcha widget for a
// while, but nothing in OUR code ever checked the token — Web3Forms verified it,
// using Web3Forms' own shared sitekey. The moment Web3Forms was archived (see
// src/lib/web3forms.ts) that widget would have become purely decorative: still
// rendered, still clicked by users, verified by nobody. A captcha you think is
// protecting you and isn't is worse than no captcha at all, so verification
// moved here, against our own hCaptcha account.
//
// Needs BOTH:
//   PUBLIC_HCAPTCHA_SITEKEY  — rendered by the widget (safe in the browser)
//   HCAPTCHA_SECRET          — server only, NEVER give this a PUBLIC_ prefix
// =============================================================================

const VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export interface CaptchaResult {
  ok: boolean;
  /** Why it failed, for server logs — never shown to the user verbatim. */
  reason?: string;
}

/**
 * Verify an hCaptcha token with hCaptcha's API.
 *
 * Fails CLOSED when a secret is configured but the token is bad. Fails OPEN
 * (returns ok) when HCAPTCHA_SECRET is unset — otherwise every local dev and
 * preview deploy without the secret would silently reject real submissions,
 * which is a much more likely outcome than a bot finding a preview URL.
 */
export async function verifyCaptcha(
  token: string | undefined,
  remoteIp?: string,
): Promise<CaptchaResult> {
  const secret = import.meta.env.HCAPTCHA_SECRET as string | undefined;

  if (!secret) {
    console.warn("[hcaptcha] HCAPTCHA_SECRET not set — skipping verification.");
    return { ok: true };
  }
  if (!token) return { ok: false, reason: "no token supplied" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (json.success) return { ok: true };
    return { ok: false, reason: (json["error-codes"] ?? []).join(", ") || "rejected" };
  } catch (err) {
    // hCaptcha being unreachable must not eat a real sales lead. Log loudly and
    // let the submission through — the honeypot is still in play.
    console.error("[hcaptcha] verification request failed, allowing through:", err);
    return { ok: true };
  }
}
