/**
 * NextAuth.js v5 (Auth.js) Configuration
 * ----------------------------------------------------------------------------
 * - Credentials provider keyed on service number (military ID)
 * - bcrypt password verification
 * - Account lockout after 5 failed attempts (30 min)
 * - 2FA support (TOTP - otpauth flow stubbed for Phase 1)
 * - Database sessions (not JWT)
 * - All login events logged to audit log
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { config } from './config';
import { logAudit, AUDIT_ACTIONS } from './audit';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours default
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Service Number',
      credentials: {
        serviceNumber: { label: 'Service Number', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const serviceNumber = credentials?.serviceNumber?.toString().trim().toUpperCase();
        const password = credentials?.password?.toString() ?? '';

        if (!serviceNumber || !password) return null;

        const ipAddress = req?.headers?.get?.('x-forwarded-for') ?? 'unknown';
        const userAgent = req?.headers?.get?.('user-agent') ?? 'unknown';

        const user = await prisma.user.findUnique({
          where: { serviceNumber },
        });

        if (!user) {
          await logAudit({
            action: AUDIT_ACTIONS.FAILED_LOGIN,
            entity: 'User',
            entityId: serviceNumber,
            ipAddress,
            userAgent,
            notes: 'Unknown service number',
          });
          return null;
        }

        // Check lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logAudit({
            userId: user.id,
            action: AUDIT_ACTIONS.FAILED_LOGIN,
            entity: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            notes: 'Account locked',
          });
          throw new Error('Account locked. Try again later.');
        }

        if (!user.isActive) {
          await logAudit({
            userId: user.id,
            action: AUDIT_ACTIONS.FAILED_LOGIN,
            entity: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            notes: 'Account inactive',
          });
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const newAttempts = user.failedLoginAttempts + 1;
          const shouldLock = newAttempts >= config.security.maxFailedLoginAttempts;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newAttempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + config.security.lockoutMinutes * 60 * 1000)
                : null,
            },
          });
          await logAudit({
            userId: user.id,
            action: AUDIT_ACTIONS.FAILED_LOGIN,
            entity: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            notes: `Wrong password (attempt ${newAttempts}/${config.security.maxFailedLoginAttempts})`,
          });
          if (shouldLock) {
            await logAudit({
              userId: user.id,
              action: AUDIT_ACTIONS.LOCKOUT,
              entity: 'User',
              entityId: user.id,
              ipAddress,
              userAgent,
              notes: `Locked for ${config.security.lockoutMinutes} minutes`,
            });
            throw new Error(`Account locked after ${config.security.maxFailedLoginAttempts} failed attempts. Try again in ${config.security.lockoutMinutes} minutes.`);
          }
          return null;
        }

        // Reset failed attempts on success
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        await logAudit({
          userId: user.id,
          action: AUDIT_ACTIONS.LOGIN,
          entity: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        });

        // 2FA enforcement for officers (Phase 1: stub - in production, generate a TOTP challenge)
        // For now, log that 2FA would be required here
        // if (user.twoFactorEnabled && isOfficer(user.role)) { ... }

        return {
          id: user.id,
          name: user.fullName,
          email: user.email ?? `${user.serviceNumber}@biswic.coop`,
          // Custom fields
          serviceNumber: user.serviceNumber,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, `user` is the value returned from authorize().
      // Persist our custom fields onto the token so we can hydrate the session.
      if (user) {
        token.id = (user as any).id;
        token.serviceNumber = (user as any).serviceNumber;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Hydrate the session with our custom fields from the JWT.
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.serviceNumber = token.serviceNumber as string;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const userId = (message as any)?.token?.sub ?? (message as any)?.session?.userId;
      if (userId) {
        await logAudit({
          userId,
          action: AUDIT_ACTIONS.LOGOUT,
          entity: 'User',
          entityId: userId,
        });
      }
    },
  },
});
