"use client";

import { useId, useState, useTransition } from "react";

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
import { isStatus, nextSuggestedStatus, STATUS_META, type Status, STATUSES } from "@/lib/status";
import { toastResult } from "@/lib/toast-result";

import { deleteApplication, setArchived } from "../actions";
import { useChangeStatus } from "../use-change-status";

type StatusControlProps = { id: string; status: Status };

export function StatusControl(props: StatusControlProps) {
  // Remount when the server sends a new status, so the select shows it.
  return <StatusSelect key={props.status} {...props} />;
}

/**
 * The select applies only on "Change status": arrowing through a closed native select fires
 * `change` per option on Windows, which would log a status event each time.
 */
function StatusSelect({ id, status }: StatusControlProps) {
  const selectId = useId();
  const [selected, setSelected] = useState<Status>(status);
  const { pending, change } = useChangeStatus();
  const next = nextSuggestedStatus(status);

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
            onClick={() => change(id, selected)}
          >
            Change status
          </Button>
        </div>
      </div>
      {next && (
        <Button type="button" disabled={pending} onClick={() => change(id, next)} className="justify-self-start">
          Move to {STATUS_META[next].label}
        </Button>
      )}
    </div>
  );
}

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          toastResult(
            await setArchived({ id, archived: !archived }),
            archived ? "Application unarchived." : "Application archived.",
          );
        })
      }
    >
      {archived ? "Unarchive" : "Archive"}
    </Button>
  );
}

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
              // Radix closes the dialog on click; keep it open until the action finishes (it redirects on success).
              event.preventDefault();
              startTransition(async () => {
                if (!toastResult(await deleteApplication(id))) setOpen(false);
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
