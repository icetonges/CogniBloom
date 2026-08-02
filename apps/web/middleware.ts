import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from './auth.config'

// Edge-runtime auth check. Only wraps the routes listed in `config.matcher`
// below -- everything else (homepage, published note pages, the rest of the
// dashboard) is untouched and stays public, matching the current product
// scope: only the Planner and Notes sections require login.
const { auth } = NextAuth(authConfig)

const PROTECTED_API_PREFIXES = ['/api/planner', '/api/notes']
const PROTECTED_PAGE_PREFIXES = ['/dashboard/planner', '/dashboard/notes']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth?.user

  if (isLoggedIn) return NextResponse.next()

  if (PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.json({ error: 'Unauthorized -- please log in' }, { status: 401 })
  }

  if (PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/planner/:path*',
    '/dashboard/notes/:path*',
    '/api/planner/:path*',
    '/api/notes/:path*',
  ],
}
