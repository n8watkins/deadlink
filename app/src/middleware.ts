import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    
    // If accessing login/signup with session, redirect to dashboard
    if ((pathname === '/login' || pathname === '/signup') && req.nextauth.token) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Public routes that don't require authentication
        const publicRoutes = ['/', '/login', '/signup', '/forgot-password']
        
        // Allow access to public routes
        if (publicRoutes.includes(pathname)) {
          return true
        }
        
        // Require authentication for dashboard routes
        if (pathname.startsWith('/dashboard')) {
          return !!token
        }
        
        // Allow access to other routes
        return true
      },
    },
  }
)

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}