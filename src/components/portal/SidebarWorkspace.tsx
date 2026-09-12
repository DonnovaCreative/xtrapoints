"use client";

import * as React from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  clampSidebarWidth,
  readSidebarPreferences,
  sidebarMaximumWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_OPEN_COOKIE,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_COOKIE,
  type SidebarPreferences,
} from "@/lib/sidebarPreferences";

interface ResizeContextValue {
  width: number;
  maxWidth: number;
  setWidth: (width: number) => void;
  setResizing: (resizing: boolean) => void;
}

const ResizeContext = React.createContext<ResizeContextValue | null>(null);

function browserPreferences(defaults: SidebarPreferences): SidebarPreferences {
  let storage: Storage | undefined;
  let cookieHeader = "";
  try { storage = window.localStorage; } catch { /* Storage can be disabled. */ }
  try { cookieHeader = document.cookie; } catch { /* Cookies can be disabled. */ }
  return readSidebarPreferences(storage, cookieHeader, defaults);
}

function persistPreferences(preferences: SidebarPreferences) {
  try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Optional persistence. */ }
  const cookieOptions = `; path=/; max-age=604800; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try {
    document.cookie = `${SIDEBAR_OPEN_COOKIE}=${preferences.open}${cookieOptions}`;
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${preferences.width}${cookieOptions}`;
  } catch { /* Navigation still works in a storage-restricted browser. */ }
  document.documentElement.dataset.xpSidebarOpen = String(preferences.open);
  document.documentElement.style.setProperty("--xp-sidebar-preferred-width", `${clampSidebarWidth(preferences.width, window.innerWidth)}px`);
}

/** One provider for every product; keep these preferences outside school data. */
export function SidebarWorkspace({
  defaultOpen = true,
  initialWidth = SIDEBAR_DEFAULT_WIDTH,
  className,
  children,
}: {
  defaultOpen?: boolean;
  initialWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  // The first render matches SSR. The head bootstrap styles the saved state
  // until the layout effect restores it, including on static exported pages.
  const [preferences, setPreferences] = React.useState<SidebarPreferences>({ open: defaultOpen, width: clampSidebarWidth(initialWidth) });
  const preferencesRef = React.useRef(preferences);
  const [ready, setReady] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState<number>();
  const [resizing, setResizing] = React.useState(false);

  React.useLayoutEffect(() => {
    const restored = browserPreferences(preferencesRef.current);
    preferencesRef.current = restored;
    setPreferences(restored);
    setViewportWidth(window.innerWidth);
    setReady(true);
    const resize = () => setViewportWidth(window.innerWidth);
    const storage = (event: StorageEvent) => {
      if (event.key !== SIDEBAR_STORAGE_KEY && event.key !== null) return;
      const next = browserPreferences(preferencesRef.current);
      preferencesRef.current = next;
      setPreferences(next);
    };
    window.addEventListener("resize", resize);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const update = React.useCallback((patch: Partial<SidebarPreferences>) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    persistPreferences(next);
  }, []);
  const setOpen = React.useCallback((open: boolean) => update({ open }), [update]);
  const setWidth = React.useCallback((width: number) => update({ width: clampSidebarWidth(width, window.innerWidth) }), [update]);
  const width = clampSidebarWidth(preferences.width, viewportWidth);
  const context = React.useMemo(() => ({ width, maxWidth: sidebarMaximumWidth(viewportWidth), setWidth, setResizing }), [width, viewportWidth, setWidth]);

  return (
    <ResizeContext.Provider value={context}>
      <SidebarProvider
        className={className}
        open={preferences.open}
        onOpenChange={setOpen}
        data-sidebar-ready={String(ready)}
        data-sidebar-resizing={String(resizing)}
        style={{ "--sidebar-width": ready ? `${width}px` : `var(--xp-sidebar-preferred-width, ${width}px)` } as React.CSSProperties}
      >
        {children}
      </SidebarProvider>
    </ResizeContext.Provider>
  );
}

/** A drag separator when expanded, an honest expand button when collapsed. */
export function SidebarResizeHandle({ className }: { className?: string }) {
  const { open, setOpen, isMobile } = useSidebar();
  const resize = React.useContext(ResizeContext);
  if (!resize) throw new Error("SidebarResizeHandle must be inside SidebarWorkspace.");
  const drag = React.useRef<{ pointerId: number; x: number; width: number; element: HTMLDivElement; cursor: string; userSelect: string } | null>(null);

  const stopDragging = React.useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
    document.body.style.cursor = current.cursor;
    document.body.style.userSelect = current.userSelect;
    resize.setResizing(false);
  }, [resize.setResizing]);

  React.useEffect(() => {
    if (!open || isMobile) stopDragging();
  }, [open, isMobile, stopDragging]);
  React.useEffect(() => {
    window.addEventListener("blur", stopDragging);
    window.addEventListener("pagehide", stopDragging);
    return () => {
      window.removeEventListener("blur", stopDragging);
      window.removeEventListener("pagehide", stopDragging);
      stopDragging();
    };
  }, [stopDragging]);

  const sharedClassName = cn(
    "xp-sidebar-resize-handle absolute inset-y-0 -right-1 z-20 hidden w-3 items-center justify-center md:flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
    className,
  );
  if (isMobile) return null;
  if (!open) return (
    <button type="button" data-sidebar="expand-handle" className={sharedClassName} style={{ cursor: "pointer" }} aria-label="Expand navigation" title="Expand navigation" onClick={() => setOpen(true)}>
      <span aria-hidden="true" className="pointer-events-none h-full w-0.5 rounded-full" />
    </button>
  );

  return (
    <div
      data-sidebar="resize-handle"
      role="separator"
      aria-label="Navigation width"
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={resize.maxWidth}
      aria-valuenow={resize.width}
      aria-valuetext={`${resize.width} pixels`}
      title="Drag to resize navigation. Use arrow keys when focused."
      tabIndex={0}
      className={sharedClassName}
      style={{ cursor: "col-resize", touchAction: "none" }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, width: resize.width, element: event.currentTarget, cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        resize.setResizing(true);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (current && current.pointerId === event.pointerId) resize.setWidth(current.width + event.clientX - current.x);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 32 : 16;
        const next = event.key === "ArrowLeft" ? resize.width - step
          : event.key === "ArrowRight" ? resize.width + step
          : event.key === "Home" ? SIDEBAR_MIN_WIDTH
          : event.key === "End" ? resize.maxWidth : undefined;
        if (next === undefined) return;
        event.preventDefault();
        resize.setWidth(next);
      }}
    >
      <span aria-hidden="true" className="pointer-events-none h-full w-0.5 rounded-full" />
    </div>
  );
}
