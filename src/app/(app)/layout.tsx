import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

import { signOut } from "./actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            JobTracker
          </Link>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.email && (
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">{user.email}</span>
      )}
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
