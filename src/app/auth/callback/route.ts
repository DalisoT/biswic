/**
 * Supabase auth code exchange route handler.
 * ----------------------------------------------------------------------------
 * Password-reset emails and signup confirmation emails contain a link with
 * a `code` query parameter pointing here. We exchange it for a Supabase
 * session, which sets the auth cookies on the response. We then redirect
 * the user to the page they were trying to reach (or /dashboard by default).
 *
 * This route must be added to the Supabase dashboard's "Additional
 * Redirect URLs" allowlist (Authentication -> URL Configuration).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
