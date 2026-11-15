---
paths:
  - "src/proxy.ts"
  - "src/lib/supabase/**"
  - "src/lib/auth*.ts"
  - "src/app/(auth)/**"
  - "src/app/auth/**"
---

# Auth: Supabase SSR, sessions, route protection

Load the `supabase` skill before changing anything here. Changes in this area always get the **security-reviewer** agent.

## Conventions
- Two clients only, from `@supabase/ssr`: `src/lib/supabase/server.ts` (`createServerClient` with Next.js `cookies()`) and `src/lib/supabase/client.ts` (`createBrowserClient`). The one exception is `src/lib/supabase/proxy.ts` (`updateSession`), which binds a server client to the proxy's request/response cookies. Never create ad-hoc clients elsewhere.
- `src/proxy.ts` (Next 16's renamed middleware) calls `updateSession`: it refreshes the session on every request, redirects signed-out users to `/login?next=<path>`, and sends signed-in users from `/login` to `/`. The public routes are `PUBLIC_PATHS` in `src/lib/auth-routes.ts` (`/login`, `/auth/confirm`; no `/auth/callback` because there's no OAuth), plus static assets excluded by the matcher.
- Server code gets the user from `getCurrentUser()` in `src/lib/auth.ts` (getClaims, redirects to /login, deduped per request). Redirect targets go through `safeNextPath()`.
- Sign-in sends one email with both a magic link and a 6-digit code (D16). The login page accepts the code via `verifyOtp({ email, token, type: 'email' })`; the link goes to `/auth/confirm` (PKCE `token_hash` exchange). The Magic Link template builds the link as `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and shows `{{ .Token }}`; locally it's `supabase/templates/magic_link.html`, in prod the dashboard template.
- Both sign-in steps are Server Actions in `src/app/(auth)/login/actions.ts`; sign-out is `signOut({ scope: 'local' })` in `src/app/(app)/actions.ts`.
- Use `shouldCreateUser: false` in `signInWithOtp`. Public sign-ups are also disabled in the hosted project's Auth settings (and `enable_signup = false` in `supabase/config.toml` locally).

## Must / must not
- On the server, trust `supabase.auth.getUser()` (or `getClaims()`), never `getSession()`, for authorization decisions; `getSession()` reads an unverified cookie.
- Every Server Action and Route Handler that touches data re-checks the user. The proxy alone is not authorization.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the app. The secret key is never imported in `src/`.
- Redirect targets after sign-in must be same-origin relative paths (no open redirects via `?next=`).
- Login errors don't reveal whether an email has an account.

## Lessons learned
- With `cacheComponents` + `partialPrefetching`, Next prerenders/prefetches with cookies available, and `getClaims()` reads `Date.now()` synchronously, which fails the render ("unstable value `Date.now()`"). `getCurrentUser()` calls `await connection()` first so auth only runs for a real request. Keep it that way for any new session read.
- Next dev logs every Server Function call with its arguments (emails, OTP codes). `logging.serverFunctions: false` in `next.config.ts` keeps them out of the terminal; don't turn it back on.
- `signInWithOtp` with `shouldCreateUser: false` returns 422 `otp_disabled` for an unknown email. The action maps every 4xx to the same "check your email" answer and reports only 5xx/network failures.
