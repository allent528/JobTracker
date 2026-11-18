"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

const LINK =
  "relative inline-flex h-11 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground " +
  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-foreground after:transition-transform after:duration-(--duration-fast) " +
  "aria-[current=page]:text-foreground aria-[current=page]:after:scale-x-100";

/** The current section is the longest link that prefixes the path ("/" only matches itself). */
function currentHref(links: readonly NavLink[], pathname: string | null): string | null {
  if (!pathname) return null;
  const matches = links.filter(({ href }) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function MainNavLinks({ links, active }: { links: readonly NavLink[]; active?: string | null }) {
  return links.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={href === active ? "page" : undefined} className={LINK}>
      {label}
    </Link>
  ));
}

/** Reads the path, so the layout renders it inside Suspense with the plain links as the fallback. */
export function MainNavActive({ links }: { links: readonly NavLink[] }) {
  return <MainNavLinks links={links} active={currentHref(links, usePathname())} />;
}
