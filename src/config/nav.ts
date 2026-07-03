// =============================================================================
// MAIN NAVIGATION — single source of truth for the site header links.
//
// The header (src/components/Header.astro) renders whatever is in `mainNav`:
//   • an item with just { label, href }        → a plain link
//   • an item with `children`                  → a dropdown (CSS-only, keyboard
//     accessible via focus-within) — no component changes needed.
//
// As the site grows (blog, product pages, solutions, guides…), extend this file:
//
//   {
//     label: "Resources",
//     children: [
//       { label: "Blog", href: "/blog", description: "News and fundraising ideas" },
//       { label: "Guides", href: "/guides", description: "Playbooks for programs" },
//     ],
//   },
//
// If a group ever needs a rich mega-menu (imagery, multi-column panels), swap
// that one group for a hydrated island (e.g. shadcn NavigationMenu) inside the
// same header shell — the shell (fixed/scroll behavior, variants) stays as-is.
// =============================================================================

export interface NavChild {
  label: string;
  href: string;
  /** Optional one-liner shown under the label inside dropdown panels. */
  description?: string;
}

export interface NavItem {
  label: string;
  /** Omit when the item is only a dropdown trigger. */
  href?: string;
  children?: NavChild[];
}

export const mainNav: NavItem[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "What it does", href: "/#features" },
  { label: "Donor management", href: "/#donors" },
  { label: "Ambassadors", href: "/#ambassadors" },
];
