"use client";

import { useTransition } from "react";

import { STATUS_META, type Status } from "@/lib/status";
import { toastResult } from "@/lib/toast-result";

import { changeStatus } from "./actions";

/** Shared by the detail page and (step 5) the board, which can add `useOptimistic` around `change`. */
export function useChangeStatus() {
  const [pending, startTransition] = useTransition();

  function change(id: string, status: Status) {
    startTransition(async () => {
      toastResult(await changeStatus({ id, status }), `Moved to ${STATUS_META[status].label}.`);
    });
  }

  return { pending, change };
}
