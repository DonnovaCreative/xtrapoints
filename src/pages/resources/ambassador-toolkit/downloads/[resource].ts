import type { APIRoute } from 'astro';
import { getToolkitPublication, toolkitPublicationHelpers } from '@/data/toolkitCms';
import { gateResourceCenter } from '@/data/toolkit/access';
export const prerender = false;
const files = import.meta.glob<{ default: { filename: string; base64: string } }>('../../../../data/toolkit/downloads/*.json');
const mime: Record<string, string> = { PDF: 'application/pdf', DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
export const GET: APIRoute = async context => {
  const denied = await gateResourceCenter(context); if (denied) return denied;
  const { toolkit } = await getToolkitPublication();
  const { resourceById } = toolkitPublicationHelpers(toolkit);
  const resource = resourceById(context.params.resource);
  const load = resource && files[`../../../../data/toolkit/downloads/${resource.id}.json`];
  if (!resource || !load) return new Response('Download not found.', { status: 404 });
  const { default: file } = await load();
  return new Response(new Uint8Array(Buffer.from(file.base64, 'base64')), { headers: { 'Content-Type': mime[resource.format], 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-Toolkit-Version': toolkit.release.version } });
};
