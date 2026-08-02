/**
 * NextAuth type augmentation — adds our custom fields to Session.user and User.
 * Without this, TypeScript doesn't know about role / serviceNumber on session.user.
 */

import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      serviceNumber: string;
      role: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    serviceNumber: string;
    role: string;
    isActive: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    serviceNumber: string;
    role: string;
  }
}
