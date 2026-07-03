// Seed the two legal pages (Terms & Conditions, Privacy Policy) into Sanity.
//
//   cd studio
//   npm run seed:legal              # creates DRAFTS (review in Studio, then Publish)
//   PUBLISH=1 npm run seed:legal    # writes them LIVE
//
// Content is derived from LaCore's LPT pages (lpt.io/terms, lpt.io/privacy-policy)
// and adjusted to XtraPoint's context: XtraPoint is a DBA of LaCore Payments
// Technologies, Inc. — so the operating brand/defined term is "XtraPoint" while
// the binding legal entity, "LaCore Payments Technologies, Inc.", is preserved.
// The Department Contacts section was intentionally dropped.
//
// This is SEED content — editors own it in the Studio afterward. A few items to
// confirm with counsel there: the contact email (support@lacorepayments.com, the
// operating entity's inbox) and the Melissa, TX mailing address.
import { getClient } from "./_lib.ts";

const client = getClient();

// --- tiny Portable Text builder -------------------------------------------
// Deterministic keys (no Math.random) so re-running produces stable documents.
let keySeq = 0;
const key = (p: string) => `${p}${(keySeq++).toString(36)}`;

interface Span {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}
interface MarkDef {
  _key: string;
  _type: "link";
  href: string;
}
interface Block {
  _type: "block";
  _key: string;
  style: string;
  markDefs: MarkDef[];
  children: Span[];
  listItem?: "bullet" | "number";
  level?: number;
}

// Parse inline `[label](href)` links and `**strong**` runs into spans + markDefs.
function inline(text: string): { children: Span[]; markDefs: MarkDef[] } {
  const markDefs: MarkDef[] = [];
  const children: Span[] = [];
  const push = (t: string, marks: string[] = []) => {
    if (t) children.push({ _type: "span", _key: key("s"), text: t, marks });
  };
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const dk = key("l");
      markDefs.push({ _key: dk, _type: "link", href: m[2] });
      children.push({ _type: "span", _key: key("s"), text: m[1], marks: [dk] });
    } else {
      children.push({ _type: "span", _key: key("s"), text: m[3], marks: ["strong"] });
    }
    last = re.lastIndex;
  }
  push(text.slice(last));
  if (children.length === 0) push("");
  return { children, markDefs };
}

const block = (style: string, text: string, extra: Partial<Block> = {}): Block => {
  const { children, markDefs } = inline(text);
  return { _type: "block", _key: key("b"), style, markDefs, children, ...extra };
};
const h2 = (t: string) => block("h2", t);
const h3 = (t: string) => block("h3", t);
const p = (t: string) => block("normal", t);
const bullets = (items: string[]) =>
  items.map((t) => block("normal", t, { listItem: "bullet", level: 1 }));

// --- content ----------------------------------------------------------------
const EFFECTIVE = "2026-07-03";

