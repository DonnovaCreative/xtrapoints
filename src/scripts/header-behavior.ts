// =============================================================================
// SITE HEADER BEHAVIOR — shared by Header.astro and SchoolHeader.astro.
//
// The header element carries `data-site-header`; this script drives three
// state attributes that the component CSS styles against:
//   • data-scrolled — past the top of the page → glass morph (blur + tint)
//   • data-hidden   — scrolling down → slide the bar away; scrolling up → reveal
//   • data-open     — mobile menu panel open (toggled by [data-nav-toggle])
//
// Progressive enhancement: without JS the header simply stays visible and
// transparent — every link still works. Imported (and deduped) by the header
// components via `<script> import "@/scripts/header-behavior"; </script>`.
// =============================================================================

function init() {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;

  const SCROLLED_AT = 16; // px before the glass morph kicks in
  const HIDE_AFTER = 160; // don't hide within the first viewport-ish of the page
  const DELTA = 6; // ignore tiny scroll jitter

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;

    header.toggleAttribute("data-scrolled", y > SCROLLED_AT);

    // Never hide while the mobile menu is open or focus is inside the header
    // (keyboard users tabbing through links must not lose it).
    const pinned =
      header.hasAttribute("data-open") ||
      header.contains(document.activeElement);

    if (pinned || y <= HIDE_AFTER) {
      header.removeAttribute("data-hidden");
    } else if (y > lastY + DELTA) {
      header.setAttribute("data-hidden", "");
    } else if (y < lastY - DELTA) {
      header.removeAttribute("data-hidden");
    }
    if (Math.abs(y - lastY) > DELTA) lastY = y;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // --- mobile menu -----------------------------------------------------------
  const toggle = header.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const setOpen = (open: boolean) => {
    header.toggleAttribute("data-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    if (!open) update();
  };
  toggle?.addEventListener("click", () =>
    setOpen(!header.hasAttribute("data-open")),
  );
  // Close on Escape, and when a menu link is chosen.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.hasAttribute("data-open")) {
      setOpen(false);
      toggle?.focus();
    }
  });
  header
    .querySelectorAll("[data-nav-panel] a")
    .forEach((a) => a.addEventListener("click", () => setOpen(false)));

  // Reveal the header when focus enters it (e.g. tabbing from the address bar).
  header.addEventListener("focusin", () =>
    header.removeAttribute("data-hidden"),
  );

  update();
}

init();
