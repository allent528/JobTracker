---
paths:
  - "src/proxy.ts"
  - "src/lib/supabase/**"
  - "src/app/(auth)/**"
  - "src/app/auth/**"
---

# Auth: Supabase SSR, sessions, route protection

Load the `supabase` skill before changing anything here. Changes in this area always get the **security-reviewer** agent.

## Conventions
- Two clients only, from `@supabase/ssr`: `src/lib/supabase/server.ts` (`createServerClient` with Next.js `cookies()`) and `src/lib/supabase/client.ts` (`createBrowserClient`). Never create ad-hoc clients elsewhere.
- `src/proxy.ts` (Next 16's renamed middleware) refreshes the session on every request and redirects signed-out users to `/login`. Only `/login`, `/auth/callback` and `/auth/confirm` (plus static assets) are public.
- Sign-in sends one email with both a magic link and a 6-digit code (D16). The login page accepts the code via `verifyOtp({ email, token, type: 'email' })`; the link goes to `/auth/confirm` (PKCE `token_hash` exchange).
- Use `shouldCreateUser: false` in `signInWithOtp`. Public sign-ups are also disabled in the hosted project's Auth settings (and `enable_signup = false` in `supabase/config.toml` locally).

## Must / must not
- On the server, trust `supabase.auth.getUser()` (or `getClaims()`), never `getSession()`, for authorization decisions; `getSession()` reads an unverified cookie.
- Every Server Action and Route Handler that touches data re-checks the user. The proxy alone is not authorization.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the app. The secret key is never imported in `src/`.
- Redirect targets after sign-in must be same-origin relative paths (no open redirects via `?next=`).
- Login errors don't reveal whether an email has an account.

## Lessons learned
- (none yet)