const privacyBody: Block[] = [
  p(
    'This Privacy Policy ("Privacy Policy") governs the XtraPoint network of applications and websites. XtraPoint is a DBA of LaCore Payments Technologies, Inc. ("XtraPoint," "we," "us," or "our"). This Privacy Policy is in effect for all Websites owned and operated by XtraPoint. By using any of the Websites, you signify that you have read, understand and agree to be bound by this Privacy Policy.',
  ),
  p(
    "This policy applies to all online communication with Websites owned by XtraPoint or its affiliated companies. When you provide us with online information through any of the Websites, we respect your privacy. It is important for you to understand what information we collect about you during your visit and what we do with that information. Your visit to any of our Websites is subject to this Privacy Policy and our [Terms & Conditions](/terms).",
  ),

  h2("What information do we collect?"),
  p(
    "You may browse our Websites without providing any personal information. If you decide to request additional information or make application, we will ask you for your name, company name, billing address, phone number(s), email address, banking information, prior credit card history, and other information. If you choose to register to become a PayFac affiliate with XtraPoint, we may ask you for information such as your contact information (e.g., name, mobile number, e-mail address and mailing address), or birth date. When you submit your personally identifiable information on one of the Websites, you are giving your consent to the collection, use and disclosure of your personal information as set forth in this Privacy Policy.",
  ),
  p(
    "We may also collect, store or accumulate certain non-personally identifiable information concerning your use of this Website, such as information regarding which of our pages are most popular, your IP address, browser, city, time zone, referring URL, and operating system. Information gathered may be used in aggregate form for internal business purposes, such as generating statistics, developing marketing plans, customizing content, and improving the Website. We may share or transfer any non-personally identifiable information with or to our affiliates, licensees and partners.",
  ),
  p(
    "All of our Websites are intended for adults. We do not knowingly collect personal information from children under the age of 13. However, if the parent or guardian of a child under 13 believes that the child has provided us with personally identifiable information, the parent or guardian of that child should contact us at [support@lacorepayments.com](mailto:support@lacorepayments.com) if they want this information deleted from our files so that it is not in retrievable form. If we otherwise obtain knowledge that we have personally identifiable information about a child under 13 in retrievable form in our files, we will delete that information from our existing files so that it is not retrievable.",
  ),

  h2("Protection of Personal Information"),
  p(
    "XtraPoint may use the information that you provide to fulfill your request for PayFac information, or other service, or respond to an email or other request, as well as to create and deliver to you communications containing program information and usage tips. XtraPoint may also use your personally identifiable information to send you information about business opportunities, products, services and special offers. However, we want to communicate with you via email correspondence only if you want to hear from us. If for any reason you no longer wish to receive email messages from XtraPoint, other than those that involve processing notifications, please unsubscribe in your back office, or via the unsubscribe link provided at the bottom of the email announcement.",
  ),
  p(
    'Please note, if you opt not to receive marketing emails and/or messages from XtraPoint you may still receive "Transactional" messages regarding your service (i.e. order confirmation, customer service notifications, etc.) If you have questions or concerns regarding this statement, contact us at [support@lacorepayments.com](mailto:support@lacorepayments.com).',
  ),
  p(
    "We may contract with companies or individuals to provide certain services including email and hosting services, credit card processing, shipping, data management, surveys and marketing, promotional services, etc. We call them our Service Providers. We may share personally identifiable information with Service Providers solely as appropriate for them to perform their functions, but they may not use such information for any other purpose.",
  ),
  p(
    "We do not share your credit card or other personal or company information with unaffiliated third parties unless necessary to fulfill our responsibilities including, but not limited to, delivering a product or service that you order.",
  ),
  p(
    "Finally, XtraPoint may disclose personal information in special cases: (1) when we have reason to believe that disclosing this information is necessary to identify, contact, or bring legal action against someone who may be causing injury to or interference with (either intentionally or unintentionally) the rights of XtraPoint or to anyone that could be harmed by such activities; (2) when we believe in good faith that the law requires it; (3) to any third party who may acquire XtraPoint or LaCore Payments Technologies, Inc.; and (4) in situations involving threats to the physical safety of any person.",
  ),

  h2("Ensuring Your Security"),
  p(
    "We use Transport Layer Security (TLS), an advanced security protocol that protects your credit card information and ensures secure online ordering. TLS Internet connections are encrypted, and thus protect all personal and company information, including your name, address and credit card number, so it cannot be read in transit. We use secure technology, privacy protection controls, and restrictions on employee access, to safeguard your personal information. Please note, however, that although we employ industry-standard security measures to safeguard the security of your personal information, no transmissions made on or through the Internet are guaranteed to be secure.",
  ),

  h2("External Websites"),
  p(
    "Our Websites and/or Application may offer links to and from other third party sites. Other sites have their own policies regarding privacy. If you visit one of these sites, you may want to review the privacy policy on that site.",
  ),

  h2("International Users"),
  p(
    "Like almost every website, our Websites may be accessed by an international audience. By visiting our Websites and providing us with data, you acknowledge and agree that your personal information may be processed for the purposes identified in this policy. In addition, such data may be stored on servers located outside your resident jurisdiction and in jurisdictions which may have less stringent privacy practices than your own. By providing us with your data, you consent to the transfer of such data.",
  ),

  h2("Your California Privacy Rights"),
  p(
    "California Civil Code Section 1798.83 permits customers of XtraPoint who are California residents to request and obtain from us once a year, free of charge, information about the personal information (if any) we disclosed to third parties for direct marketing purposes in the preceding calendar year. If applicable, this information would include a list of the categories of personal information that was shared and the names and addresses of all third parties with which we shared information in the immediately preceding twelve calendar months. If you are a California resident and would like to make such a request, please submit your request in writing to:",
  ),
  p(
    "Chief Operating Officer & General Counsel, XtraPoint (a DBA of LaCore Payments Technologies, Inc.), 901 Sam Rayburn Highway, Melissa, Texas 75454.",
  ),

  h2("Changes to Policy"),
  p(
    "We may revise this Privacy Policy from time to time. If we decide to change our Privacy Policy, we will post the revised policy here. As we may make changes at any time without notifying you, we suggest that you periodically consult this Privacy Policy. Your continued use of the Website after the changes are posted constitutes your agreement to the changes, both with regard to information we have previously collected from you and with regard to information we collect from you in the future. If you do not agree to the changes, please discontinue your use of our Website/Application.",
  ),
];

