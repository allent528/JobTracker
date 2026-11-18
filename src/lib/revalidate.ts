import "server-only";

import { revalidatePath } from "next/cache";

import { APPLICATIONS_PATH, applicationPath } from "@/lib/applications";
import { HOME_PATH } from "@/lib/auth-routes";
import type { ChildTable } from "@/lib/owned-rows";
import { STATS_PATH } from "@/lib/stats";

export function revalidateApplicationLists(): void {
  revalidatePath(APPLICATIONS_PATH);
  revalidatePath(HOME_PATH);
  revalidatePath(STATS_PATH);
}

export function revalidateApplication(id: string): void {
  revalidateApplicationLists();
  revalidatePath(applicationPath(id));
}

/** Notes and contacts show only on the detail page; interviews also show on the home page. */
export function revalidateApplicationChild(table: ChildTable, applicationId: string): void {
  revalidatePath(applicationPath(applicationId));
  if (table === "interviews") revalidatePath(HOME_PATH);
}

export function revalidateAllPages(): void {
  revalidatePath(HOME_PATH, "layout");
}
