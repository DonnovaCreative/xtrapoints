import { useState, type FormEvent } from "react";
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

// Web3Forms access key. Create a key for sales@xtrapoints.com at
// https://web3forms.com and add it to .env as PUBLIC_WEB3FORMS_KEY.
const ACCESS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY as string | undefined;

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
type Errors = Partial<Record<"name" | "email" | "organization" | "orgType", string>>;

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [orgType, setOrgType] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const validate = (data: Record<string, string>): Errors => {
    const e: Errors = {};
    if (!data.name?.trim()) e.name = "Please enter your full name.";
    if (!data.email?.trim()) e.email = "Please enter your work email.";
    else if (!EMAIL_RE.test(data.email)) e.email = "Enter a valid email address.";
    if (!data.organization?.trim())
      e.organization = "Please enter your organization or program name.";
    if (!orgType) e.orgType = "Please select an organization type.";
    return e;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    // Honeypot — bots fill hidden fields; humans never see this.
    if ((fd.get("botcheck") as string)?.length) return;

    const data = {
      name: (fd.get("name") as string) ?? "",
      email: (fd.get("email") as string) ?? "",
      organization: (fd.get("organization") as string) ?? "",
      message: (fd.get("message") as string) ?? "",
    };

    const e = validate(data);
    setErrors(e);
    if (Object.keys(e).length) return;

    if (!ACCESS_KEY) {
      setStatus("error");
      setErrorMsg(
        "Form isn’t configured yet — add PUBLIC_WEB3FORMS_KEY to .env. (See README.)",
      );
      return;
    }

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `New XtraPoints inquiry from ${data.organization}`,
          from_name: "XtraPoints Website",
          name: data.name,
          email: data.email,
          organization: data.organization,
          organization_type: orgType,
          message: data.message || "(no message)",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus("success");
        form.reset();
        setOrgType("");
      } else {
        setStatus("error");
        setErrorMsg(json.message || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again or email sales@xtrapoints.com.");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-success-500/40 bg-success-50 p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-gray-900">Thanks — we’ll be in touch.</h3>
        <p className="mt-2 text-gray-600">
          Your inquiry is on its way to our team. Expect a reply within one business day.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-sm font-semibold text-lime-dark underline-offset-4 hover:underline"
        >
          Send another message
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

      <div>
        <Label htmlFor="name">Full name <span className="text-error-500">*</span></Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Jordan Rivera" aria-invalid={!!errors.name} className="mt-1.5" />
        {err("name")}
      </div>

      <div>
        <Label htmlFor="email">Work email <span className="text-error-500">*</span></Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@program.edu" aria-invalid={!!errors.email} className="mt-1.5" />
        {err("email")}
      </div>

      <div>
        <Label htmlFor="organization">
          Organization / program name <span className="text-error-500">*</span>
        </Label>
        <Input id="organization" name="organization" placeholder="Bobcat Athletics Fund" aria-invalid={!!errors.organization} className="mt-1.5" />
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

      {status === "error" && (
        <p role="alert" className="rounded-lg border border-error-500/30 bg-error-50 px-4 py-3 text-sm text-error-700">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={status === "submitting"}
        size="lg"
        className="rounded-full bg-lime text-ink hover:bg-lime-deep disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Get Started"}
      </Button>

      <p className="text-center text-xs text-gray-500">
        Prefer email? Reach us at{" "}
        <a href="mailto:sales@xtrapoints.com" className="font-semibold text-lime-dark hover:underline">
          sales@xtrapoints.com
        </a>
      </p>
    </form>
  );
}
