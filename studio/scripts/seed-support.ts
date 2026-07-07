// Seed the Customer Support page singleton (doc id "supportPage") into Sanity.
// Support has its own doc type + bespoke layout (structured contact card +
// rich-text sections) — separate from the legal documents.
//
//   cd studio
//   npm run seed:support              # DRAFT (review in Studio)
//   PUBLISH=1 npm run seed:support    # writes it LIVE
//
// The site (src/pages/support.astro) is a normal route reading the published
// singleton — supportPage is NOT in the Sanity→Vercel rebuild webhook, so
// publishing it does not trigger a deploy; the page updates on the next site
// build. This is SEED content — the client owns and revises it in the Studio.
import { getClient } from "./_lib.ts";
import { type Block, h2, p } from "./_pt.ts";

const client = getClient();

// Sections below the contact card (the card is rendered from the structured
// email / hours / address fields). Returns copy links to the new Refund Policy.
const body: Block[] = [
  h2("Order support"),
  p(
    "For questions about an order, please include your order number, full name, the email address used at checkout, and a brief description of the issue.",
  ),

  h2("Apple Pay orders"),
  p(
    "We accept Apple Pay for eligible online purchases. If you used Apple Pay, your payment is processed securely using the card you selected in Apple Wallet. We do not receive your full card number.",
  ),
  p(
    "For order changes, shipping questions, returns, or refunds, please contact us directly using the support information above.",
  ),

  h2("Returns and refunds"),
  p(
    "Refunds are issued according to our [Refund Policy](/refund-policy). Approved refunds will be credited back to the original payment method used at checkout, including Apple Pay where applicable.",
  ),

  h2("Response time"),
  p("We typically respond to support requests within 1–2 business days."),
];

const doc = {
  _type: "supportPage",
  title: "Customer Support",
  intro:
    "We’re here to help with questions about your order, payment, shipping, returns, refunds, or account.",
  email: "support@xtrapoint.com",
  hours: "Monday–Friday, 9:00 AM–5:00 PM CST",
  address:
    "LaCore Payments Technologies, Inc.\n900 Wilmeth Rd\nMcKinney, TX 75069\nUnited States",
  body,
};

async function run() {
  const publish = process.env.PUBLISH === "1";
  const _id = `${publish ? "" : "drafts."}supportPage`;
  await client.createOrReplace({ _id, ...doc });
  console.log(
    `✓ Customer Support ${publish ? "published (live)" : "created as a draft (review in Studio)"}.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
