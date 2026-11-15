import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · JobTracker" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">
            Sign in to JobTracker
          </h1>
          <CardDescription>We&apos;ll email you a sign-in link and a 6-digit code.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* The form reads ?next= and ?error=, which is request data. */}
          <Suspense fallback={<div className="h-32" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
