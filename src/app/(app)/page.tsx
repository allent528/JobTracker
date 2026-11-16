import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { APPLICATIONS_PATH } from "@/lib/applications";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RedirectToPipeline />
    </Suspense>
  );
}

/**
 * Redirects at request time. A redirect() during prerender fails Cache Components validation, and a
 * next.config redirect misses Server Action redirects to `/` (sign-in), which render in-process.
 */
async function RedirectToPipeline(): Promise<never> {
  await connection();
  redirect(APPLICATIONS_PATH);
}
