import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      plan: string
      apiKey: string
      emailVerified: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    plan: string
    apiKey: string
    emailVerified: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    plan: string
    apiKey: string
    emailVerified: boolean
  }
}