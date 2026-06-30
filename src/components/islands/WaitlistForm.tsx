import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";

// Compact, single-field waitlist capture (email + submit). Posts to Web3Forms,
// same key/inbox as the contact form. A honeypot is the spam guard — no visible
// captcha, to keep it a true one-line sign-up.
const ACCESS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY as string | undefined;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm({
  school,
  source = "Waitlist",
  buttonLabel = "Join the waitlist",
  placeholder = "you@email.com",
}: {
  school?: string;
  /** Tag for the submission + subject line, e.g. "Ambassador waitlist". */
  source?: string;
  buttonLabel?: string;
  placeholder?: string;
} = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Honeypot — bots fill hidden fields; humans never see this.
    if ((fd.get("botcheck") as string)?.length) return;

    const email = ((fd.get("email") as string) ?? "").trim();
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }
    if (!ACCESS_KEY) {
      setError("Form isn’t configured yet — add PUBLIC_WEB3FORMS_KEY to .env.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `New ${brand.name} ${source}${school ? ` — ${school}` : ""} — ${email}`,
          from_name: `${brand.name} Website`,
          email,
          type: source,
          school: school ?? "",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
        setError(json.message || "Something went wrong. Please try again.");
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
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          aria-label="Email address"
          placeholder={placeholder}
          className="h-12 flex-1 rounded-full px-5"
        />
        <Button
          type="submit"
          disabled={status === "submitting"}
          className="h-12 shrink-0 rounded-full bg-lime px-6 font-bold text-on-accent hover:bg-lime-deep disabled:opacity-60"
        >
          {status === "submitting" ? "Joining…" : buttonLabel}
        </Button>
      </div>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-error-600">
          {error}
        </p>
      )}
    </form>
  );
}
