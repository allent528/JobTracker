"use client";

import { Button } from "@/components/ui/button";

// The error isn't logged: messages can quote row values (server-actions.md).
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section role="alert" className="grid justify-items-start gap-4 rounded-lg border p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t load. Check your connection and try again.
      </p>
      <Button type="button" onClick={() => retry()}>
        Try again
      </Button>
    </section>
  );
}
