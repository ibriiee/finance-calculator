import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')
  // /auth/* (password reset) must stay reachable even with a session — the
  // recovery flow carries its own short-lived recovery session, so a logged-in
  // check here would bounce the user to /dashboard before they can reset.
  const isAuthPage = isLoginPage || pathname.startsWith('/auth')

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

// Matcher intentionally does NOT exclude /api: a logged-out request to an API
// route falls through the `!user && !isAuthPage` branch above and gets a
// 307 redirect to /login (HTML) instead of a JSON 401. This is a deliberate
// tradeoff — the session-refresh side effect of running the proxy on API
// routes is useful. Any NEW API route must self-guard with its own
// `auth.getUser()` check (see src/app/api/rates/route.ts) rather than relying
// on this matcher for a clean JSON error.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|avatars).*)'],
}
