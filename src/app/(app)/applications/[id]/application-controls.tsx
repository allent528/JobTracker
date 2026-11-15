"use client";

import { useId, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { STATUS_META, STATUSES, type Status, isStatus, nextSuggestedStatus } from "@/lib/status";

import { changeStatus, deleteApplication, setArchived } from "../actions";

/**
 * F4: pick any status, or take the suggested next step on the forward path. The select applies
 * only on "Change status", so arrowing through options doesn't log a change per keypress.
 * Render with `key={status}` so the select resets when the server sends a new status.
 */
export function StatusControl({ id, status }: { id: string; status: Status }) {
  const selectId = useId();
  const [selected, setSelected] = useState<Status>(status);
  const [pending, startTransition] = useTransition();
  const next = nextSuggestedStatus(status);

  function apply(to: Status) {
    startTransition(async () => {
      const result = await changeStatus({ id, status: to });
      if (result.ok) toast.success(`Moved to ${STATUS_META[to].label}.`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={selectId}>Status</Label>
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            id={selectId}
            value={selected}
            onChange={(event) => {
              if (isStatus(event.target.value)) setSelected(event.target.value);
            }}
            disabled={pending}
          >
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_META[s].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="outline"
            disabled={pending || selected === status}
            onClick={() => apply(selected)}
          >
            Change status
          </Button>
        </div>
      </div>
      {next && (
        <Button type="button" disabled={pending} onClick={() => apply(next)} className="justify-self-start">
          Move to {STATUS_META[next].label}
        </Button>
      )}
    </div>
  );
}

/** D10: archive is the everyday removal and needs no confirmation (ui.md). */
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setArchived(id, !archived);
          if (result.ok) toast.success(archived ? "Application restored." : "Application archived.");
          else toast.error(result.error);
        })
      }
    >
      {archived ? "Unarchive" : "Archive"}
    </Button>
  );
}

/** F2: hard delete behind a confirm dialog. */
export function DeleteButton({ id, company, roleTitle }: { id: string; company: string; roleTitle: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription>
            {roleTitle} at {company} will be deleted with its notes, contacts, interviews and status
            history. This can&apos;t be undone. To keep it out of the way instead, archive it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              // Keep the dialog open until the action finishes (it redirects on success).
              event.preventDefault();
              startTransition(async () => {
                const result = await deleteApplication(id);
                if (!result.ok) {
                  toast.error(result.error);
                  setOpen(false);
                }
              });
            }}
          >
            {pending ? "Deleting…" : "Delete application"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
