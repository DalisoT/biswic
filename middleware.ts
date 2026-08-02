/**
 * Next.js middleware: refreshes the Supabase Auth session on every request.
 * ----------------------------------------------------------------------------
 * Without this, the user's session goes stale after the access token's
 * expiry (default 1h) and they'll be randomly signed out.
 *
 * The matcher excludes static assets and Next.js internals.
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
