import * as React from "react";
import { BookOpen, Check, ChevronsUpDown, LayoutDashboard } from "lucide-react";
import { marketingHrefForSlug } from "@/lib/productNavigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type PortalProduct = "marketing" | "toolkit";

interface Props {
  product: PortalProduct;
  marketingHref: string;
  brandMark: string;
  brandName: string;
  rememberSchool?: string;
}

export function ProductSwitcher({ product, marketingHref, brandMark, brandName, rememberSchool }: Props) {
  const { isMobile } = useSidebar();
  const [returnHref, setReturnHref] = React.useState(marketingHref);

  React.useEffect(() => {
    const key = "xp.marketing-school";
    try {
      if (product === "marketing") {
        // Store only a validated canonical slug, never a legacy URL or token.
        if (marketingHrefForSlug(rememberSchool)) sessionStorage.setItem(key, rememberSchool!);
        else sessionStorage.removeItem(key);
        setReturnHref(marketingHref);
      } else if (marketingHref === "/portal") {
        const remembered = marketingHrefForSlug(sessionStorage.getItem(key));
        setReturnHref(remembered ?? marketingHref);
        if (!remembered) sessionStorage.removeItem(key);
      } else {
        // Standalone previews point to the real website and have no school session.
        setReturnHref(marketingHref);
      }
    } catch {
      // Browser privacy settings can disable storage; the workspace picker still works.
      setReturnHref(marketingHref);
    }
  }, [product, marketingHref, rememberSchool]);

  const products = [
    {
      id: "marketing",
      name: "Marketing Portal",
      description: "School pages, branding and materials",
      href: returnHref,
      icon: LayoutDashboard,
    },
    {
      id: "toolkit",
      name: "Ambassador Toolkit",
      description: "Guides for your ambassador program",
      href: "/resources/ambassador-toolkit",
      icon: BookOpen,
    },
  ] as const;
  const current = products.find((item) => item.id === product)!;

  return (
    <SidebarMenu className="xp-product-switcher">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="xp-product-trigger gap-2.5 data-[state=open]:bg-sidebar-accent"
              tooltip={`Switch product: ${current.name}`}
              aria-label={`Switch product, current product: ${current.name}`}
            >
              <img src={brandMark} alt="" className="size-8 shrink-0 rounded-lg" />
              <span className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-medium text-[#c4cffb]">{brandName}</span>
                <span className="truncate text-sm font-semibold">{current.name}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-[#c4cffb] group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="xp-product-menu w-[19rem] max-w-[calc(100vw-2rem)] rounded-lg p-1.5"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
            collisionPadding={16}
          >
            <DropdownMenuLabel className="px-2 py-2 text-xs font-medium text-[#627184]">
              {brandName} products
            </DropdownMenuLabel>
            {products.map((item) => {
              const Icon = item.icon;
              const selected = item.id === product;
              return (
                <DropdownMenuItem key={item.id} asChild className="gap-2.5 rounded-md p-2.5">
                  <a href={item.href} aria-current={selected ? "page" : undefined}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#dde3e9] bg-white">
                      <Icon className="size-4 text-[#03116d]" />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs leading-4 text-[#627184]">{item.description}</span>
                    </span>
                    {selected && <Check className="size-4 text-[#03116d]" aria-hidden="true" />}
                  </a>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
