"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { TEXT_LIMITS } from "@/lib/limits";
import { EMPTY_NOTE_FORM, type NoteFormValues, noteSchema } from "@/lib/schemas/note";

import { createNote, deleteNote, updateNote } from "./actions";
import { ConfirmDeleteButton, FormButtons, TextAreaField, useSectionAction } from "./section-ui";

function NoteForm({
  label,
  submitLabel,
  defaultValues,
  action,
  success,
  onDone,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  defaultValues: NoteFormValues;
  action: (values: NoteFormValues) => Promise<ActionResult>;
  success: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { pending, run } = useSectionAction();
  const form = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema, undefined, { raw: true }), defaultValues });

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) => run(() => action(values), success, onDone))}
      >
        <TextAreaField
          control={form.control}
          name="body"
          label={label}
          description="Plain text; Markdown is kept as you type it."
          maxLength={TEXT_LIMITS.notes.body}
          required
        />
        <FormButtons pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
      </form>
    </Form>
  );
}

export function AddNoteForm({ applicationId }: { applicationId: string }) {
  // A new key clears the form after a note is added.
  const [round, setRound] = useState(0);
  return (
    <NoteForm
      key={round}
      label="New note"
      submitLabel="Add note"
      defaultValues={EMPTY_NOTE_FORM}
      action={(values) => createNote(applicationId, values)}
      success="Note added."
      onDone={() => setRound((n) => n + 1)}
    />
  );
}

/** Keyed on updated_at by the caller, so a saved edit remounts it showing the new text. */
export function NoteItem({
  id,
  body,
  label,
  timestamps,
}: {
  id: string;
  body: string;
  /** Names the note for its buttons, e.g. "note added Nov 14, 2026, 9:05 AM". */
  label: string;
  /** Preformatted in the owner's time zone, e.g. "Added Nov 14, 2026, 9:05 AM". */
  timestamps: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <NoteForm
        label="Edit note"
        submitLabel="Save note"
        defaultValues={{ body }}
        action={(values) => updateNote(id, values)}
        success="Note saved."
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <p className="break-words whitespace-pre-wrap">{body}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{timestamps}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <ConfirmDeleteButton
            label={`Delete ${label}`}
            title="Delete this note?"
            description="The note will be deleted. This can't be undone."
            confirmLabel="Delete note"
            success="Note deleted."
            action={() => deleteNote(id)}
          />
        </div>
      </div>
    </div>
  );
}
