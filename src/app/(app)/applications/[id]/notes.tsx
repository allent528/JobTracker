"use client";

import { useState } from "react";

import { Form } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import type { Note } from "@/lib/detail";
import { TEXT_LIMITS } from "@/lib/limits";
import { EMPTY_NOTE_FORM, type NoteFormValues, noteSchema } from "@/lib/schemas/note";

import { createNote, deleteNote, updateNote } from "./actions";
import { EditableRow, FormButtons, TextAreaField, useSectionForm } from "./section-ui";

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
  const { form, pending, onSubmit } = useSectionForm(noteSchema, { defaultValues, action, success, onDone });
  return (
    <Form {...form}>
      <form noValidate className="grid gap-3" onSubmit={onSubmit}>
        <TextAreaField
          control={form.control}
          name="body"
          label={label}
          description="Plain text. Markdown is saved as typed but not formatted."
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

export function NoteItem({ row, label, children }: { row: Pick<Note, "id" | "body">; label: string; children: React.ReactNode }) {
  return (
    <EditableRow
      label={label}
      remove={{
        title: "Delete this note?",
        description: "The note will be deleted. This can't be undone.",
        confirmLabel: "Delete note",
        success: "Note deleted.",
        action: () => deleteNote(row.id),
      }}
      editForm={(close) => (
        <NoteForm
          label="Edit note"
          submitLabel="Save note"
          defaultValues={{ body: row.body }}
          action={(values) => updateNote(row.id, values)}
          success="Note saved."
          onDone={close}
          onCancel={close}
        />
      )}
    >
      {children}
    </EditableRow>
  );
}
