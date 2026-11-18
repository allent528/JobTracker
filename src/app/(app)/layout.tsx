import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { APPLICATIONS_PATH } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { HOME_PATH, SETTINGS_PATH } from "@/lib/auth-routes";
import { getStoredTimeZone } from "@/lib/profile";
import { STATS_PATH } from "@/lib/stats";

import { signOut } from "./actions";
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
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href={HOME_PATH} className="font-semibold tracking-tight">
            JobTracker
          </Link>
          <nav aria-label="Main" className="order-last flex w-full gap-4 text-sm sm:order-none sm:w-auto">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
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
