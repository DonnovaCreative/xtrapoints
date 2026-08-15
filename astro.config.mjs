// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Single source of truth for the brand/domain (see src/config/brand.ts).
import { brand } from './src/config/brand.ts';

// Assets the on-demand OG endpoint (src/pages/schools/[school]/og.png.ts) reads
// from disk at runtime. `includeFiles` forces them into the serverless function
// bundle since they aren't traced from imports. School logos are now fetched
// from the Sanity CDN at runtime, so only the fonts + the local XtraPoint mark
// need bundling.
const ogIncludeFiles = [
  './src/og/fonts/Anton-Regular.ttf',
  './src/og/fonts/PermanentMarker-Regular.ttf',
  './src/og/fonts/SpaceMono-Bold.ttf',
  `./public${brand.logo.white}`,
];

// https://astro.build/config
export default defineConfig({
  // Production domain — follows the brand toggle. Make sure the Vercel custom
  // domain matches this (xtrapoint.com vs xtrapoints.com).
  site: brand.url,

  // Static build. The Vercel adapter ships the prerendered output to Vercel's
  // static hosting; no SSR runtime is used (the contact form posts client-side).
  output: 'static',

  // Keep the co-branded sales one-pagers (print/PDF collateral) out of the
  // sitemap — they're noindex sell sheets, not landing pages.
  integrations: [
    react(),
    sitemap({
      // Exclude noindex collateral: the print/PDF one-pagers, the secret-gated
      // draft-preview routes, and the private per-school marketing portals.
      // (The latter two are server-rendered, so they shouldn't reach the sitemap
      // anyway — belt and braces, since a leaked portal URL is a real problem.)
      filter: (page) =>
        !page.includes("/one-pager") &&
        !page.includes("/preview/") &&
        !page.includes("/portal/"),
    }),
  ],
  // maxDuration covers the one-pager PDF route's Chromium cold-start + render
  // (src/pages/schools/[school]/one-pager.pdf.ts).
  adapter: vercel({ includeFiles: ogIncludeFiles, maxDuration: 60 }),

  vite: {
    plugins: [tailwindcss()],
  },
});
