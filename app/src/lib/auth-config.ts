import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authConfig: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787'
        
        try {
          const response = await fetch(`${API_URL}/api/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: credentials.email, 
              password: credentials.password 
            }),
          })

          if (!response.ok) {
            return null
          }

          const data = await response.json()
          
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            plan: data.user.plan,
            apiKey: data.user.apiKey,
            emailVerified: data.user.emailVerified
          }
        } catch (error) {
          return null
        }
      }
    }),
    CredentialsProvider({
      id: 'demo',
      name: 'Demo Login',
      credentials: {},
      async authorize(credentials, req) {
        console.log('Demo provider authorize called');
        // Return demo user data
        const user = {
          id: 'demo-user-123',
          email: 'demo@example.com',
          name: 'Demo User',
          plan: 'pro',
          apiKey: 'demo-api-key-xyz789',
          emailVerified: true
        };
        console.log('Demo user created:', user);
        return user;
      }
    })
  ],
  pages: {
    signIn: '/login',
    signUp: '/signup',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // For Google OAuth, we might need to register the user with our API
        if (account.provider === 'google') {
          const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787'
          
          try {
            const response = await fetch(`${API_URL}/api/auth/oauth`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: 'google',
                email: user.email,
                name: user.name,
                providerId: account.providerAccountId
              }),
            })

            if (response.ok) {
              const data = await response.json()
              token.plan = data.user.plan
              token.apiKey = data.user.apiKey
              token.emailVerified = data.user.emailVerified
            }
          } catch (error) {
            console.error('OAuth registration failed:', error)
          }
        } else {
          // For credentials/demo login, user data is already available
          token.plan = (user as { plan?: string }).plan
          token.apiKey = (user as { apiKey?: string }).apiKey
          token.emailVerified = (user as { emailVerified?: boolean }).emailVerified
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.plan = token.plan as string
        session.user.apiKey = token.apiKey as string
        session.user.emailVerified = token.emailVerified as boolean
      }
      
      return session
    }
  },
  session: {
    strategy: 'jwt',
  },
}