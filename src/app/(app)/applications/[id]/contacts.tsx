"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { type Contact, contactFormValues } from "@/lib/detail";
import { TEXT_LIMITS } from "@/lib/limits";
import { type ContactFormValues, contactSchema, EMPTY_CONTACT_FORM } from "@/lib/schemas/contact";

import { createContact, deleteContact, updateContact } from "./actions";
import { ConfirmDeleteButton, FormButtons, TextAreaField, TextField, useSectionAction } from "./section-ui";

const LIMITS = TEXT_LIMITS.contacts;

function ContactForm({
  legend,
  submitLabel,
  defaultValues,
  action,
  success,
  onDone,
  onCancel,
}: {
  legend: string;
  submitLabel: string;
  defaultValues: ContactFormValues;
  action: (values: ContactFormValues) => Promise<ActionResult>;
  success: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { pending, run } = useSectionAction();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema, undefined, { raw: true }),
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
          <TextField control={control} name="name" label="Name" maxLength={LIMITS.name} required />
          <TextField control={control} name="title" label="Role or title" maxLength={LIMITS.title} />
          <TextField control={control} name="email" label="Email" type="email" maxLength={LIMITS.email} />
          <TextField control={control} name="phone" label="Phone" type="tel" maxLength={LIMITS.phone} />
          <TextField
            control={control}
            name="linkedin_url"
            label="LinkedIn URL"
            type="url"
            inputMode="url"
            maxLength={LIMITS.linkedin_url}
            className="sm:col-span-2"
          />
          <TextAreaField
            control={control}
            name="notes"
            label="Notes about this contact"
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

export function AddContact({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
        Add contact
      </Button>
    );
  }
  return (
    <ContactForm
      legend="New contact"
      submitLabel="Add contact"
      defaultValues={EMPTY_CONTACT_FORM}
      action={(values) => createContact(applicationId, values)}
      success="Contact added."
      onDone={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  );
}

/** Keyed on updated_at by the caller, so a saved edit remounts it showing the new values. */
export function ContactItem({ contact, children }: { contact: Contact; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ContactForm
        legend={`Edit ${contact.name}`}
        submitLabel="Save contact"
        defaultValues={contactFormValues(contact)}
        action={(values) => updateContact(contact.id, values)}
        success="Contact saved."
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Edit contact ${contact.name}`}
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <ConfirmDeleteButton
          label={`Delete contact ${contact.name}`}
          title="Delete this contact?"
          description={`${contact.name} will be deleted and removed from any interviews they're listed on. This can't be undone.`}
          confirmLabel="Delete contact"
          success="Contact deleted."
          action={() => deleteContact(contact.id)}
        />
      </div>
    </div>
  );
}
