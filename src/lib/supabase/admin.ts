/**
 * Supabase admin client (server-only, SERVICE ROLE).
 * ----------------------------------------------------------------------------
 * Uses the service role key, which BYPASSES Row Level Security. Use ONLY
 * in trusted server code: seed scripts, admin helpers, and the
 * service-number -> email resolver in src/server/actions/auth.ts.
 *
 * NEVER import this from a 'use client' file. NEVER expose this to the
 * browser. The package.json CI grep check enforces this.
 *
 * Usage:
 *   import { createAdminClient } from '@/lib/supabase/admin';
 *   const supabase = createAdminClient();
 *   const { data } = await supabase.auth.admin.createUser({ ... });
 */

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
