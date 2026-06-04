// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Production apex domain — used for canonical URLs, sitemap, and OG tags.
  site: 'https://xtrapoints.com',

  // Static build. The Vercel adapter ships the prerendered output to Vercel's
  // static hosting; no SSR runtime is used (the contact form posts client-side).
  output: 'static',

  integrations: [react(), sitemap()],
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
  },
});
