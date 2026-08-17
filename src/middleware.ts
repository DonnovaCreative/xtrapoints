// Clerk auth, scoped to the partner portal.
//
// Astro middleware is global by default, and with `output: 'static'` it also
// runs at BUILD time for every prerendered page. Handing all of that to Clerk
// would put an auth dependency in front of the marketing site, which is
// anonymous and static by design. So the guard comes first: anything outside the
// portal and the auth pages short-circuits before Clerk is involved at all.
//
// Inside that scope, clerkMiddleware only *populates* `context.locals.auth()` —
// it doesn't force a login. Deciding who gets in is gatePortal's job
// (src/lib/portalRoute.ts), because the portal has two ways in: a signed-in
// organization member, or a legacy Stage 0 token link.
import { clerkMiddleware } from "@clerk/astro/server";
import { defineMiddleware } from "astro:middleware";

const clerk = clerkMiddleware();

/** The only paths that need to know about auth. */
const SCOPE = /^\/(portal|sign-in|sign-up)(\/|$)/;

export const onRequest = defineMiddleware((context, next) => {
  if (!SCOPE.test(context.url.pathname)) return next();
  return clerk(context, next);
});
