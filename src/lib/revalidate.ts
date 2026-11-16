import "server-only";

import { revalidatePath } from "next/cache";

import { APPLICATIONS_PATH, applicationPath } from "@/lib/applications";
import { HOME_PATH } from "@/lib/auth-routes";

/** Every page that lists applications: the pipeline and the home page's reminders (F8). */
export function revalidatePipeline(): void {
  revalidatePath(APPLICATIONS_PATH);
  revalidatePath(HOME_PATH);
}

export function revalidateApplication(id: string): void {
  revalidatePipeline();
  revalidatePath(applicationPath(id));
}

/** A time zone change moves "today" on every signed-in page (D11). */
export function revalidateAllPages(): void {
  revalidatePath(HOME_PATH, "layout");
}
