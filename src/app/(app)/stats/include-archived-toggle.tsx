"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { statsPath } from "@/lib/stats";

/** F9: every stat leaves archived applications out unless this is checked (`?archived=1`). */
export function IncludeArchivedToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="include-archived"
        checked={optimistic}
        onCheckedChange={(value) => {
          const next = value === true;
          startTransition(() => {
            setOptimistic(next);
            router.replace(statsPath(next), { scroll: false });
          });
        }}
      />
      <Label htmlFor="include-archived">Include archived applications</Label>
    </div>
  );
}
