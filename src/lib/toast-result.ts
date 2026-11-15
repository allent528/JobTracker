import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

/** Client only. Shows the action's error, or `success` if given; returns whether it succeeded. */
export function toastResult(result: ActionResult<unknown>, success?: string): boolean {
  if (!result.ok) toast.error(result.error);
  else if (success) toast.success(success);
  return result.ok;
}
