"use client";

import { useTransition } from "react";

import { STATUS_META, type Status } from "@/lib/status";
import { toastResult } from "@/lib/toast-result";

import { changeStatus } from "./actions";

export type StatusMove = { id: string; status: Status };

/**
 * Shared by the detail page and the board. The board passes a `useOptimistic` setter, which runs
 * inside the transition: the move shows at once and rolls back if the action fails (D12).
 */
export function useChangeStatus(applyOptimistic?: (move: StatusMove) => void) {
  const [pending, startTransition] = useTransition();

  function change(id: string, status: Status) {
    startTransition(async () => {
      applyOptimistic?.({ id, status });
      toastResult(await changeStatus({ id, status }), `Moved to ${STATUS_META[status].label}.`);
    });
  }

  return { pending, change };
}
