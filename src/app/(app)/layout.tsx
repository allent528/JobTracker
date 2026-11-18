import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { APPLICATIONS_PATH } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { HOME_PATH, SETTINGS_PATH } from "@/lib/auth-routes";
import { getStoredTimeZone } from "@/lib/profile";
import { STATS_PATH } from "@/lib/stats";

import { signOut } from "./actions";
import { MainNavActive, MainNavLinks } from "./main-nav";
import { TimeZoneDetector } from "./time-zone-detector";

const NAV_LINKS = [
  { href: HOME_PATH, label: "Reminders" },
  { href: APPLICATIONS_PATH, label: "Applications" },
  { href: STATS_PATH, label: "Stats" },
  { href: SETTINGS_PATH, label: "Settings" },
] as const;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 sm:flex-nowrap">
          <Link href={HOME_PATH} className="flex h-12 items-center font-semibold tracking-tight sm:h-14">
            JobTracker
          </Link>
          <nav
            aria-label="Main"
            className="order-last flex basis-full gap-5 border-t sm:order-none sm:flex-1 sm:basis-auto sm:border-t-0"
          >
            <Suspense fallback={<MainNavLinks links={NAV_LINKS} />}>
              <MainNavActive links={NAV_LINKS} />
            </Suspense>
          </nav>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-12 sm:pt-10">{children}</main>
      <Suspense fallback={null}>
        <DetectTimeZoneIfUnset />
      </Suspense>
    </>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.email && (
        <span className="hidden truncate text-sm text-muted-foreground lg:inline">{user.email}</span>
      )}
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}

/** A failed read skips detection here; the page's own reads surface the error in error.tsx. */
async function DetectTimeZoneIfUnset() {
  const stored = await getStoredTimeZone().catch(() => undefined);
  return stored === null ? <TimeZoneDetector /> : null;
}
