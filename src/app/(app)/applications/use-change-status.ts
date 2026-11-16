"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { UNREACHABLE_ERROR } from "@/lib/action-result";
import { STATUS_META, type Status } from "@/lib/status";
import { toastResult } from "@/lib/toast-result";

import { changeStatus } from "./actions";

export type StatusMove = { id: string; status: Status };

/**
 * `applyOptimistic` (a `useOptimistic` setter) must run inside the transition; React drops the
 * optimistic value when the transition ends, which is the rollback on failure.
 */
export function useChangeStatus(applyOptimistic?: (move: StatusMove) => void) {
  const [pending, startTransition] = useTransition();

  function change(id: string, status: Status) {
    startTransition(async () => {
      applyOptimistic?.({ id, status });
      try {
        toastResult(await changeStatus({ id, status }), `Moved to ${STATUS_META[status].label}.`);
      } catch {
        // A rejected Server Action (offline, server down) would otherwise reach the error boundary.
        toast.error(UNREACHABLE_ERROR);
      }
    });
  }

  return { pending, change };
}
