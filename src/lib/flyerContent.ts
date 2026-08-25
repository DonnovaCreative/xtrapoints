// Builds the ambassador flyer's copy from a school record.
//
// The rule that makes the one-pager scale is that it derives EVERYTHING from
// data the school already has — add a school in the Studio and its sell sheet
// exists, with no one writing flyer copy. This module holds the flyer to the
// same rule: the defaults below are written to read correctly for any school,
// and the school's own naming (collective, beneficiary, program name) is woven
// through the few places where a specific name genuinely helps.
//
// The one real piece of school-authored content it picks up is the reward list,
// which comes from the ambassador tiers a school may already have filled in.
//
// Every string here is length-sensitive: the sheet has only a few px of vertical
// slack and the headline/pillar labels are set in a condensed face at large
// sizes. The caps noted per field were measured against the design. When copy
// becomes editable (Stage 2 of the portal), those are the maxLength values.
//
// A school's own tweaks (made in the portal, see src/lib/templateFields.ts) are
// merged on top at the end. They override, never replace: clearing a field in
// the portal drops it from the override set and the derived default returns.
import { brand } from "@/config/brand";
import type { School } from "@/data/schools";
import { EMPTY_OVERRIDES, type TemplateOverrides } from "@/lib/templateFields";

export interface FlyerContent {
  /** ≤ 26 chars each before the headline needs stepping down. */
  headlineLine1: string;
  headlineLine2: string;
  heroSubhead: string;
  heroBadge: string;
  pillarsTitleLine1: string;
  pillarsTitleLine2: string;
  pillarsBlurb: string;
  benefitsTitleLine1: string;
  benefitsTitleLine2: string;
  rewardsTitle: string;
  rewardsLabel: string;
  careerTitle: string;
  careerBody: string;
  ctaTitle: string;
  ctaButton: string;
  contactPrompt: string;
  disclaimer: string;

  pillars: { kicker: string; label: string; invert?: boolean }[];
  benefits: string[];
  rewards: string[];
  ctaSteps: string[];

  /** Masthead co-brand lockup, e.g. "DANES OF GREATNESS × XTRAPOINT". */
  lockup: string;
  /** Where the QR code and the CTA point. */
  applyUrl: string;
  applyUrlDisplay: string;
  contactUrl: string;
  /**
   * The layout's one escape hatch for long headlines — the design handoff's
   * rule, applied here rather than left to whoever writes the copy.
   */
  h1Size: string;
}

const DEFAULT_REWARDS = (programName: string) => [
  `${programName} & ${brand.name} swag`,
  "Uber & DoorDash gift cards",
  "Game tickets & exclusive tailgate access",
  "Discount cards & gift certificates",
  "Electronics & tech giveaways",
  "Trips & special experiences",
];

/**
 * A school's own tier perks, flattened into the flyer's reward chips. Tiers are
 * an existing Ambassador-page field, so a school that has customised them gets a
 * flyer that matches their real program instead of the generic list.
 */
const rewardsFrom = (school: School): string[] | undefined => {
  const perks = (school.ambassadorTiers ?? []).flatMap((t) => t.perks ?? []);
  const seen = new Set<string>();
  const unique = perks.filter((p) => {
    const key = p.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Six chips is what the column holds; below three the generic list reads better.
  return unique.length >= 3 ? unique.slice(0, 6) : undefined;
};

export const flyerContent = (
  school: School,
  overrides: TemplateOverrides = EMPTY_OVERRIDES,
): FlyerContent => {
  const { programName, beneficiary, collective, short, slug } = school;
  const o = overrides.values;
  const applyUrl = o.applyUrl || `${brand.url}/schools/${slug}/ambassadors`;

  const headlineLine1 = o.headlineLine1 || "Don't just be a fan.";
  const headlineLine2 = o.headlineLine2 || "Become one of the greats.";

  const derived: FlyerContent = {
    headlineLine1,
    headlineLine2,
    heroSubhead: `Join the ${programName} ${brand.name} Ambassador Program and turn your school spirit into real-world experience, campus impact and exclusive opportunities.`,
    heroBadge: "FLEXIBLE SCHEDULE • ALL MATERIALS PROVIDED",

    pillarsTitleLine1: "Why students are",
    pillarsTitleLine2: "signing up",
    pillarsBlurb:
      "Everything you need is provided at no cost. All you bring is your energy and your network.",

    benefitsTitleLine1: "Build experience.",
    benefitsTitleLine2: "Make an impact. Have fun.",

    rewardsTitle: "Your impact can unlock more",
    rewardsLabel: "Potential rewards may include:",

    careerTitle: "Stand out—and get noticed",
    careerBody:
      "Top-performing ambassadors may be considered for internship opportunities in sales, marketing, shipping and logistics, accounting, and fintech and information technology.",

    ctaTitle: "Ready to make your impact?",
    ctaButton: "Scan to apply",

    contactPrompt: "Questions?",
    disclaimer:
      "Rewards, experiences and internship opportunities are subject to eligibility, availability and official program terms.",

    pillars: [
      { kicker: "EARN", label: "Swag, gift cards, tech and trips" },
      { kicker: "ACCESS", label: "Game tickets and tailgates" },
      { kicker: "BUILD", label: "Résumé-ready experience" },
      { kicker: "JOIN", label: "Open to all students", invert: true },
    ],

    benefits: [
      "Gain hands-on marketing, sales and leadership experience",
      "Build résumé-ready skills and professional connections",
      `Help grow school spirit and support ${beneficiary}`,
      "Participate on a flexible schedule",
      "Receive free marketing materials, templates, training and support",
    ],

    rewards: rewardsFrom(school) ?? DEFAULT_REWARDS(programName),

    ctaSteps: [
      "Scan the code",
      "See the perks and how it works",
      "Apply to become an ambassador",
    ],

    lockup: `${(collective ?? short).toUpperCase()} × ${brand.name.replace("™", "").toUpperCase()}`,
    applyUrl,
    applyUrlDisplay: applyUrl.replace(/^https?:\/\//, ""),
    contactUrl: `${brand.domain}/support`,

    // Step down when either line runs past the width the 37pt setting holds.
    // Measured on the FINAL headline, so a school's own long headline steps down
    // too rather than overflowing the sheet.
    h1Size:
      Math.max(headlineLine1.length, headlineLine2.length) > 26 ? "33pt" : "37pt",
  };

  // Scalar overrides, applied only where the spec declares a matching key. The
  // two headline fields and applyUrl are already folded in above because other
  // values derive from them.
  const merged: FlyerContent = { ...derived };
  for (const key of ["heroSubhead", "heroBadge", "benefitsTitleLine1",
                     "benefitsTitleLine2", "rewardsTitle", "ctaTitle",
                     "contactUrl"] as const) {
    if (o[key]) merged[key] = o[key];
  }
  if (overrides.lists.benefits?.length) merged.benefits = overrides.lists.benefits;
  if (overrides.lists.rewards?.length) merged.rewards = overrides.lists.rewards;

  return merged;
};
