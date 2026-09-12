import { useEffect, useState } from "react";
import {
  Save,
  ExternalLink,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Link2,
  Users,
  History,
} from "lucide-react";

type Editor = {
  partnerId: string;
  revision: string;
  publishedRevision: string | null;
  slug: string;
  fields: Record<string, any>;
  hasDraft: boolean;
  published: boolean;
  portalEnabled: boolean;
  reviewStatus: string;
  livePages: { donor: boolean; ambassador: boolean };
  history: { _id: string; createdAt: string; note: string }[];
};
type Props = { school?: string; partnerId?: string; admin?: boolean; canPublish?: boolean };
const FIELD_GROUPS = [
  {
    title: "School and beneficiary",
    fields: [
      ["name", "School or organization name"],
      ["short", "Short name"],
      ["mascot", "Mascot or community name"],
      ["fund", "Fund or beneficiary organization"],
      ["city", "City"],
      ["state", "State"],
      ["fundShort", "Fund short name"],
      ["beneficiary", "Who supporters help"],
    ],
  },
  {
    title: "Your story",
    fields: [
      ["whyGiveHeading", "Story heading"],
      ["whyGiveBody", "Why give"],
      ["videoUrl", "Video URL"],
      ["videoHeading", "Video heading"],
      ["videoCaption", "Video caption"],
    ],
  },
];
const control =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
export default function SchoolEditor({
  school,
  partnerId,
  admin = false,
  canPublish = false,
}: Props) {
  const [data, setData] = useState<Editor | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState("");
  const [approved, setApproved] = useState(false);
  const [pages, setPages] = useState({ donor: true, ambassador: true });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org:admin");
  const [team, setTeam] = useState<any>(null);
  const publicationAllowed = admin || canPublish;
  const endpoint = admin ? "/api/admin-schools" : "/api/portal-school";
  function receive(next: Editor) {
    setData(next);
    setFields(next.fields);
    setPages(next.livePages);
    setDirty(false);
    setApproved(false);
  }
  async function load() {
    setError("");
    try {
      const response = await fetch(
        `${endpoint}?${new URLSearchParams(admin ? { partnerId: partnerId! } : { school: school! })}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Unable to load school.");
      receive(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [school, partnerId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(key: string, value: unknown) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setApproved(false);
    setNotice("");
  }
  async function action(name: string, extra: Record<string, unknown> = {}) {
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: name,
          partnerId: data.partnerId,
          school,
          revision: data.revision,
          publishedRevision: data.publishedRevision,
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? result.error ?? "The action could not be completed.");
      if (name === "preview") {
        setPreview(`${window.location.origin}/preview/partner/${result.token}`);
        receive(result.school);
        setNotice(
          "Private preview created. It expires in seven days; creating another replaces this link.",
        );
      } else {
        receive(result);
        setNotice(
          name === "save"
            ? "Draft saved. Your public pages still show the approved version."
            : name === "publish"
              ? "The reviewed version is published."
              : name === "review"
                ? "Your draft is ready for XtraPoint review."
                : name === "restore"
                  ? "The selected published version has been restored."
                  : "School updated.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadTeam() {
    if (!data) return;
    setError("");
    try {
      const r = await fetch(`/api/portal-access?partnerId=${encodeURIComponent(data.partnerId)}`);
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? b.error ?? "Unable to load team.");
      setTeam(b);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", partnerId: data.partnerId, email, role }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? b.error ?? "Invitation could not be sent.");
      setEmail("");
      setNotice("Invitation sent. The school will use this portal to manage its pages and brand.");
      await loadTeam();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="py-10">
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button className={button + " mt-4"} onClick={load}>
              Try again
            </button>
          </div>
        ) : (
          <p role="status" className="flex gap-2">
            <Loader2 className="animate-spin" size={20} />
            Loading school…
          </p>
        )}
      </div>
    );
  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-sm text-gray-600">
            {data.published ? "Published pages" : "Private preparation"}
            {data.hasDraft ? " · Draft changes" : ""}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{String(fields.short ?? data.slug)}</h2>
          <p className="mt-1 text-sm text-gray-600">/schools/{data.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className={button}
            href={
              admin
                ? `/admin/schools/${encodeURIComponent(data.partnerId)}/preview`
                : `/portal/${data.slug}/preview`
            }
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Preview draft
          </a>
          <button
            className={button + " bg-ink text-white border-ink"}
            disabled={busy || !dirty}
            onClick={() =>
              action("save", {
                fields: Object.fromEntries(
                  Object.entries(fields).filter(
                    ([key, value]) => JSON.stringify(value) !== JSON.stringify(data.fields[key]),
                  ),
                ),
              })
            }
          >
            <Save size={16} />
            {busy ? "Working…" : "Save draft"}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          {error}{" "}
          <button className="underline" onClick={load}>
            Reload saved details
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-gray-50 p-4">
          <CheckCircle2 size={20} className="shrink-0" />
          {notice}
        </p>
      )}
      {FIELD_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="text-lg font-bold">{group.title}</h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {group.fields.map(([key, label]) => (
              <label key={key} className={key === "whyGiveBody" ? "sm:col-span-2" : ""}>
                <span className="mb-2 block text-sm font-semibold">{label}</span>
                {key === "whyGiveBody" ? (
                  <textarea
                    rows={6}
                    className={control}
                    value={fields[key] ?? ""}
                    maxLength={4000}
                    onChange={(e) => change(key, e.target.value)}
                  />
                ) : (
                  <input
                    type={key === "videoUrl" ? "url" : "text"}
                    className={control}
                    value={fields[key] ?? ""}
                    onChange={(e) => change(key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}
      <section className="border-t border-gray-200 pt-7">
        <h3 className="text-lg font-bold">Brand and page layout</h3>
        <p className="mt-2 text-gray-600">
          Upload logos and photography in your{" "}
          <a
            href={
              admin
                ? `/admin/schools/${encodeURIComponent(data.partnerId)}/brand`
                : `/portal/${data.slug}/brand`
            }
            className="font-semibold underline"
          >
            Brand kit
          </a>
          . Your assets remain attached to this school.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ["primary", "Primary color"],
            ["secondary", "Secondary color"],
            ["ink", "Dark color"],
          ].map(([key, label]) => (
            <label key={key}>
              <span className="mb-2 block text-sm font-semibold">{label}</span>
              <input
                className={control}
                placeholder="#03116d"
                value={fields.theme?.[key] ?? ""}
                onChange={(e) => change("theme", { ...fields.theme, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-5">
          {[
            ["whiteHeader", "Light header"],
            ["logoBadge", "Logo on a white badge"],
            ["logoLockup", "Show school name beside logo"],
            ["headerHug", "Fit header to logo"],
            ["headerPadding", "Add header padding"],
          ].map(([key, label]) => (
            <label key={key} className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={fields[key] ?? key === "headerPadding"}
                onChange={(e) => change(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-5 block max-w-xs">
          <span className="mb-2 block text-sm font-semibold">Logo size</span>
          <select
            className={control}
            value={fields.logoSize ?? "md"}
            onChange={(e) => change("logoSize", e.target.value)}
          >
            {[
              ["sm", "Small"],
              ["md", "Standard"],
              ["lg", "Large"],
              ["xl", "Extra large"],
              ["2xl", "Maximum"],
              ["custom", "Custom height"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {fields.logoSize === "custom" && (
          <label className="mt-4 block max-w-xs">
            Logo height (24–120 px)
            <input
              className={control}
              type="number"
              min={24}
              max={120}
              value={fields.logoHeight ?? 40}
              onChange={(e) => change("logoHeight", Number(e.target.value))}
            />
          </label>
        )}
      </section>
      <section className="border-t border-gray-200 pt-7">
        <h3 className="text-lg font-bold">Ambassador program</h3>
        <p className="mt-2 max-w-2xl text-gray-600">
          Your organization chooses and funds rewards, adopts its terms and operates the program.
          Supporter qualification requires three completed monthly donations in three consecutive
          months.
        </p>
        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={fields.tiersToBeAnnounced === true}
            onChange={(e) => change("tiersToBeAnnounced", e.target.checked)}
          />
          Show rewards as to be announced
        </label>
        <div className="mt-5 space-y-4">
          {(fields.ambassadorTiers ?? []).map((tier: any, index: number) => (
            <div key={tier._key ?? index} className="rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">Reward level {index + 1}</h4>
                <button
                  className="text-sm underline"
                  onClick={() =>
                    change(
                      "ambassadorTiers",
                      fields.ambassadorTiers.filter((_: any, i: number) => i !== index),
                    )
                  }
                >
                  Remove level
                </button>
              </div>
              {[
                ["name", "Level name"],
                ["role", "Description"],
                ["perks", "Benefits (one per line)"],
              ].map(([key, label]) => (
                <label key={key} className="mt-3 block text-sm">
                  {label}
                  <textarea
                    className={control + " mt-1"}
                    rows={key === "perks" ? 3 : 1}
                    value={key === "perks" ? (tier.perks ?? []).join("\n") : (tier[key] ?? "")}
                    onChange={(e) =>
                      change(
                        "ambassadorTiers",
                        fields.ambassadorTiers.map((t: any, i: number) =>
                          i === index
                            ? {
                                ...t,
                                [key]:
                                  key === "perks" ? e.target.value.split("\n") : e.target.value,
                              }
                            : t,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <button
          className={button + " mt-4"}
          disabled={(fields.ambassadorTiers ?? []).length >= 12}
          onClick={() =>
            change("ambassadorTiers", [
              ...(fields.ambassadorTiers ?? []),
              { _key: crypto.randomUUID(), name: "", role: "", perks: [] },
            ])
          }
        >
          Add reward level
        </button>
        <div className="mt-6 space-y-4">
          {(fields.ambassadorPrograms ?? []).map((program: any, index: number) => (
            <div key={program._key ?? index} className="border-t border-gray-200 pt-4">
              <label className="block text-sm">
                Program section title
                <input
                  className={control + " mt-1"}
                  value={program.title}
                  onChange={(e) =>
                    change(
                      "ambassadorPrograms",
                      fields.ambassadorPrograms.map((p: any, i: number) =>
                        i === index ? { ...p, title: e.target.value } : p,
                      ),
                    )
                  }
                />
              </label>
              <label className="mt-3 block text-sm">
                Description
                <textarea
                  className={control + " mt-1"}
                  rows={3}
                  value={program.body ?? ""}
                  onChange={(e) =>
                    change(
                      "ambassadorPrograms",
                      fields.ambassadorPrograms.map((p: any, i: number) =>
                        i === index ? { ...p, body: e.target.value } : p,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="mt-2 text-sm underline"
                onClick={() =>
                  change(
                    "ambassadorPrograms",
                    fields.ambassadorPrograms.filter((_: any, i: number) => i !== index),
                  )
                }
              >
                Remove section
              </button>
            </div>
          ))}
        </div>
        <button
          className={button + " mt-4"}
          disabled={(fields.ambassadorPrograms ?? []).length >= 12}
          onClick={() =>
            change("ambassadorPrograms", [
              ...(fields.ambassadorPrograms ?? []),
              { _key: crypto.randomUUID(), title: "", body: "" },
            ])
          }
        >
          Add program section
        </button>
      </section>
      <section className="rounded-xl bg-gray-50 p-6">
        <h3 className="text-lg font-bold">
          {publicationAllowed ? "Preview and publication" : "Ready for review"}
        </h3>
        <p className="mt-2 text-gray-600">
          Save your draft, inspect both preview pages, and confirm the content with your
          organization.
        </p>
        {publicationAllowed ? (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              {admin && (
                <button
                  className={button}
                  disabled={busy || dirty}
                  onClick={() => action("preview")}
                >
                  <Link2 size={16} />
                  Create private sales preview
                </button>
              )}
              {data.published && (data.livePages.donor || data.livePages.ambassador) && (
                <a
                  className={button}
                  href={data.livePages.donor ? `/schools/${data.slug}` : `/schools/${data.slug}/ambassadors`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View published page
                </a>
              )}
            </div>
            {preview && (
              <div className="mt-4">
                <label className="text-sm font-semibold">
                  Private preview link
                  <input className={control + " mt-2"} readOnly value={preview} />
                </label>
                <a
                  href={preview}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block underline"
                >
                  Open private preview
                </a>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-5">
              {(["donor", "ambassador"] as const).map((key) => (
                <label key={key} className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={pages[key]}
                    onChange={(e) => setPages({ ...pages, [key]: e.target.checked })}
                  />
                  {key === "donor" ? "Donor page" : "Ambassador page"}
                </label>
              ))}
            </div>
            <label className="mt-5 flex items-start gap-3">
              <input
                className="mt-1"
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>
                Our organization approved this exact saved draft and the selected pages for
                publication.
              </span>
            </label>
            <div className="mt-4 flex gap-3">
              <button
                className={button + " bg-ink text-white"}
                disabled={busy || dirty || !approved || (!pages.donor && !pages.ambassador)}
                onClick={() => action("publish", { partnerApproved: approved, livePages: pages })}
              >
                Publish approved version
              </button>
              {admin && data.published && (
                <button className={button} disabled={busy || dirty} onClick={() => action("pause")}>
                  Pause public pages
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            className={button + " mt-5 bg-ink text-white"}
            disabled={busy || dirty}
            onClick={() => action("review")}
          >
            Request publication review
          </button>
        )}
      </section>
      {admin && (
        <section className="border-t border-gray-200 pt-7">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Users size={21} />
            Hand off to the school
          </h3>
          <p className="mt-2 text-gray-600">
            Enable portal access, then invite the school's administrator. Their pages can remain
            private while they prepare.
          </p>
          {!data.publishedRevision && (
            <button
              className={button + " mt-4"}
              disabled={busy || dirty}
              onClick={() => action("prepare")}
            >
              Prepare retained school for access
            </button>
          )}
          <button
            className={button + " mt-4"}
            disabled={busy || dirty || !data.publishedRevision}
            onClick={() => action("access", { enabled: !data.portalEnabled })}
          >
            {data.portalEnabled ? "Disable partner access" : "Enable partner access"}
          </button>
          <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={invite}>
            <label className="min-w-60 flex-1 text-sm font-semibold">
              School contact email
              <input
                className={control + " mt-2"}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              Role
              <select
                className={control + " mt-2"}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="org:admin">Administrator</option>
                <option value="org:member">Editor</option>
              </select>
            </label>
            <button
              className={button + " bg-ink text-white"}
              disabled={busy || dirty || !data.portalEnabled}
            >
              Send invitation
            </button>
          </form>
          <button className="mt-4 text-sm font-semibold underline" onClick={loadTeam}>
            View team and invitations
          </button>
          {team && (
            <div className="mt-4 space-y-2">
              {(team.members ?? []).map((m: any) => (
                <p key={m.userId ?? m.id} className="text-sm">
                  {m.email ?? m.name ?? m.userId} — {m.role}
                </p>
              ))}
              {(team.invitations ?? []).map((i: any) => (
                <p key={i.id} className="text-sm">
                  {i.emailAddress ?? i.email} — Invitation {i.status ?? "pending"}
                </p>
              ))}
              {!(team.members?.length || team.invitations?.length) && (
                <p>No team members or pending invitations.</p>
              )}
            </div>
          )}
        </section>
      )}
      {publicationAllowed && data.history.length > 0 && (
        <section className="border-t border-gray-200 pt-7">
          <h3 className="flex gap-2 items-center text-lg font-bold">
            <History size={21} />
            Published versions
          </h3>
          <p className="mt-2 text-gray-600">
            Restoring a version changes the public pages. Your working draft remains available.
          </p>
          <ul className="mt-4 divide-y divide-gray-200">
            {data.history.map((item) => (
              <li key={item._id} className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">{item.note}</p>
                </div>
                <button
                  className={button}
                  disabled={busy || dirty}
                  onClick={() => action("restore", { releaseId: item._id })}
                >
                  Restore version
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
