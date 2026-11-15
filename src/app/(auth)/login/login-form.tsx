"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  OTP_LENGTH,
  type SignInEmailInput,
  signInEmailSchema,
  verifyCodeSchema,
} from "@/lib/schemas/auth";

import { requestSignInEmail, verifySignInCode } from "./actions";

const codeSchema = verifyCodeSchema.pick({ code: true });

const LINK_ERROR = "That sign-in link is invalid or has expired. Request a new one below.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState<string | null>(null);

  return email === null ? (
    <EmailStep
      initialError={searchParams.get("error") === "link" ? LINK_ERROR : null}
      onSent={setEmail}
    />
  ) : (
    <CodeStep email={email} next={next} onBack={() => setEmail(null)} />
  );
}

function EmailStep({
  initialError,
  onSent,
}: {
  initialError: string | null;
  onSent: (email: string) => void;
}) {
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();
  const form = useForm<SignInEmailInput>({
    resolver: zodResolver(signInEmailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(({ email }) => {
    setError(null);
    startTransition(async () => {
      const result = await requestSignInEmail({ email });
      if (result.ok) onSent(email);
      else setError(result.error);
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormAlert message={error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
    </Form>
  );
}

function CodeStep({
  email,
  next,
  onBack,
}: {
  email: string;
  next: string | null;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<{ code: string }>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => statusRef.current?.focus(), []);

  const onSubmit = form.handleSubmit(({ code }) => {
    setError(null);
    startTransition(async () => {
      // On success the action redirects, so a result only comes back on failure.
      const result = await verifySignInCode({ email, code }, next);
      if (!result.ok) setError(result.error);
    });
  });

  return (
    <div className="grid gap-4">
      <p ref={statusRef} tabIndex={-1} role="status" className="text-sm outline-none">
        If <span className="font-medium break-all">{email}</span> has an account, we sent it a
        sign-in link and a code. Open the link, or enter the code here.
      </p>
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{OTP_LENGTH}-digit code</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={OTP_LENGTH}
                    pattern="[0-9]*"
                    className="text-lg tracking-[0.3em]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormAlert message={error} />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
      <Button type="button" variant="link" onClick={onBack} className="justify-self-center">
        Use a different email
      </Button>
    </div>
  );
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
