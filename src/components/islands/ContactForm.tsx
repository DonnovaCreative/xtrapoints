import { useRef, useState, type FormEvent } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brand } from "@/config/brand";
import { hubspotCookie } from "@/lib/hubspotCookie";
import {
  CONSENT_INTRO,
  CONSENT_COMMS_TEXT,
  CONSENT_PROCESS_INTRO,
  CONSENT_PROCESS_TEXT,
  CONSENT_PRIVACY_PREFIX,
  CONSENT_PRIVACY_LINK_TEXT,
  CONSENT_PRIVACY_HREF,
} from "@/lib/consent";

// hCaptcha sitekey — OUR key now, paired with HCAPTCHA_SECRET which the server
// route verifies against (src/lib/hcaptcha.ts).
//
// This used to default to Web3Forms' free shared sitekey, which worked only
// because Web3Forms did the verifying. Once submissions moved to HubSpot that
// default would have left a widget users still solve and nothing checks, so
// there is deliberately no fallback value: an unset sitekey hides the widget
// rather than rendering a decorative one.
const HCAPTCHA_SITEKEY = import.meta.env.PUBLIC_HCAPTCHA_SITEKEY as string | undefined;

const ORG_TYPES = [
  "Athletic department",
  "Booster club",
  "Alumni association",
  "University",
  "Athletic foundation",
  "Club & youth sports",
  "Other",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "error";
type Errors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "email"
    | "organization"
    | "orgType"
    | "consent",
    string
  >
>;

export default function ContactForm({
  school,
  orgPlaceholder = "Bobcat Athletics Fund",
  variant = "contact",
}: {
  school?: string;
  orgPlaceholder?: string;
  /**
   * "contact" → B2B inquiry (default).
   * "signup"  → consumer get-the-app capture (name + email + phone).
   * "interest" → pre-launch interest list (name + email only).
   */
  variant?: "contact" | "signup" | "interest";
} = {}) {
  const isSignup = variant === "signup";
  const isInterest = variant === "interest";
  const isConsumer = isSignup || isInterest;
  // Captcha guards the B2B inquiry form only. The consumer waitlists post as
  // "donor" leads, which /api/lead does not captcha-check — so rendering one
  // there would be theatre. Hidden entirely if no sitekey is configured.
  const showCaptcha = !isConsumer && Boolean(HCAPTCHA_SITEKEY);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [orgType, setOrgType] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [consentProcess, setConsentProcess] = useState(false);
  const [consentComms, setConsentComms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const captchaRef = useRef<HCaptcha>(null);

  const validate = (data: Record<string, string>): Errors => {
    const e: Errors = {};
    if (!data.firstName?.trim()) e.firstName = "Please enter your first name.";
    if (!data.lastName?.trim()) e.lastName = "Please enter your last name.";
    if (!data.email?.trim())
      e.email = isConsumer ? "Please enter your email." : "Please enter your work email.";
    else if (!EMAIL_RE.test(data.email)) e.email = "Enter a valid email address.";
    if (!isConsumer) {
      if (!data.organization?.trim())
        e.organization = "Please enter your organization or program name.";
      if (!orgType) e.orgType = "Please select an organization type.";
      // Both checkboxes are required on the HubSpot form, and HubSpot does not
      // enforce that for API submissions — so this check (and its twin in
      // src/lib/leads.ts) is what actually makes the consent real.
      if (!consentProcess || !consentComms)
        e.consent = "Please check both boxes to continue.";
    }
    return e;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    // Honeypot — bots fill hidden fields; humans never see this.
    if ((fd.get("botcheck") as string)?.length) return;

    const data = {
      firstName: (fd.get("firstName") as string) ?? "",
      lastName: (fd.get("lastName") as string) ?? "",
      email: (fd.get("email") as string) ?? "",
      phone: (fd.get("phone") as string) ?? "",
      organization: (fd.get("organization") as string) ?? "",
      message: (fd.get("message") as string) ?? "",
    };

    const e = validate(data);
    setErrors(e);
    if (Object.keys(e).length) return;

    if (showCaptcha && !captchaToken) {
      setCaptchaError("Please complete the captcha.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");
    try {
      // One endpoint for every form on the site; it decides the destination.
      // "contact" → HubSpot CRM, "donor" → this school's Google Sheets tab.
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isConsumer ? "donor" : "contact",
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          school: school ?? "",
          organization: isConsumer ? "" : data.organization,
          orgType: isConsumer ? "" : orgType,
          message: isConsumer ? "" : data.message,
          source: isInterest
            ? "Donor waitlist"
            : isSignup
              ? "App sign-up"
              : "Contact form",
          page: window.location.href,
          pageTitle: document.title,
          consentToProcess: isConsumer ? undefined : consentProcess,
          consentToComms: isConsumer ? undefined : consentComms,
          hutk: hubspotCookie(),
          captchaToken,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus("success");
        form.reset();
        setOrgType("");
        setConsentProcess(false);
        setConsentComms(false);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken("");
      } else {
        setStatus("error");
        setErrorMsg(json.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg(`Network error. Please try again or email ${brand.salesEmail}.`);
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-success-500/40 bg-success-50 p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime text-on-accent">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-gray-900">
          {isInterest
            ? "You’re on the list!"
            : isSignup
              ? "You’re all set!"
              : "Thanks — we’ll be in touch."}
        </h3>
        <p className="mt-2 text-gray-600">
          {isInterest
            ? "We’ll email you the moment round-up giving goes live. Thanks for being early."
            : isSignup
              ? "We’ll email your app download link shortly — keep an eye on your inbox."
              : "Your inquiry is on its way to our team. Expect a reply within one business day."}
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-sm font-semibold text-lime-dark underline-offset-4 hover:underline"
        >
          {isConsumer ? "Add another" : "Send another message"}
        </button>
      </div>
    );
  }

  const err = (field: keyof Errors) =>
    errors[field] ? (
      <p className="mt-1.5 text-sm text-error-600">{errors[field]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* honeypot */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {/* First and last are separate fields, not one "full name" split on a
          space: HubSpot stores firstname/lastname as distinct properties, and a
          whitespace split mangles compound surnames straight into the CRM. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <Label htmlFor="firstName">First name <span className="text-error-500">*</span></Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" placeholder="Jordan" aria-invalid={!!errors.firstName} className="mt-1.5" />
          {err("firstName")}
        </div>
        <div className="flex-1">
          <Label htmlFor="lastName">Last name <span className="text-error-500">*</span></Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" placeholder="Rivera" aria-invalid={!!errors.lastName} className="mt-1.5" />
          {err("lastName")}
        </div>
      </div>

      <div>
        <Label htmlFor="email">
          {isConsumer ? "Email" : "Work email"} <span className="text-error-500">*</span>
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder={isConsumer ? "you@email.com" : "you@program.edu"} aria-invalid={!!errors.email} className="mt-1.5" />
        {err("email")}
      </div>

      {isConsumer && (
        <div>
          <Label htmlFor="phone">Mobile <span className="text-gray-400">(optional)</span></Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(555) 123-4567" className="mt-1.5" />
        </div>
      )}

      {!isConsumer && (
        <>
          <div>
            <Label htmlFor="organization">
              Organization / program name <span className="text-error-500">*</span>
            </Label>
            <Input id="organization" name="organization" placeholder={orgPlaceholder} aria-invalid={!!errors.organization} className="mt-1.5" />
            {err("organization")}
          </div>

          <div>
            <Label htmlFor="orgType">Organization type <span className="text-error-500">*</span></Label>
            <Select value={orgType} onValueChange={(v) => { setOrgType(v); setErrors((p) => ({ ...p, orgType: undefined })); }}>
              <SelectTrigger id="orgType" aria-invalid={!!errors.orgType} className="mt-1.5 w-full">
                <SelectValue placeholder="Select organization type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("orgType")}
          </div>

          <div>
            <Label htmlFor="message">Message <span className="text-gray-400">(optional)</span></Label>
            <Textarea id="message" name="message" rows={4} placeholder="Tell us about your program and what you’re hoping to launch." className="mt-1.5" />
          </div>
        </>
      )}

      {/* Consent — required on the HubSpot form, and NOT enforced by its API, so
          this is the only thing standing between a checked box and a contact
          record with no legal basis attached. Wording comes from
          src/lib/consent.ts, the same module the API payload reads, so what
          HubSpot stores as evidence is exactly what was on screen here. */}
      {!isConsumer && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
          <p className="text-sm leading-relaxed text-gray-600">{CONSENT_INTRO}</p>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="consentToComms"
              checked={consentComms}
              onChange={(ev) => {
                setConsentComms(ev.target.checked);
                setErrors((p) => ({ ...p, consent: undefined }));
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 accent-lime"
            />
            <span className="text-sm leading-relaxed text-gray-700">
              {CONSENT_COMMS_TEXT} <span className="text-error-500">*</span>
            </span>
          </label>

          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            {CONSENT_PROCESS_INTRO}
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="consentToProcess"
              checked={consentProcess}
              onChange={(ev) => {
                setConsentProcess(ev.target.checked);
                setErrors((p) => ({ ...p, consent: undefined }));
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 accent-lime"
            />
            <span className="text-sm leading-relaxed text-gray-700">
              {CONSENT_PROCESS_TEXT} <span className="text-error-500">*</span>
            </span>
          </label>

          {err("consent")}

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            {CONSENT_PRIVACY_PREFIX}
            <a
              href={CONSENT_PRIVACY_HREF}
              className="font-semibold text-lime-dark underline-offset-4 hover:underline"
            >
              {CONSENT_PRIVACY_LINK_TEXT}
            </a>
            .
          </p>
        </div>
      )}

      {showCaptcha && (
      <div>
        <HCaptcha
          ref={captchaRef}
          sitekey={HCAPTCHA_SITEKEY!}
          reCaptchaCompat={false}
          onVerify={(token) => {
            setCaptchaToken(token);
            setCaptchaError("");
          }}
          onExpire={() => setCaptchaToken("")}
          onError={() => setCaptchaToken("")}
        />
        {captchaError && (
          <p className="mt-1.5 text-sm text-error-600">{captchaError}</p>
        )}
      </div>
      )}

      {status === "error" && (
        <p role="alert" className="rounded-lg border border-error-500/30 bg-error-50 px-4 py-3 text-sm text-error-700">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={status === "submitting"}
        size="lg"
        className="rounded-full bg-lime text-on-accent hover:bg-lime-deep disabled:opacity-60"
      >
        {status === "submitting"
          ? "Sending…"
          : isInterest
            ? "Notify me at launch"
            : isSignup
              ? "Send me the app link"
              : "Get Started"}
      </Button>

      <p className="text-center text-xs text-gray-500">
        {isConsumer ? "Questions? Reach us at" : "Prefer email? Reach us at"}{" "}
        <a href={`mailto:${brand.salesEmail}`} className="font-semibold text-lime-dark hover:underline">
          {brand.salesEmail}
        </a>
      </p>
    </form>
  );
}
