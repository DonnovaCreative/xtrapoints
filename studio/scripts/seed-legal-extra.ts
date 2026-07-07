// Seed the donation-platform legal documents into Sanity as `legalPage` docs, so
// the client's team manages them in the Studio (Legal & Compliance → Legal
// Documents) alongside Terms & Privacy (same rendering, TOC, cross-links,
// auto-rebuild). The Customer Support page is a separate doc type — see
// scripts/seed-support.ts.
//
//   cd studio
//   npm run seed:legal-extra              # DRAFTS (review in Studio / preview)
//   PUBLISH=1 npm run seed:legal-extra    # publishes Refund live
//                                         # (Cookie stays a draft either way)
//
// Pages:
//   • Refund Policy     (/refund-policy)  — a starting point for counsel.
//   • Cookie Policy     (/cookie-policy)  — ALWAYS a draft: no tracking yet, so
//     it stays off the live site until the client enables analytics + publishes.
//
// This is SEED content — the client owns and revises it in the Studio, and is
// responsible for having it reviewed by counsel before relying on it.
import { getClient } from "./_lib.ts";
import { type Block, h2, p, bullets } from "./_pt.ts";

const client = getClient();

const EFFECTIVE = "2026-07-07";

// --- Refund Policy (starting point for counsel) -----------------------------
const refundBody: Block[] = [
  p(
    "This Refund Policy explains when and how refunds are issued for donations made through XtraPoint. XtraPoint is a DBA of LaCore Payments Technologies, Inc. Because your contributions support a designated organization, refund eligibility depends on whether the funds have already been transferred to that organization.",
  ),

  h2("Refund eligibility"),
  p("You may be eligible for a refund in the following circumstances:"),
  ...bullets([
    "**Unauthorized transactions** — a charge you did not authorize.",
    "**Duplicate charges** — the same donation processed more than once.",
    "**Technical or processing errors** — an incorrect amount, or a charge caused by a system error.",
    "**Pending donations** — a contribution that has not yet been transferred to the designated organization.",
  ]),

  h2("Donations transferred to a designated organization"),
  p(
    "Once a donation has been transferred to the designated organization you selected, XtraPoint may no longer be able to issue a refund. In those cases, please contact the designated organization directly; we will help coordinate a resolution where we can.",
  ),

  h2("How refunds are issued"),
  p(
    "Approved refunds are credited back to the original payment method used at the time of the donation, including Apple Pay where applicable. Refund timing depends on your bank or card issuer and typically appears within 5–10 business days after approval.",
  ),

  h2("How to request a refund"),
  p(
    "To request a refund, contact us at [support@xtrapoint.com](mailto:support@xtrapoint.com) and include the transaction date, amount, the payment method used, and a brief description of the issue. See our [Support](/support) page for full contact details and hours.",
  ),

  h2("Changes to this policy"),
  p(
    "We may update this Refund Policy from time to time. Any changes will be posted on this page with a revised effective date. Your continued use of XtraPoint after changes are posted constitutes acceptance of the updated policy.",
  ),
];

// --- Cookie Policy (draft — no tracking in use yet) -------------------------
const cookieBody: Block[] = [
  p(
    "This Cookie Policy explains how XtraPoint uses cookies and similar technologies on our websites. XtraPoint is a DBA of LaCore Payments Technologies, Inc.",
  ),

  h2("What are cookies?"),
  p(
    "Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide information to the site’s owners.",
  ),

  h2("How we use cookies"),
  p(
    "We currently use only strictly necessary cookies that are required for our website to function — for example, remembering your preferences and keeping the site secure. We do not currently use analytics, advertising, or third-party tracking cookies. If that changes, we will update this policy and, where required, ask for your consent.",
  ),

  h2("Managing cookies"),
  p(
    "Most web browsers let you control cookies through their settings, including blocking or deleting them. Because we currently use only strictly necessary cookies, disabling them may affect how parts of the site work.",
  ),

  h2("Changes to this policy"),
  p(
    "We will update this Cookie Policy if our use of cookies changes — for example, if we introduce analytics or other tracking. Any changes will be posted on this page with a revised effective date.",
  ),
];

interface Page {
  slug: string;
  title: string;
  navLabel: string;
  body: Block[];
  /** Always seed as a draft, regardless of PUBLISH (Cookie: no tracking yet). */
  alwaysDraft?: boolean;
}

const PAGES: Page[] = [
  { slug: "refund-policy", title: "Refund Policy", navLabel: "Refund", body: refundBody },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    navLabel: "Cookie",
    body: cookieBody,
    alwaysDraft: true,
  },
];

async function run() {
  const publish = process.env.PUBLISH === "1";
  console.log(`Seeding ${PAGES.length} legal document(s)…`);
  for (const pg of PAGES) {
    const asDraft = pg.alwaysDraft || !publish;
    const _id = `${asDraft ? "drafts." : ""}legalPage.${pg.slug}`;
    await client.createOrReplace({
      _id,
      _type: "legalPage",
      title: pg.title,
      navLabel: pg.navLabel,
      slug: { _type: "slug", current: pg.slug },
      lastUpdated: EFFECTIVE,
      body: pg.body,
    });
    console.log(`  ✓ /${pg.slug}${asDraft ? " (draft)" : " (published)"}`);
  }
  console.log(
    publish
      ? "Done — Refund published; Cookie left as a draft."
      : "Done — all created as drafts. Review in the Studio, then publish (PUBLISH=1).",
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
