// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Single source of truth for the brand/domain (see src/config/brand.ts).
import { brand } from './src/config/brand.ts';
import { schools } from './src/data/schools.ts';

// Assets the on-demand OG endpoint (src/pages/schools/[school]/og.png.ts) reads
// from disk at runtime. `includeFiles` forces them into the serverless function
// bundle since they aren't traced from imports. Phase 2 note: once school logos
// live on the Sanity CDN, drop the per-school logo lines (fonts stay bundled).
const ogIncludeFiles = [
  './src/og/fonts/Anton-Regular.ttf',
  './src/og/fonts/PermanentMarker-Regular.ttf',
  './src/og/fonts/SpaceMono-Bold.ttf',
  `./public${brand.logo.white}`,
  ...schools.filter((s) => s.logo).map((s) => `./public${s.logo}`),
];

// https://astro.build/config
export default defineConfig({
  // Production domain — follows the brand toggle. Make sure the Vercel custom
  // domain matches this (xtrapoint.com vs xtrapoints.com).
  site: brand.url,

  // Static build. The Vercel adapter ships the prerendered output to Vercel's
  // static hosting; no SSR runtime is used (the contact form posts client-side).
  output: 'static',

  integrations: [react(), sitemap()],
  adapter: vercel({ includeFiles: ogIncludeFiles }),

  vite: {
    plugins: [tailwindcss()],
  },
});
