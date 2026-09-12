import type { APIContext } from 'astro';
import { findPortalPartner, getPortalIdentity } from '../../lib/portalAuth';
import { canAccessPartner } from '../../lib/portalPermissions';

/** Off by default: content, search and binary downloads share the same gate. */
export function resourceCenterIsPublic() {
  return (process.env.XP_RESOURCE_CENTER_PUBLIC ?? import.meta.env.XP_RESOURCE_CENTER_PUBLIC) === 'true';
}
export async function gateResourceCenter(context: Pick<APIContext, 'locals' | 'redirect'>): Promise<Response | undefined> {
  if (import.meta.env.DEV || resourceCenterIsPublic()) return;
  if (typeof context.locals.auth !== 'function') return new Response('Resource Center preview is not available.', { status: 404 });
  try {
    const identity = await getPortalIdentity(context);
    if (identity?.isStaff) return;
    if (identity && (identity.partnerId || identity.schoolSlug)) {
      const partner = await findPortalPartner({ partnerId: identity.partnerId, school: identity.schoolSlug });
      if (partner && canAccessPartner(identity, partner, 'read')) return;
    }
  } catch {
    return new Response('Account verification is temporarily unavailable. Please try again.', { status: 503, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
  }
  return new Response('Resource Center preview is not available.', { status: 404, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
}
