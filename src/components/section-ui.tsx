"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { type Control, type DefaultValues, type FieldPath, type FieldValues, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  AlertDialog,
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, UNREACHABLE_ERROR } from "@/lib/action-result";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";

/** A rejected call (offline, server down) would otherwise reach the error boundary. */
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

/** Raw mode: the action parses the same string values with the same schema (ui.md). */
export function useSectionForm<V extends FieldValues, T>(
  schema: z.ZodType<unknown, V>,
  {
    defaultValues,
    action,
    success,
    onDone,
  }: {
    defaultValues: V;
    action: (values: V) => Promise<ActionResult<T>>;
    success: string;
    onDone?: (data: T) => void;
  },
) {
  const { pending, run } = useSectionAction();
  const form = useForm<V>({
    resolver: zodResolver(schema as z.ZodType<V, V>, undefined, { raw: true }),
    defaultValues: defaultValues as DefaultValues<V>,
  });
  const onSubmit = form.handleSubmit((values) => run(() => action(values), success, onDone));
  return { form, pending, onSubmit };
}

type FieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
};

function FieldShell<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  render,
}: FieldProps<T> & { render: (field: { value: string; name: string }) => React.ReactNode }) {
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
          <FormControl>{render(field)}</FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextField<T extends FieldValues>({
  type,
  inputMode,
  maxLength,
  ...props
}: FieldProps<T> & Pick<React.ComponentProps<"input">, "type" | "inputMode" | "maxLength">) {
  return (
    <FieldShell
      {...props}
      render={(field) => (
        <Input aria-required={props.required} type={type} inputMode={inputMode} maxLength={maxLength} {...field} />
      )}
    />
  );
}

export function TextAreaField<T extends FieldValues>({
  rows = 4,
  maxLength,
  ...props
}: FieldProps<T> & { rows?: number; maxLength?: number }) {
  return (
    <FieldShell
      {...props}
      render={(field) => <Textarea aria-required={props.required} rows={rows} maxLength={maxLength} {...field} />}
    />
  );
}

export function SelectField<T extends FieldValues>({
  options,
  labels,
  ...props
}: FieldProps<T> & { options: readonly string[]; labels: Record<string, string> }) {
  return (
    <FieldShell
      {...props}
      render={(field) => (
        <NativeSelect {...field} className="w-full">
          {options.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {labels[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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

export type DeleteRow = {
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  action: () => Promise<ActionResult>;
};

function ConfirmDeleteButton({ label, title, description, confirmLabel, success, action }: DeleteRow & { label: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pending, run } = useSectionAction();

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => run(action, success, () => setConfirmOpen(false))}
          >
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A row with Edit and Delete. The caller keys it on the row's `updated_at`, so a saved edit
 * remounts it in view mode with the new values. `label` names the row for the buttons.
 */
export function EditableRow({
  label,
  remove,
  editForm,
  children,
}: {
  label: string;
  remove: DeleteRow;
  editForm: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return editForm(() => setEditing(false));

  return (
    <div className="grid gap-3">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <ConfirmDeleteButton label={`Delete ${label}`} {...remove} />
      </div>
    </div>
  );
}

/** Panel around an add form; the same form inside a list row needs no chrome of its own. */
export const ADD_FORM_PANEL = "rounded-lg border bg-card p-4";

/** A titled section in a bordered panel. The heading's id is `${id}-heading`. */
export function PanelSection({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn("grid min-w-0 content-start gap-3 rounded-lg border bg-card p-4 text-card-foreground sm:p-5", className)}
    >
      <h2 id={`${id}-heading`} className="text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Empty-state message: `row` inside a section or list, `page` when a whole view has nothing. */
export function Empty({ size = "row", children }: { size?: "row" | "page"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed text-muted-foreground",
        size === "row" ? "px-4 py-3 text-sm" : "bg-card p-8 text-center",
      )}
    >
      {children}
    </p>
  );
}
