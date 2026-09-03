import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import { hubspotCookie } from "@/lib/hubspotCookie";

// Waitlist capture for the school ambassador + donor pages: first name, last
// name, email. Posts to /api/lead, which writes it to that school's tab in the
// Google Sheets workbook (see src/pages/api/lead.ts).
//
// No captcha here on purpose — this is a one-line sign-up on a page we're trying
// to convert, and a captcha would cost more real applicants than it saves in
// spam. The honeypot plus a server-side write-only endpoint is the trade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "error";
type Errors = Partial<Record<"firstName" | "lastName" | "email", string>>;

export default function WaitlistForm({
  school,
  leadType = "ambassador",
  source = "Waitlist",
  buttonLabel = "Join the waitlist",
}: {
  school?: string;
  /** Which sheet tab this lands in. */
  leadType?: "ambassador" | "donor";
  /** Tag for the submission, e.g. "Ambassador waitlist". */
  source?: string;
  buttonLabel?: string;
} = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Honeypot — bots fill hidden fields; humans never see this.
    if ((fd.get("botcheck") as string)?.length) return;

    const firstName = ((fd.get("firstName") as string) ?? "").trim();
    const lastName = ((fd.get("lastName") as string) ?? "").trim();
    const email = ((fd.get("email") as string) ?? "").trim();

    const next: Errors = {};
    if (!firstName) next.firstName = "Enter your first name.";
    if (!lastName) next.lastName = "Enter your last name.";
    if (!email) next.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: leadType,
          firstName,
          lastName,
          email,
          school: school ?? "",
          source,
          page: window.location.href,
          hutk: hubspotCookie(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
        setError(json.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setError(`Network error. Please try again or email ${brand.salesEmail}.`);
    }
  }

  if (status === "success") {
    return (
      <p
        role="status"
        className="rounded-full border border-success-500/40 bg-success-50 px-5 py-3 text-sm font-semibold text-gray-900"
      >
        🎉 You’re on the list — we’ll email you the moment enrollment opens.
      </p>
    );
  }

  const fieldError = (field: keyof Errors) =>
    errors[field] ? (
      <p className="mt-1 px-4 text-left text-sm text-error-600">{errors[field]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      {/* honeypot */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-2.5">
        {/* Names share a row on anything wider than a phone; three stacked pills
            would push the button below the fold on the enrol section. */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <Input
              name="firstName"
              required
              autoComplete="given-name"
              aria-label="First name"
              aria-invalid={!!errors.firstName}
              placeholder="First name"
              className="h-12 w-full rounded-full px-5"
            />
            {fieldError("firstName")}
          </div>
          <div className="flex-1">
            <Input
              name="lastName"
              required
              autoComplete="family-name"
              aria-label="Last name"
              aria-invalid={!!errors.lastName}
              placeholder="Last name"
              className="h-12 w-full rounded-full px-5"
            />
            {fieldError("lastName")}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              aria-label="Email address"
              aria-invalid={!!errors.email}
              placeholder="you@email.com"
              className="h-12 w-full rounded-full px-5"
            />
            {fieldError("email")}
          </div>
          <Button
            type="submit"
            disabled={status === "submitting"}
            className="h-12 shrink-0 rounded-full bg-lime px-6 font-bold text-on-accent hover:bg-lime-deep disabled:opacity-60"
          >
            {status === "submitting" ? "Joining…" : buttonLabel}
          </Button>
        </div>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-error-600">
          {error}
        </p>
      )}
    </form>
  );
}
