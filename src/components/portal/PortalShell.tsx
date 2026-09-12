"use client";

// Shared product navigation — shadcn's sidebar-07 block, adapted for XtraPoint.
//
// ONE island wraps the whole page: the sidebar and the content have to share
// SidebarProvider's context (the trigger and the collapse state live there), so
// splitting them would leave the trigger unable to toggle anything. Astro renders
// each page's body to HTML and passes it here as `children`, which React keeps as
// static markup inside SidebarInset — so the pages stay ordinary Astro (and their
// own <script> tags, like the lightbox, keep working).
//
// Everything it needs is serializable: Astro can't pass components across the
// island boundary, so icons arrive as names and are mapped below.
import * as React from "react";
import {
  Download,
  BookOpen,
  Calculator,
  ClipboardList,
  Globe2,
  Home,
  Images,
  LayoutTemplate,
  LifeBuoy,
  Lightbulb,
  Mail,
  Palette,
  Presentation,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import type { PortalIcon } from "@/lib/portalNav";
import { ProductSwitcher, type PortalProduct } from "./ProductSwitcher";
import "./portal-shell.css";

const ICONS: Record<PortalIcon, LucideIcon> = {
  home: Home,
  pages: LayoutTemplate,
  onePager: Download,
  library: Images,
  brand: Palette,
  guide: BookOpen,
  catalog: Lightbulb,
  builder: Calculator,
  communications: Mail,
  kickoff: Presentation,
  rules: ClipboardList,
};

export interface ShellNavItem {
  title: string;
  href: string;
  icon: PortalIcon;
}

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  nav: ShellNavItem[];
  /** href of the section currently open, so exactly one item reads as active. */
  activeHref: string;
  crumbs: Crumb[];
  /** Legacy callers can supply school context; school artwork is never navigation branding. */
  school?: { short: string; name: string; logo?: string; badgeLogo: boolean };
  brandLogo: string;
  /** Square mark shown instead of the wordmark when the rail is collapsed. */
  brandMark: string;
  brandName: string;
  supportHref: string;
  product?: PortalProduct;
  /** The current school's portal URL, or the workspace chooser when no school is selected. */
  marketingHref?: string;
  /** Optional text identifying the school or audience of the current product. */
  contextLabel?: string;
  /** Canonical school slug from a verified session, never a legacy access URL. */
  rememberSchool?: string;
  websiteHref?: string;
  /**
   * Show the account menu. False for legacy token links — there's no account
   * behind them, so a "sign out" would be meaningless.
   */
  showAccount?: boolean;
  children?: React.ReactNode;
}

export function PortalShell({
  nav,
  activeHref,
  crumbs,
  school,
  brandMark,
  brandName,
  supportHref,
  product = "marketing",
  marketingHref = "/portal",
  contextLabel,
  rememberSchool,
  websiteHref = "https://www.xtrapoint.com",
  showAccount = false,
  children,
}: Props) {
  return (
    <SidebarProvider className="xp-product-shell">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="flex-row items-center p-2">
          <div className="min-w-0 flex-1">
            <ProductSwitcher
              product={product}
              marketingHref={marketingHref}
              brandMark={brandMark}
              brandName={brandName}
              rememberSchool={rememberSchool}
            />
          </div>
          <SidebarTrigger aria-label="Close navigation" className="shrink-0 text-[#172d45] hover:bg-[#e9eef3] md:hidden" />
        </SidebarHeader>

        <SidebarContent role="navigation" aria-label={product === "marketing" ? "Marketing Portal" : "Ambassador Toolkit"}>
          <SidebarGroup>
            <SidebarGroupLabel className="text-[#627184]">
              {contextLabel ?? (product === "marketing" ? school?.short ?? "Your workspace" : "Program guides")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.href === activeHref}
                        tooltip={item.title}
                      >
                        <a href={item.href} title={item.title} aria-current={item.href === activeHref ? "page" : undefined}>
                          <Icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="XtraPoint website">
                <a href={websiteHref}>
                  <Globe2 />
                  <span>XtraPoint website</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Contact XtraPoint">
                <a href={supportHref}>
                  <LifeBuoy />
                  <span>Contact XtraPoint</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {showAccount && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Your account">
                  <a href="/portal/account">
                    <UserRound />
                    <span>Your account</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-white">
        <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center gap-2 border-b border-[#dde3e9] bg-white/95 px-4 py-2 text-[#172d45] backdrop-blur md:rounded-t-xl">
          <SidebarTrigger className="-ml-1 shrink-0 hover:bg-[#e9eef3] hover:text-[#172d45]" />
          <Separator orientation="vertical" className="mr-1 !h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${i}`}>
                    <BreadcrumbItem>
                      {last || !crumb.href ? (
                        <BreadcrumbPage className="font-semibold">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!last && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default PortalShell;
