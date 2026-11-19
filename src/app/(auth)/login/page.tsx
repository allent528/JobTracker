import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { OTP_LENGTH } from "@/lib/schemas/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · JobTracker" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm gap-5 rounded-lg">
        <CardHeader>
          <h1 className="text-title">Sign in to JobTracker</h1>
          <CardDescription>
            We&apos;ll email you a sign-in link and a {OTP_LENGTH}-digit code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-32" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
