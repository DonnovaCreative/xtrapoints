/** Browser preferences only: these never grant access to a school or product. */
export const SIDEBAR_STORAGE_KEY = "xp:sidebar:v1";
export const SIDEBAR_OPEN_COOKIE = "sidebar_state";
export const SIDEBAR_WIDTH_COOKIE = "xp_sidebar_width";
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 440;
export const SIDEBAR_DEFAULT_WIDTH = 288;

export interface SidebarPreferences {
  open: boolean;
  width: number;
}

export function sidebarMaximumWidth(viewportWidth?: number): number {
  return typeof viewportWidth === "number" && Number.isFinite(viewportWidth)
    ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - 320))
    : SIDEBAR_MAX_WIDTH;
}

export function clampSidebarWidth(width: number, viewportWidth?: number): number {
  const validWidth = Number.isFinite(width) ? width : SIDEBAR_DEFAULT_WIDTH;
  return Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(sidebarMaximumWidth(viewportWidth), validWidth)));
}

/** Local storage is optional: privacy settings must never break navigation. */
export function readSidebarPreferences(
  storage: Pick<Storage, "getItem"> | undefined,
  cookieHeader = "",
  defaults: SidebarPreferences = { open: true, width: SIDEBAR_DEFAULT_WIDTH },
): SidebarPreferences {
  const cookies = new Map(cookieHeader.split(";").map((entry) => {
    const separator = entry.indexOf("=");
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
  }));
  const cookieOpen = cookies.get(SIDEBAR_OPEN_COOKIE);
  const cookieWidth = cookies.get(SIDEBAR_WIDTH_COOKIE);
  let open = cookieOpen === "true" ? true : cookieOpen === "false" ? false : defaults.open;
  let width = cookieWidth && /^\d+$/.test(cookieWidth) ? Number(cookieWidth) : defaults.width;
  try {
    const stored = JSON.parse(storage?.getItem(SIDEBAR_STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object") {
      if (typeof stored.open === "boolean") open = stored.open;
      if (typeof stored.width === "number" && Number.isFinite(stored.width)) width = stored.width;
    }
  } catch { /* Use cookies when storage is unavailable or malformed. */ }
  return { open, width: clampSidebarWidth(width) };
}

/** Run in the document head, before paint, for the static private Sites copy. */
export const SIDEBAR_PREFERENCES_BOOTSTRAP = `(() => {
  const root = document.documentElement;
  let open, width;
  try {
    const cookies = document.cookie.split(";").map(value => value.trim());
    open = cookies.find(value => value.startsWith("${SIDEBAR_OPEN_COOKIE}="))?.split("=")[1];
    const value = cookies.find(value => value.startsWith("${SIDEBAR_WIDTH_COOKIE}="))?.split("=")[1];
    if (value && /^\\d+$/.test(value)) width = Number(value);
  } catch {}
  try {
    const stored = JSON.parse(localStorage.getItem("${SIDEBAR_STORAGE_KEY}") || "null");
    if (stored && typeof stored.open === "boolean") open = String(stored.open);
    if (stored && typeof stored.width === "number" && Number.isFinite(stored.width)) width = stored.width;
  } catch {}
  if (open === "true" || open === "false") root.dataset.xpSidebarOpen = open;
  if (typeof width === "number" && Number.isFinite(width)) {
    width = Math.round(Math.max(${SIDEBAR_MIN_WIDTH}, Math.min(${SIDEBAR_MAX_WIDTH}, width, Math.max(${SIDEBAR_MIN_WIDTH}, innerWidth - 320))));
    root.style.setProperty("--xp-sidebar-preferred-width", width + "px");
  }
})();`;
