export const PUBLIC_PATHS = ["/login", "/auth/confirm"] as const;

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";
export const SETTINGS_PATH = "/settings";

/** Query keys on /login: where to go after sign-in, and why the user landed there. */
export const NEXT_PARAM = "next";
export const ERROR_PARAM = "error";
export const LINK_ERROR = "link";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** `/login`, optionally with `?next=` (omitted for home) and `?error=link`. */
export function loginUrl({ next, error }: { next?: string; error?: typeof LINK_ERROR } = {}): string {
  const params = new URLSearchParams();
  if (next && next !== HOME_PATH) params.set(NEXT_PARAM, next);
  if (error) params.set(ERROR_PARAM, error);
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

const BASE = "http://jobtracker.invalid";

/**
 * Returns `next` only if it is a same-origin relative path, otherwise `/`.
 * The checks run on the normalized URL, because parsers rewrite the input:
 * `/.//evil.com` and `/a/..//evil.com` normalize to `//evil.com`, and `\`,
 * tabs and newlines are rewritten or dropped.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return HOME_PATH;
  try {
    const url = new URL(next, BASE);
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (url.origin !== BASE || path.startsWith("//") || isPublicPath(url.pathname)) {
      return HOME_PATH;
    }
    return path;
  } catch {
    return HOME_PATH;
  }
}
