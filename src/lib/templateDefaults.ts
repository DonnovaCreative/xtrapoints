// What each editable field would say if the school changed nothing.
//
// The customise screen shows these as input PLACEHOLDERS rather than values,
// which is what makes the override model explain itself: an empty box already
// reads as the flyer's current wording, typing takes it over, and emptying it
// hands it back. Nobody has to be told what "derived" means.
//
// Kept apart from templateFields.ts because it has to call the templates' own
// content builders, and those import the field spec.
import type { School } from "@/data/schools";
import { flyerContent } from "@/lib/flyerContent";
import { flyerTheme } from "@/lib/flyerTheme";

export interface TemplateDefaults {
  values: Record<string, string>;
  lists: Record<string, string[]>;
}

const ambassadorFlyerDefaults = (school: School): TemplateDefaults => {
  // No overrides — this is deliberately the untouched render.
  const c = flyerContent(school);
  const t = flyerTheme(school.theme);
  return {
    values: {
      headlineLine1: c.headlineLine1,
      headlineLine2: c.headlineLine2,
      heroSubhead: c.heroSubhead,
      heroBadge: c.heroBadge,
      benefitsTitleLine1: c.benefitsTitleLine1,
      benefitsTitleLine2: c.benefitsTitleLine2,
      rewardsTitle: c.rewardsTitle,
      ctaTitle: c.ctaTitle,
      applyUrl: c.applyUrl,
      contactUrl: c.contactUrl,
      colorBase: t.base,
      colorAccent: t.accent,
    },
    lists: {
      benefits: c.benefits,
      rewards: c.rewards,
    },
  };
};

const BUILDERS: Record<string, (school: School) => TemplateDefaults> = {
  "ambassador-flyer": ambassadorFlyerDefaults,
};

export const getTemplateDefaults = (templateId: string, school: School): TemplateDefaults =>
  BUILDERS[templateId]?.(school) ?? { values: {}, lists: {} };
