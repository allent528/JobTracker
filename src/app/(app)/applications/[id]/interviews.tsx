"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Control, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import {
  INTERVIEW_KIND_LABELS,
  INTERVIEW_KINDS,
  INTERVIEW_OUTCOME_LABELS,
  INTERVIEW_OUTCOMES,
} from "@/lib/closed-sets";
import { type Contact, type Interview, interviewFormValues } from "@/lib/detail";
import { TEXT_LIMITS } from "@/lib/limits";
import {
  DURATION_MINUTES,
  EMPTY_INTERVIEW_FORM,
  type InterviewFormValues,
  interviewSchema,
} from "@/lib/schemas/interview";
import { INTERVIEWING_STATUS, STATUS_META } from "@/lib/status";

import { useChangeStatus } from "../use-change-status";
import { createInterview, deleteInterview, updateInterview } from "./actions";
import { ConfirmDeleteButton, FormButtons, TextAreaField, TextField, useSectionAction } from "./section-ui";

const LIMITS = TEXT_LIMITS.interviews;

type PickerContact = Pick<Contact, "id" | "name" | "title">;

function InterviewForm<T>({
  legend,
  submitLabel,
  defaultValues,
  contacts,
  timeZone,
  action,
  success,
  onDone,
  onCancel,
}: {
  legend: string;
  submitLabel: string;
  defaultValues: InterviewFormValues;
  contacts: PickerContact[];
  timeZone: string;
  action: (values: InterviewFormValues) => Promise<ActionResult<T>>;
  success: string;
  onDone: (data: T) => void;
  onCancel: () => void;
}) {
  const { pending, run } = useSectionAction();
  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewSchema, undefined, { raw: true }),
    defaultValues,
  });
  const control = form.control;

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-4 rounded-lg border p-4"
        onSubmit={form.handleSubmit((values) => run(() => action(values), success, onDone))}
      >
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold">{legend}</legend>
          <FormField
            control={control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <NativeSelect {...field} className="w-full">
                    {INTERVIEW_KINDS.map((kind) => (
                      <NativeSelectOption key={kind} value={kind}>
                        {INTERVIEW_KIND_LABELS[kind]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="outcome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outcome</FormLabel>
                <FormControl>
                  <NativeSelect {...field} className="w-full">
                    {INTERVIEW_OUTCOMES.map((outcome) => (
                      <NativeSelectOption key={outcome} value={outcome}>
                        {INTERVIEW_OUTCOME_LABELS[outcome]}
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
            name="scheduled_at"
            label="Date and time"
            type="datetime-local"
            description={`In your time zone, ${timeZone}.`}
            required
          />
          <TextField
            control={control}
            name="duration_minutes"
            label="Duration (minutes)"
            inputMode="numeric"
            description={`${DURATION_MINUTES.min} to ${DURATION_MINUTES.max.toLocaleString("en-US")}.`}
          />
          <TextField
            control={control}
            name="location"
            label="Location or video link"
            maxLength={LIMITS.location}
            className="sm:col-span-2"
          />
          <InterviewerPicker control={control} contacts={contacts} />
          <TextField
            control={control}
            name="interviewers"
            label="Other interviewers"
            description="Names of people who aren't contacts, if any."
            maxLength={LIMITS.interviewers}
            className="sm:col-span-2"
          />
          <TextAreaField
            control={control}
            name="notes"
            label="Notes about this round"
            maxLength={LIMITS.notes}
            rows={3}
            className="sm:col-span-2"
          />
        </fieldset>
        <FormButtons pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function InterviewerPicker({ control, contacts }: { control: Control<InterviewFormValues>; contacts: PickerContact[] }) {
  return (
    <FormField
      control={control}
      name="contact_ids"
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Interviewers from contacts</legend>
            {contacts.length === 0 ? (
              <FormDescription>Add contacts to this application to pick them here.</FormDescription>
            ) : (
              <ul className="grid gap-2">
                {contacts.map((contact) => {
                  const checked = field.value.includes(contact.id);
                  return (
                    <li key={contact.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`interviewer-${contact.id}`}
                        checked={checked}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next === true
                              ? [...field.value, contact.id]
                              : field.value.filter((id) => id !== contact.id),
                          )
                        }
                      />
                      <label htmlFor={`interviewer-${contact.id}`} className="text-sm break-words">
                        {contact.name}
                        {contact.title && <span className="text-muted-foreground"> · {contact.title}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function AddInterview({
  applicationId,
  contacts,
  timeZone,
}: {
  applicationId: string;
  contacts: PickerContact[];
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const { pending, change } = useChangeStatus();

  return (
    <div className="grid gap-3">
      {suggest && (
        <div role="status" className="grid gap-3 rounded-lg border bg-muted p-4">
          <p>This is the first interview. Move the application to {STATUS_META[INTERVIEWING_STATUS].label}?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                change(applicationId, INTERVIEWING_STATUS);
                setSuggest(false);
              }}
            >
              Move to {STATUS_META[INTERVIEWING_STATUS].label}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSuggest(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {open ? (
        <InterviewForm
          legend="New interview"
          submitLabel="Add interview"
          defaultValues={EMPTY_INTERVIEW_FORM}
          contacts={contacts}
          timeZone={timeZone}
          action={(values) => createInterview(applicationId, values)}
          success="Interview added."
          onDone={({ suggestInterviewing }) => {
            setOpen(false);
            setSuggest(suggestInterviewing);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
          Add interview
        </Button>
      )}
    </div>
  );
}

/** Keyed on updated_at by the caller, so a saved edit remounts it showing the new values. */
export function InterviewItem({
  interview,
  label,
  contacts,
  timeZone,
  children,
}: {
  interview: Interview;
  /** e.g. "Technical interview on Dec 1, 2026, 10:00 AM EST", for the buttons' names. */
  label: string;
  contacts: PickerContact[];
  timeZone: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InterviewForm
        legend={`Edit ${label}`}
        submitLabel="Save interview"
        defaultValues={interviewFormValues(interview, timeZone)}
        contacts={contacts}
        timeZone={timeZone}
        action={(values) => updateInterview(interview.id, values)}
        success="Interview saved."
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <ConfirmDeleteButton
          label={`Delete ${label}`}
          title="Delete this interview?"
          description={`The ${label} will be deleted. This can't be undone.`}
          confirmLabel="Delete interview"
          success="Interview deleted."
          action={() => deleteInterview(interview.id)}
        />
      </div>
    </div>
  );
}
