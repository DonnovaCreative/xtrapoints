import type { APIRoute } from 'astro';
import { getToolkitPublication } from '@/data/toolkitCms';
import { gateResourceCenter } from '@/data/toolkit/access';
export const prerender = false;
export const GET: APIRoute = async context => {
  const denied = await gateResourceCenter(context); if (denied) return denied;
  const { toolkit } = await getToolkitPublication();
  const items = toolkit.articles.map(article => ({ title: article.title, href: article.href, resource: article.resource, resourceTitle: toolkit.resources.find(resource => resource.id === article.resource)!.title, kind: article.kind, text: article.text, category: article.category }));
  return Response.json({ version: toolkit.release.version, items }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
};
