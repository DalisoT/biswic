/**
 * Stub for the legacy NextAuth route.
 * --------------------------------------------------------------------------
 * NextAuth was removed when we migrated to Supabase Auth. This file is kept
 * so that any stale client-side links (e.g. older service workers, bookmarks,
 * or third-party OAuth callbacks) get a clean 404 instead of a 500 from a
 * missing module. The Supabase auth flow lives under /auth/callback instead.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Not found', message: 'NextAuth is no longer in use.' },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Not found', message: 'NextAuth is no longer in use.' },
    { status: 404 },
  );
}
