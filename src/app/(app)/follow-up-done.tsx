"use client";

import { useState } from "react";

import { FormButtons, TextField, useSectionForm } from "@/components/section-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import type { DateOnly } from "@/lib/dates";
import { TEXT_LIMITS } from "@/lib/limits";
import { type FollowUpDoneValues, followUpDoneSchema } from "@/lib/schemas/follow-up";

import { completeFollowUp } from "./actions";

export function FollowUpDoneButton({
  applicationId,
  label,
  note,
  suggestedNext,
}: {
  applicationId: string;
  label: string;
  note: string | null;
  suggestedNext: DateOnly;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Mark follow-up done for ${label}`}>
          Mark done
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark follow-up done</DialogTitle>
          <DialogDescription>
            {label}. Set the next follow-up, or clear the date to stop following up.
          </DialogDescription>
        </DialogHeader>
        {/* The content unmounts when closed, so each opening starts from the current values. */}
        <FollowUpDoneForm
          applicationId={applicationId}
          defaultValues={{ next_follow_up_on: suggestedNext, follow_up_note: note ?? "" }}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FollowUpDoneForm({
  applicationId,
  defaultValues,
  onClose,
}: {
  applicationId: string;
  defaultValues: FollowUpDoneValues;
  onClose: () => void;
}) {
  const { form, pending, onSubmit } = useSectionForm(followUpDoneSchema, {
    defaultValues,
    action: (values) => completeFollowUp(applicationId, values),
    success: "Follow-up marked done.",
    onDone: onClose,
  });
  return (
    <Form {...form}>
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <TextField
          control={form.control}
          name="next_follow_up_on"
          label="Next follow-up"
          type="date"
          description="Leave blank to stop following up. The note is cleared too."
        />
        <TextField
          control={form.control}
          name="follow_up_note"
          label="Follow-up note"
          maxLength={TEXT_LIMITS.applications.follow_up_note}
        />
        <FormButtons pending={pending} submitLabel="Mark done" onCancel={onClose} />
      </form>
    </Form>
  );
}
