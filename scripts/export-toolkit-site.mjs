#!/usr/bin/env node
/** Export the exact native resource UI to the existing private Sites checkout.
 * A disposable Astro project strips application auth only for the owner-only
 * Sites artifact. The main website's protected routes are never changed.
 */
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile, symlink } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = process.argv[2];
if (!dest) throw new Error("Supply the existing Sites checkout as the export destination.");
const hosting = JSON.parse(await readFile(join(dest, ".openai/hosting.json"), "utf8"));
if (hosting.project_id !== "appgprj_6aa488e01e4c8191924c00e72a868b7e")
  throw new Error("This export is bound to the retained XtraPoint private Site.");
const work = await mkdtemp(join(tmpdir(), "xp-toolkit-export-"));
await cp(join(repo, "src"), join(work, "src"), {
  recursive: true,
  filter: (p) => !p.startsWith(join(repo, "src/pages")) && !p.endsWith("/middleware.ts"),
});
await mkdir(join(work, "src/pages"), { recursive: true });
await cp(join(repo, "src/pages/resources"), join(work, "src/pages/resources"), { recursive: true });
await cp(join(repo, "tsconfig.json"), join(work, "tsconfig.json"));
await symlink(join(repo, "node_modules"), join(work, "node_modules"), "dir");
await cp(join(repo, "package.json"), join(work, "package.json"));
await writeFile(
  join(work, "astro.config.mjs"),
  `import {defineConfig} from 'astro/config';import react from '@astrojs/react';import tailwindcss from '@tailwindcss/vite';export default defineConfig({site:'https://xtrapoint-ambassador-toolkit.coreythedesigner.chatgpt.site',output:'static',integrations:[react()],vite:{plugins:[tailwindcss()],ssr:{noExternal:['@astrojs/react']}}});`,
);
// Only toolkit content enters this export, never school records or identity data.
await writeFile(
  join(work, "src/data/toolkitCms.ts"),
  `import {toolkit,resourceById,articleById,articlesFor} from './toolkit';export const getToolkitPublication=async()=>({toolkit});export const toolkitPublicationHelpers=()=>({resourceById,articleById,articlesFor});`,
);
await writeFile(
  join(work, "src/data/toolkit/access.ts"),
  `export const resourceCenterIsPublic=()=>false;export const gateResourceCenter=async()=>undefined;`,
);
async function files(dir) {
  return (
    await Promise.all(
      (
        await readdir(dir, { withFileTypes: true })
      ).map(async (entry) =>
        entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
      ),
    )
  ).flat();
}
for (const path of await files(join(work, "src/pages/resources"))) {
  let source = (await readFile(path, "utf8")).replace(
    "export const prerender = false;",
    "export const prerender = true;",
  );
  if (path.endsWith("[article].astro"))
    source = source.replace(
      "export const prerender = true;",
      `export const prerender = true;import {toolkit as exportToolkit} from '@/data/toolkit';export function getStaticPaths(){return exportToolkit.articles.map(article=>({params:{resource:article.resource,article:article.id}}));}`,
    );
  else if (path.includes("[resource]"))
    source = source.replace(
      "export const prerender = true;",
      `export const prerender = true;import {toolkit as exportToolkit} from '@/data/toolkit';export function getStaticPaths(){return exportToolkit.resources.map(resource=>({params:{resource:resource.id}}));}`,
    );
  await writeFile(path, source);
}
// An ordinary download link retains a human-readable filename on static hosting.
for (const path of await files(join(work, "src"))) {
  if (!path.endsWith(".astro")) continue;
  let source = await readFile(path, "utf8");
  source = source.replaceAll(
    "href={resource.download.href}",
    "href={resource.download.href} download={resource.download.filename}",
  );
  await writeFile(path, source);
}
const layout = join(work, "src/layouts/ResourceLayout.astro");
await writeFile(
  layout,
  (await readFile(layout, "utf8"))
    .replace('href="/portal"', 'href="https://xtrapoint.com/portal"')
    .replace('href="/" aria-label', 'href="/resources" aria-label'),
);
const build = spawnSync(
  process.execPath,
  [join(repo, "node_modules/astro/bin/astro.mjs"), "build"],
  {
    cwd: work,
    stdio: "inherit",
    env: { ...process.env, XP_RESOURCE_CENTER_PUBLIC: "false", VERCEL_ENV: "preview" },
  },
);
if (build.status !== 0) throw new Error(`Toolkit static export failed (${build.status}).`);
await cp(join(work, "dist"), join(dest, "public"), { recursive: true });
for (const name of [
  "fonts",
  "favicon.svg",
  "assets/xtrapoint-logo-navy.svg",
  "assets/xtrapoint-logo-white.svg",
  "assets/og-image-xp.jpg",
]) {
  const source = join(repo, "public", name);
  try {
    await mkdir(dirname(join(dest, "public", name)), { recursive: true });
    await cp(source, join(dest, "public", name), { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const publication = JSON.parse(await readFile(join(repo, "src/data/toolkit/content.json"), "utf8"));
await writeFile(
  join(dest, "public/native-toolkit-release.json"),
  JSON.stringify(
    {
      version: publication.release.version,
      release: publication.release,
      resources: publication.resources.map((r) => ({ id: r.id, download: r.download })),
      source: "XtraPoint native Resource Center",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  `Exported ${publication.articles.length} native articles and six downloads into the existing Site. Temporary build: ${work}`,
);
