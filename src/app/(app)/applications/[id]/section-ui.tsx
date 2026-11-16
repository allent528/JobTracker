"use client";

import { useState, useTransition } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, UNREACHABLE_ERROR } from "@/lib/action-result";
import { toastResult } from "@/lib/toast-result";

// Shared pieces of the detail page's notes, contacts and interviews sections.

/**
 * Runs a Server Action in a transition and toasts its result. A rejected call (offline, server
 * down) toasts UNREACHABLE_ERROR instead of reaching the error boundary.
 */
export function useSectionAction() {
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<ActionResult<T>>, success: string, onSuccess?: (data: T) => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (toastResult(result, success) && result.ok) onSuccess?.(result.data);
      } catch {
        toast.error(UNREACHABLE_ERROR);
      }
    });
  }

  return { pending, run };
}

type FieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <FormLabel>
      {label}
      {required && <span aria-hidden="true">*</span>}
    </FormLabel>
  );
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...inputProps
}: FieldProps<T> & Pick<React.ComponentProps<"input">, "type" | "inputMode" | "maxLength" | "autoComplete">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
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

export function TextAreaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  rows = 4,
  maxLength,
}: FieldProps<T> & { rows?: number; maxLength?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Textarea aria-required={required} rows={rows} maxLength={maxLength} {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function FormButtons({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}

/** Delete behind a confirm dialog (ui.md). `label` names the row for screen readers. */
export function ConfirmDeleteButton({
  label,
  title,
  description,
  confirmLabel,
  success,
  action,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  action: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useSectionAction();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={label}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              // Keep the dialog open until the action finishes.
              event.preventDefault();
              run(action, success, () => setOpen(false));
            }}
          >
            {pending ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
