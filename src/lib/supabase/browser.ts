'use client';

/**
 * Supabase client for client components.
 * ----------------------------------------------------------------------------
 * Wraps @supabase/ssr's createBrowserClient. Use this from any component
 * marked 'use client' that needs to read or write Supabase data from the
 * browser.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase/browser';
 *   const supabase = createClient();
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
