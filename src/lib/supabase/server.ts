/**
 * Supabase client for server components, server actions, and route handlers.
 * ----------------------------------------------------------------------------
 * Uses the @supabase/ssr package, which wires up the cookie-based session
 * store that Supabase Auth needs in a Next.js App Router project.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase/server';
 *   const supabase = createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 * IMPORTANT: In Server Components, you cannot set cookies. The `set` and
 * `remove` handlers below swallow the error in that case; the actual
 * session refresh happens in the middleware (see src/lib/supabase/middleware.ts).
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component. The middleware handles the
            // session refresh on the next request, so this is safe to ignore.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}
