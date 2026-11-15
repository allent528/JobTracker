/**
 * The two public Supabase settings. Read with literal `process.env.NEXT_PUBLIC_*`
 * access so Next inlines them into the browser bundle; read at call time so a
 * build without them still succeeds.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set (copy .env.example to .env.local).",
    );
  }
  return { url, publishableKey };
}
