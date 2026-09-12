import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar } from "@/components/ui/sidebar";

export interface TopicGroup {
  title: string;
  topics: { title: string; href: string }[];
}
interface Props {
  title: string;
  href: string;
  Icon: LucideIcon;
  groups?: TopicGroup[];
  active: boolean;
  currentHref?: string;
}
export default function ToolkitNavItem({ title, href, Icon, groups, active, currentHref }: Props) {
  const [open, setOpen] = React.useState(active);
  React.useEffect(() => { setOpen(active); }, [active, href]);
  const hasTopics = Boolean(groups?.length);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem className="xp-nav-item">
        <SidebarMenuButton asChild isActive={active} tooltip={title}>
          <a href={href} title={title} aria-current={currentHref === href ? "page" : undefined}>
            <Icon /><span>{title}</span>
          </a>
        </SidebarMenuButton>
        {hasTopics && <>
          <CollapsibleTrigger asChild>
            <SidebarMenuAction className="xp-resource-toggle" aria-label={`${open ? "Hide" : "Show"} topics in ${title}`}>
              <ChevronRight className={open ? "rotate-90" : ""} />
            </SidebarMenuAction>
          </CollapsibleTrigger>
          <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuSub className="xp-topic-groups">
              {groups!.map(group => <TopicCategory key={group.title} group={group} currentHref={currentHref} />)}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>}
      </SidebarMenuItem>
    </Collapsible>
  );
}
function TopicCategory({ group, currentHref }: { group: TopicGroup; currentHref?: string }) {
  const { open: sidebarOpen, openMobile, isMobile } = useSidebar();
  const sidebarVisible = isMobile ? openMobile : sidebarOpen;
  const containsCurrent = group.topics.some(topic => topic.href === currentHref);
  const [open, setOpen] = React.useState(containsCurrent);
  const activeLink = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => { if (containsCurrent) setOpen(true); }, [containsCurrent, currentHref]);
  React.useEffect(() => {
    if (!open || !sidebarVisible) return;
    const link = activeLink.current;
    const scroll = link?.closest<HTMLElement>('[data-sidebar="content"]');
    if (!link || !scroll) return;
    let frame = 0;
    const reveal = () => {
      const item = link.getBoundingClientRect(), container = scroll.getBoundingClientRect();
      if (!item.height || !container.width || !container.height) return;
      if (item.top < container.top || item.bottom > container.bottom) scroll.scrollTop += item.top - container.top - 48;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };
    schedule();
    // Expansion and dragging change wrapped topic heights. Follow the actual
    // layout so the active topic remains visible after the width settles.
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(scroll);
    observer?.observe(link);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open, currentHref, sidebarVisible]);
  return <Collapsible asChild open={open} onOpenChange={setOpen}>
    <SidebarMenuSubItem>
      <CollapsibleTrigger className="xp-topic-category" aria-label={`${open ? "Hide" : "Show"} ${group.title} topics`}>
        <ChevronRight className={open ? "rotate-90" : ""} size={14} />
        <span>{group.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="xp-topic-links">
          {group.topics.map(topic => <SidebarMenuSubItem key={topic.href}>
            <SidebarMenuSubButton href={topic.href} ref={topic.href === currentHref ? activeLink : undefined} isActive={topic.href === currentHref} aria-current={topic.href === currentHref ? "page" : undefined} title={topic.title}>
              <span>{topic.title}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>)}
        </SidebarMenuSub>
      </CollapsibleContent>
    </SidebarMenuSubItem>
  </Collapsible>;
}
