// The portal's sidebar navigation, defined once.
//
// Both the sidebar island and the page routes read this, so adding a section
// means adding a route and one entry here — the nav can't drift from what
// actually exists.
//
// Icons travel as NAMES, not components: the sidebar is a React island and Astro
// can only pass serializable props across that boundary, so PortalShell maps
// these to lucide components on its side.
export type PortalIcon = "home" | "pages" | "onePager" | "library" | "brand";

export interface PortalNavItem {
  /** Path segment under /portal/<token>; "" is the dashboard root. */
  segment: string;
  title: string;
  icon: PortalIcon;
  /** One line under the section heading on its own page. */
  blurb: string;
}

export const PORTAL_NAV: PortalNavItem[] = [
  {
    segment: "",
    title: "Overview",
    icon: "home",
    blurb: "Everything we've built for your program, in one place.",
  },
  {
    segment: "pages",
    title: "Your pages",
    icon: "pages",
    // Neutral on purpose: the page itself says whether they're live, and a
    // blanket "Live now" would be wrong for every school before launch.
    blurb: "Your donor and ambassador pages — preview them here, and share them once they're live.",
  },
  {
    segment: "one-pager",
    title: "Sales one-pager",
    icon: "onePager",
    blurb: "A co-branded sell sheet in your colors — for boards, sponsors, and partner meetings.",
  },
  {
    segment: "resources",
    title: "Resource library",
    icon: "library",
    blurb: "Templates and materials built by the marketing team, in the tools you already use.",
  },
  {
    segment: "brand",
    title: "Brand kit",
    icon: "brand",
    blurb: "The exact files and colors we use on your pages, so anything you make matches.",
  },
];

export const navHref = (base: string, segment: string) =>
  segment ? `${base}/${segment}` : base;

export const navItem = (segment: string): PortalNavItem =>
  PORTAL_NAV.find((i) => i.segment === segment) ?? PORTAL_NAV[0];
