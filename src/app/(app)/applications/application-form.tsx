"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTransition } from "react";
import { type Control, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_MODE_LABELS, WORK_MODES } from "@/lib/closed-sets";
import { TEXT_LIMITS } from "@/lib/limits";
import type { ActionResult } from "@/lib/action-result";
import { type ApplicationFormValues, applicationSchema } from "@/lib/schemas/application";
import { toastResult } from "@/lib/toast-result";

type TextFieldName = Exclude<keyof ApplicationFormValues, "work_mode">;

const LIMITS = TEXT_LIMITS.applications;

export function ApplicationForm({
  action,
  submitLabel,
  defaultValues,
  cancelHref,
}: {
  /** Redirects on success, so it only returns errors. */
  action: (input: ApplicationFormValues) => Promise<ActionResult<never>>;
  submitLabel: string;
  defaultValues: ApplicationFormValues;
  cancelHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema, undefined, { raw: true }),
    defaultValues,
  });

  // Raw mode keeps the string inputs; the action parses them with the same schema (D14).
  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      toastResult(await action(values));
    });
  });

  const control = form.control;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-8 rounded-lg border bg-card p-4 sm:p-6">
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-heading">Job</legend>
          <TextField control={control} name="company" label="Company" maxLength={LIMITS.company} required />
          <TextField
            control={control}
            name="role_title"
            label="Role title"
            maxLength={LIMITS.role_title}
            required
          />
          <TextField
            control={control}
            name="job_url"
            label="Job posting URL"
            type="url"
            inputMode="url"
            maxLength={LIMITS.job_url}
            className="sm:col-span-2"
          />
          <TextField control={control} name="location" label="Location" maxLength={LIMITS.location} />
          <FormField
            control={control}
            name="work_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work mode</FormLabel>
                <FormControl>
                  <NativeSelect {...field} className="w-full">
                    <NativeSelectOption value="">Not set</NativeSelectOption>
                    {WORK_MODES.map((mode) => (
                      <NativeSelectOption key={mode} value={mode}>
                        {WORK_MODE_LABELS[mode]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField
            control={control}
            name="source"
            label="Source"
            description="Where you found it, e.g. LinkedIn or a referral."
            maxLength={LIMITS.source}
          />
          <TextField
            control={control}
            name="date_applied"
            label="Date applied"
            type="date"
            description="Setting this on a new application starts it in Applied."
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-3">
          <legend className="mb-3 text-heading">Salary range</legend>
          <TextField control={control} name="salary_min" label="Minimum" inputMode="numeric" />
          <TextField control={control} name="salary_max" label="Maximum" inputMode="numeric" />
          <TextField
            control={control}
            name="salary_currency"
            label="Currency"
            maxLength={3}
            autoCapitalize="characters"
            description="3-letter code, e.g. USD."
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-heading">Follow-up</legend>
          <TextField control={control} name="next_follow_up_on" label="Next follow-up" type="date" />
          <TextField
            control={control}
            name="follow_up_note"
            label="Follow-up note"
            maxLength={LIMITS.follow_up_note}
          />
        </fieldset>

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <span className="mb-1 text-heading">Description</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={8} maxLength={LIMITS.description} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="-mx-4 -mb-4 flex flex-col-reverse gap-3 border-t px-4 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6">
          <Button asChild variant="outline">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TextField({
  control,
  name,
  label,
  description,
  className,
  required,
  ...inputProps
}: {
  control: Control<ApplicationFormValues>;
  name: TextFieldName;
  label: string;
  description?: string;
  className?: string;
  required?: boolean;
} & Pick<React.ComponentProps<"input">, "type" | "inputMode" | "maxLength" | "autoCapitalize">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span aria-hidden="true">*</span>}
          </FormLabel>
          <FormControl>
            <Input aria-required={required} {...inputProps} {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
