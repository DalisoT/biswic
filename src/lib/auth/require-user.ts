/**
 * Current-user helper for server components, server actions, and route handlers.
 * ----------------------------------------------------------------------------
 * Replaces the old `const session = await auth(); session.user` pattern.
 *
 * - `getUser()` returns the typed AuthUser or null (no side effects).
 * - `requireUser()` returns the typed AuthUser, or redirects to /login.
 * - `requireUserOrError()` returns a discriminated union for server actions
 *   that should return an error instead of triggering a redirect.
 *
 * The AuthUser shape mirrors the fields the app actually uses: id, service
 * number, role, full name, email. Anything else should be fetched from
 * Prisma with the id.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export type AuthUser = {
  id: string;
  serviceNumber: string;
  role: string;
  email: string;
  fullName: string;
};

export type AuthResult<T> =
  | { ok: true; user: AuthUser; data?: T }
  | { ok: false; error: string };

/**
 * Read the current Supabase session + the corresponding public.User row.
 * Returns null when there is no authenticated user.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      serviceNumber: true,
      role: true,
      email: true,
      fullName: true,
    },
  });
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    serviceNumber: dbUser.serviceNumber,
    role: dbUser.role,
    email: dbUser.email ?? authUser.email ?? '',
    fullName: dbUser.fullName,
  };
}

/**
 * Server-component / route-handler version. Redirects to /login if there
 * is no authenticated user.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Server-action version. Returns a discriminated union so the caller can
 * choose how to surface the error (returned to the form vs. thrown).
 */
export async function requireUserOrError(): Promise<
  { ok: true; user: AuthUser } | { ok: false; error: string }
> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };
  return { ok: true, user };
}
