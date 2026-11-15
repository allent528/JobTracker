/** Routes reachable while signed out. Everything else redirects to /login (F1). */
export const PUBLIC_PATHS = ["/login", "/auth/confirm"] as const;

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const BASE = "http://jobtracker.invalid";

// URL parsers drop tabs/newlines and treat "\" like "/", so "/\t/x" or "/\x" can become "//x".
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

/**
 * Returns `next` only if it is a same-origin relative path, otherwise `/`.
 * Blocks open redirects such as `//evil.com`, `/\evil.com` and `https://evil.com`.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE_CHARS.test(next)) {
    return HOME_PATH;
  }
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE || isPublicPath(url.pathname)) return HOME_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return HOME_PATH;
  }
}
