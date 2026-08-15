"use client";

// The Marketing Portal's dashboard chrome — shadcn's sidebar-07 block, adapted.
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
  Home,
  Images,
  LayoutTemplate,
  LifeBuoy,
  Palette,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

const ICONS: Record<PortalIcon, LucideIcon> = {
  home: Home,
  pages: LayoutTemplate,
  onePager: Download,
  library: Images,
  brand: Palette,
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
  school: { short: string; name: string; logo?: string; badgeLogo: boolean };
  brandLogo: string;
  /** Square mark shown instead of the wordmark when the rail is collapsed. */
  brandMark: string;
  brandName: string;
  supportHref: string;
  children?: React.ReactNode;
}

export function PortalShell({
  nav,
  activeHref,
  crumbs,
  school,
  brandLogo,
  brandMark,
  brandName,
  supportHref,
  children,
}: Props) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-none">
        <SidebarHeader className="gap-3 p-3">
          {/* Lockup, not a link: this is the school's own portal, so the mark is
              identity rather than navigation. Hidden when collapsed to icons. */}
          <div className="flex items-center gap-2.5 overflow-hidden px-1 py-1.5">
            {/* The wordmark is far too wide for the 3rem icon rail — it would sit
                clipped mid-letter — so the square mark takes over there. */}
            <img
              src={brandLogo}
              alt={brandName}
              className="h-6 w-auto shrink-0 group-data-[collapsible=icon]:hidden"
            />
            <img
              src={brandMark}
              alt={brandName}
              className="hidden h-6 w-6 shrink-0 rounded group-data-[collapsible=icon]:block"
            />
            {school.logo && (
              <>
                <span
                  className="h-6 w-px shrink-0 bg-white/20 group-data-[collapsible=icon]:hidden"
                  aria-hidden="true"
                />
                {school.badgeLogo ? (
                  <span className="flex shrink-0 items-center rounded bg-white px-1.5 py-1 group-data-[collapsible=icon]:hidden">
                    <img src={school.logo} alt={school.name} className="h-4 w-auto" />
                  </span>
                ) : (
                  <img
                    src={school.logo}
                    alt={school.name}
                    className="h-5 w-auto shrink-0 group-data-[collapsible=icon]:hidden"
                  />
                )}
              </>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
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
                        <a href={item.href}>
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
              <SidebarMenuButton asChild tooltip="Ask for something">
                <a href={supportHref}>
                  <LifeBuoy />
                  <span>Ask for something</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-gray-50">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50/90 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
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
