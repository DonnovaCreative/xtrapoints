// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Single source of truth for the brand/domain (see src/config/brand.ts).
import { brand } from './src/config/brand.ts';

// https://astro.build/config
export default defineConfig({
  // Production domain — follows the brand toggle. Make sure the Vercel custom
  // domain matches this (xtrapoint.com vs xtrapoints.com).
  site: brand.url,

  // Static build. The Vercel adapter ships the prerendered output to Vercel's
  // static hosting; no SSR runtime is used (the contact form posts client-side).
  output: 'static',

  integrations: [react(), sitemap()],
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
  },
});