const termsBody: Block[] = [
  p(
    'These Terms & Conditions (this "Agreement") govern your access to and use of the XtraPoint website and services. XtraPoint is a DBA of LaCore Payments Technologies, Inc. (referred to in this Agreement as "XtraPoint," the "Company," "we," or "us"). Please read this Agreement carefully. By accessing or using the Website, you agree to be bound by it.',
  ),

  h2("Privacy & Security Disclosure"),
  p(
    "The Company's privacy policy may be viewed at [xtrapoint.com/privacy-policy](/privacy-policy). The Company reserves the right to modify its privacy policy in its reasonable discretion from time to time.",
  ),
  p("When completing an application online, you will need:"),
  ...bullets([
    "Company Information",
    "Personal Information",
    "Prior Processing Information",
    "Banking Information",
  ]),
  p("These terms are an agreement between you and XtraPoint (a DBA of LaCore Payments Technologies, Inc.):"),
  p(
    "XtraPoint (a DBA of LaCore Payments Technologies, Inc.), 901 Sam Rayburn Highway, Melissa, Texas 75454. E-Mail: [support@lacorepayments.com](mailto:support@lacorepayments.com).",
  ),

  h2("Third Party Interactions"),
  p(
    "During use of the Company Website, you may enter into correspondence with, or sponsors showing their goods and/or services through the Website. Any such activity, and any terms, conditions, warranties or representations associated with such activity, is solely between you and the applicable third-party. Company shall have no liability, obligation or responsibility for any such correspondence, purchase or promotion between you and any such third party. Company does not endorse any sites on the Internet that are linked through its Website. Company provides these links to you only as a matter of convenience, and in no event shall Company be responsible for any content, products, or other materials on or available from such sites. Company provides products to you pursuant to the terms and conditions of this Agreement. You recognize, however, that certain third-party providers of ancillary software, hardware or services may require your agreement to additional or different license or other terms prior to your use of or access to such software, hardware or services.",
  ),

  h2("Notice"),
  p(
    "Company may give notice by means of a general notice on the www.xtrapoint.com Website, electronic mail to your e-mail address on record in Company's account information, or by written communication sent by first class mail or pre-paid post to your address on record in Company's account information. Such notice shall be deemed to have been given upon the expiration of 48 hours after mailing or posting (if sent by first class mail or pre-paid post) or 24 hours after sending (if sent by e-mail). You may give notice to Company (such notice shall be deemed given when received by Company) at any time by any of the following: letter sent by confirmed facsimile to Company at the following address delivered by nationally recognized overnight delivery service or first class postage prepaid mail to Company at the following address: 901 Sam Rayburn Highway, Melissa, Texas 75454 in either case, addressed to the attention of: Chief Operating Officer & General Counsel.",
  ),

  h2("Modification to Terms"),
  p(
    "Company reserves the right to modify the terms and conditions of this Agreement or its policies relating to its products and services at any time, effective upon posting of an updated version of these terms at the www.xtrapoint.com Website. You are responsible for regularly reviewing this Agreement. Continued use of the Service after any such changes shall constitute your consent to such changes.",
  ),

  h2("General"),
  p(
    "With respect to U.S. Customers, this Agreement shall be governed by Texas law and controlling United States federal law, without regard to the choice or conflicts of law provisions of any jurisdiction, and any disputes, actions, claims or causes of action arising out of or in connection with this Agreement or the Service shall be subject to the exclusive jurisdiction of the state and federal courts located in Texas. If any provision of this Agreement is held by a court of competent jurisdiction to be invalid or unenforceable, then such provision(s) shall be construed, as nearly as possible, to reflect the intentions of the invalid or unenforceable provision(s), with all other provisions remaining in full force and effect. No joint venture, partnership, employment, or agency relationship exists between you and Company as a result of this agreement or use of this Website. The failure of Company to enforce any right or provision in this Agreement shall not constitute a waiver of such right or provision unless acknowledged and agreed to by Company in writing. This Agreement, together with any applicable Form and policies, comprises the entire agreement between you and Company and supersedes all prior or contemporaneous negotiations, discussions or agreements, whether written or oral, between the parties regarding the subject matter contained herein.",
  ),

  h2("Definitions"),
  p(
    'As used in this Agreement and in any Applications now or hereafter associated herewith "Agreement" means these online terms of use, any Applications, whether written or submitted online via the www.xtrapoint.com Website, and any materials available on the Company Website specifically incorporated by reference herein, as such materials, including the terms of this Agreement, may be updated by Company from time to time in its sole discretion; "Effective Date" means the earlier of either the date this Agreement is accepted by making Application and receiving confirmation of such. "Application" means the form evidencing your agreement to submit information to XtraPoint from this site and any subsequent Applications submitted online or in written form, each such Application to be incorporated into and to become a part of this Agreement (in the event of any conflict between the terms of this Agreement and the terms of any such Application, the terms of this Agreement shall prevail); "Company" means collectively LaCore Payments Technologies, Inc., a corporation organized and existing under the laws of the State of Texas doing business as "XtraPoint" (www.xtrapoint.com) and having an office at 901 Sam Rayburn Highway, Melissa, Texas 75454, together with its officers, directors, shareholders, employees, agents and affiliated companies.',
  ),

  h2("Questions or Additional Information"),
  p(
    "If you have questions regarding this Agreement or wish to obtain additional information, please send an e-mail to [support@lacorepayments.com](mailto:support@lacorepayments.com).",
  ),
];

const PAGES = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    navLabel: "Privacy",
    body: privacyBody,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    navLabel: "Terms",
    body: termsBody,
  },
];

async function run() {
  const publish = process.env.PUBLISH === "1";
  console.log(
    `Seeding ${PAGES.length} legal page(s) as ${publish ? "PUBLISHED (live)" : "drafts (review in Studio)"}…`,
  );
  for (const pg of PAGES) {
    const _id = `${publish ? "" : "drafts."}legalPage.${pg.slug}`;
    await client.createOrReplace({
      _id,
      _type: "legalPage",
      title: pg.title,
      navLabel: pg.navLabel,
      slug: { _type: "slug", current: pg.slug },
      lastUpdated: EFFECTIVE,
      body: pg.body,
    });
    console.log(`  ✓ /${pg.slug}${publish ? "" : " (draft)"}`);
  }
  console.log(
    `Done — ${PAGES.length} legal page(s) ${publish ? "published" : "created as drafts"}.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
