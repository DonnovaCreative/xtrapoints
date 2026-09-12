# Marketing refresh — September 2026

The homepage and Get Started page now share a refreshed marketing design system. The About page is a staged company introduction with explicit content slots, sourced from the Obsidian About content plan.

## Design direction

The memorable opening combines the approved Otto volleyball scene, oversized athletic Archivo, and one lime Cyber Brush accent. Quiet white and ice sections then explain the product; midnight navy anchors the platform and film. Community photos carry the personality. Illustrations are explicitly labeled rather than presented as customer results.

- Palette: midnight `#000628`, lime `#87F200`, blue `#3997FF`, deeper green `#6FC700`, pale lime `#F0FFDD`, ice `#F0F7FF`.
- Typography: variable Archivo for headings and body, heavy condensed italic for display, Cyber Brush for the supplied campaign emphasis, self-hosted Space Mono for occasional captions.
- Layout: wide, left-aligned campaign composition; mobile changes the hero to a photo above the copy. A simple receipt teaches the rounding calculation. A manually selected audience gallery pairs each community with an approved image. Product, marketing, ambassador, film, FAQ, and invitation sections complete the story.
- Motion: one entrance sequence, interactive receipt and gallery transitions, native dialog playback, and progressive CSS scroll-linked film motion. Reduced-motion settings disable movement. No continuous JavaScript rendering or autoplay video.

## Implementation

`src/styles/marketing.css` defines reusable public-marketing tokens and primitives. `Layout marketing` opts the page into the Archivo palette/font overrides, self-hosted preload strategy, skip link, and new social preview. Legacy school themes and operational workspace typography remain intact.

`src/styles/home-refresh.css` defines the homepage composition. The homepage islands hydrate on visibility. Films get their video source only when a person opens a dialog; controls, Escape, focus return, pause-on-close, and scroll restoration are built in. With JavaScript disabled, core content and FAQs remain usable, video links remain available, and the contact page shows a direct email alternative instead of an inert form.

The contact page retains the existing ContactForm, `/api/lead` integration, hCaptcha, consent wording, and validation. No test submissions were sent to the CRM. The visual form treatment is scoped to that page.

The production navigation keeps the existing `/contact` destination and partner login. It points to the new homepage sections. About is linked only in local/known preview environments.

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
- Round-up math, all gallery choices, FAQ expansion, mobile menu, Escape/focus restoration, on-demand film playback, and consent validation checked in a browser.
- No horizontal overflow in checked layouts. No actual lead was submitted during validation.
- Final deployment URLs and HTTP/indexing checks are recorded in the completion message.
