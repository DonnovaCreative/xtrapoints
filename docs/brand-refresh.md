# Marketing refresh — September 2026

The homepage and Get Started page now share a refreshed marketing design system. The About page is a staged company introduction with explicit content slots, sourced from the Obsidian About content plan.

## Design direction

The memorable opening combines the approved Otto volleyball scene, oversized athletic Archivo, and one lime Cyber Brush accent. Quiet white and ice sections then explain the product; midnight navy anchors the platform and film. Community photos carry the personality. Illustrations are explicitly labeled rather than presented as customer results.

- Palette: midnight `#000628`, lime `#87F200`, blue `#3997FF`, deeper green `#6FC700`, pale lime `#F0FFDD`, ice `#F0F7FF`.
- Typography: variable Archivo for headings and body. Display headings use italic, weight 800, width axis 62, and letter spacing -3%, defined as shared tokens and applied to the homepage, Get Started, and staged About page. Cyber Brush supplies the campaign emphasis; self-hosted Space Mono provides occasional captions.
- Layout: wide, left-aligned campaign composition; mobile changes the hero to a photo above the copy. A three-stage illustration explains choosing a team, linking an eligible account, and accumulating round-ups. The audience gallery pairs each community with an approved image. Platform reporting, marketing resources, and ambassador programs each have their own full-width section, followed by film, FAQ, and invitation sections.
- Motion: one entrance sequence, timed giving and community stories, slow alternating ambassador columns, native dialog playback, and progressive CSS scroll-linked film motion. Motion pauses during interaction, offscreen, and when the tab is hidden. Reduced-motion settings provide still, manually navigable content. Videos play only on request.

## Implementation

`src/styles/marketing.css` defines reusable public-marketing tokens and primitives. `Layout marketing` opts the page into the Archivo palette/font overrides, self-hosted preload strategy, skip link, and new social preview. Legacy school themes and operational workspace typography remain intact.

`src/styles/home-refresh.css` defines the homepage composition. The homepage islands hydrate on visibility. Films get their video source only when a person opens a dialog; controls, Escape, focus return, pause-on-close, and scroll restoration are built in. With JavaScript disabled, core content and FAQs remain usable, video links remain available, and the contact page shows a direct email alternative instead of an inert form.

The contact page retains the existing ContactForm, `/api/lead` integration, hCaptcha, consent wording, and validation. No test submissions were sent to the CRM. The visual form treatment is scoped to that page.

The production navigation keeps the existing `/contact` destination and partner login. It points to the new homepage sections. About is linked only in local/known preview environments.

## September 14 refinements

The purchase-only receipt tabs were replaced by the complete giving sequence. Three example purchases accumulate $1.15, with a note that round-ups accumulate before a donation is processed. The separate Meet Otto clip was removed from How It Works. The community gallery now includes the “Who we serve” eyebrow and advances every 6.5 seconds, with manual selection and pause/play controls.

`PlatformShowcase.astro` presents a full-width illustrative reporting dashboard and supporting capabilities. `MarketingShowcase.astro` follows the actual Marketing Portal navigation and resource-library structure, behind five sample collateral formats: poster, one-pager, flyer, social post, and event signage. Both use explicitly illustrative content; the marketing composition uses generic program labels, approved imagery, and QR codes to the public website.

`AmbassadorWall.tsx` uses 24 approved portrait mockups in slowly drifting, staggered columns. An accessible enlarged viewer exposes the complete set. Images remain available as a static scrollable gallery with reduced motion or without JavaScript. See [ambassador-assets.md](ambassador-assets.md) for provenance, optimized sizes, reference attribution, and interaction details.

## About release boundary

`/about` is rendered on demand. `canShowAboutPreview` requires local development or an explicit preview/staging environment; production and unknown deployment environments return an actual 404. Production hostnames deny access even under a preview environment. The route uses no-store and noindex headers and is excluded from the sitemap.

The staged page retains the endorsed opening, company/participation belief, capabilities, partner placeholders, testimonial slots, eight named team portrait slots, recognition placeholder, culture, and contact. No portrait, role, testimonial, award, founder story, or partner relationship was invented.

## Assets and maintenance

See [brand-refresh-assets.md](brand-refresh-assets.md) for source paths, exact colors, responsive image derivatives, video specifications, and font provenance. Supplied originals were preserved; no image from an Unapproved directory was selected.

Archivo Latin subsets retain variable weight/width and common Western characters. The small Cyber Brush display subset covers only the exact homepage phrases `BEHIND` and `All in.`. Add glyphs or use the retained full CyberBrush font when changing those phrases.

## Validation

- Full Astro/Vercel build with the existing Sanity CMS content.
- 121 automated tests, including five focused production/staging boundary tests.
- Home and contact checked at 1440, 768, 390, and 320 pixels; About checked at 1440, 390, and 320 pixels.
- Round-up math and the three-stage sequence, slideshow timing and manual choices, gallery pause/play, offscreen pausing, reduced motion, enlarged ambassador browsing, and keyboard focus restoration checked in a browser. The original release also checked FAQ expansion, mobile menu, on-demand film playback, and consent validation.
- No horizontal overflow in checked layouts. No actual lead was submitted during validation.
- Final deployment URLs and HTTP/indexing checks are recorded in the completion message.
