// Re-export NextAuth functions for compatibility
export { signIn, signOut } from 'next-auth/react'
export { getServerSession } from 'next-auth'
export { authConfig } from './auth-config'

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'pro' | 'enterprise';
  emailVerified: boolean;
  apiKey: string;
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}