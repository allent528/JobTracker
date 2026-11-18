"use client";

import { useState } from "react";
import type { Control } from "react-hook-form";

import {
  ADD_FORM_PANEL,
  EditableRow,
  FormButtons,
  SelectField,
  TextAreaField,
  TextField,
  useSectionForm,
} from "@/components/section-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormDescription, FormField, FormItem, FormMessage } from "@/components/ui/form";
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
import { INTERVIEWING_STATUS, type Status, STATUS_META, suggestsInterviewing } from "@/lib/status";

import { useChangeStatus } from "../use-change-status";
import { createInterview, deleteInterview, updateInterview } from "./actions";

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
  const { form, pending, onSubmit } = useSectionForm(interviewSchema, {
    defaultValues,
    // A contact deleted while this form was open is still in its picked ids.
    action: (values) =>
      action({ ...values, contact_ids: values.contact_ids.filter((id) => contacts.some((c) => c.id === id)) }),
    success,
    onDone,
  });
  const control = form.control;

  return (
    <Form {...form}>
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">{legend}</legend>
          <SelectField control={control} name="kind" label="Type" options={INTERVIEW_KINDS} labels={INTERVIEW_KIND_LABELS} />
          <SelectField
            control={control}
            name="outcome"
            label="Outcome"
            options={INTERVIEW_OUTCOMES}
            labels={INTERVIEW_OUTCOME_LABELS}
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
                {contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`interviewer-${contact.id}`}
                      checked={field.value.includes(contact.id)}
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
                ))}
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
  status,
  contacts,
  timeZone,
}: {
  applicationId: string;
  status: Status;
  contacts: PickerContact[];
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const { pending, change } = useChangeStatus();
  const interviewing = STATUS_META[INTERVIEWING_STATUS].label;

  return (
    <div className="grid gap-3">
      {/* Re-checked against the current status, so a stale banner can't move the application back. */}
      {suggest && suggestsInterviewing(status, 1) && (
        <div role="status" className="grid gap-3 rounded-lg border bg-muted p-4">
          <p>This is the first interview. Move the application to {interviewing}?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                change(applicationId, INTERVIEWING_STATUS);
                setSuggest(false);
              }}
            >
              Move to {interviewing}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSuggest(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {open ? (
        <div className={ADD_FORM_PANEL}>
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
        </div>
      ) : (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
          Add interview
        </Button>
      )}
    </div>
  );
}

export function InterviewItem({
  row,
  label,
  contacts,
  timeZone,
  children,
}: {
  row: Interview;
  label: string;
  contacts: PickerContact[];
  timeZone: string;
  children: React.ReactNode;
}) {
  return (
    <EditableRow
      label={label}
      remove={{
        title: "Delete this interview?",
        description: `The ${label} will be deleted. This can't be undone.`,
        confirmLabel: "Delete interview",
        success: "Interview deleted.",
        action: () => deleteInterview(row.id),
      }}
      editForm={(close) => (
        <InterviewForm
          legend={`Edit ${label}`}
          submitLabel="Save interview"
          defaultValues={interviewFormValues(row, timeZone)}
          contacts={contacts}
          timeZone={timeZone}
          action={(values) => updateInterview(row.id, values)}
          success="Interview saved."
          onDone={close}
          onCancel={close}
        />
      )}
    >
      {children}
    </EditableRow>
  );
}
