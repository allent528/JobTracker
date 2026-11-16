"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useId, useOptimistic, useState } from "react";

import { FollowUpBadge } from "@/components/follow-up-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { applicationPath } from "@/lib/applications";
import { type DateOnly, formatDate } from "@/lib/dates";
import { followUpState } from "@/lib/follow-ups";
import { boardColumns, countClosed, formatDaysInStatus, type PipelineItem } from "@/lib/pipeline";
import { isStatus, STATUS_META, type Status, STATUSES } from "@/lib/status";
import { cn } from "@/lib/utils";

import { type StatusMove, useChangeStatus } from "./use-change-status";

type BoardProps = { items: PipelineItem[]; today: DateOnly };

function applyMove(items: PipelineItem[], move: StatusMove): PipelineItem[] {
  // The server sets updated_at too, so the card keeps its place when the refreshed list arrives.
  const moved = { status: move.status, days_in_status: 0, updated_at: new Date().toISOString() };
  return items.map((item) => (item.id === move.id ? { ...item, ...moved } : item));
}

export function PipelineBoard({ items, today }: BoardProps) {
  const dndId = useId();
  const showClosedId = useId();
  const [optimisticItems, setOptimistic] = useOptimistic(items, applyMove);
  const { change } = useChangeStatus(setOptimistic);
  const [showClosed, setShowClosed] = useState(false);
  const [draggingId, setDraggingId] = useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // A long press starts a drag on touch screens, so a swipe still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const find = (id: UniqueIdentifier) => optimisticItems.find((item) => item.id === id);
  const dragging = draggingId === null ? undefined : find(draggingId);

  function move(id: string, status: Status) {
    if (find(id)?.status !== status) change(id, status);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    const target = over ? String(over.id) : null;
    if (target && isStatus(target)) move(String(active.id), target);
  }

  const name = (id: UniqueIdentifier) => find(id)?.company ?? "Application";
  const column = (id: UniqueIdentifier) => {
    const status = String(id);
    return isStatus(status) ? STATUS_META[status].label : "a column";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over ${column(over.id)}.` : `${name(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} was dropped on ${column(over.id)}.` : `${name(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={showClosedId}
          checked={showClosed}
          onCheckedChange={(checked) => setShowClosed(checked === true)}
        />
        <Label htmlFor={showClosedId}>Show closed ({countClosed(optimisticItems)})</Label>
      </div>
      <DndContext
        id={dndId}
        sensors={sensors}
        accessibility={{ announcements }}
        onDragStart={({ active }) => setDraggingId(active.id)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        {/* `relative`: sr-only text is position: absolute and would otherwise widen the page. */}
        <div className="relative flex gap-3 overflow-x-auto pb-2">
          {boardColumns(optimisticItems, { showClosed }).map(({ status, cards }) => (
            <BoardColumn key={status} status={status} cards={cards} today={today} onMove={move} />
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="h-full rotate-2 cursor-grabbing rounded-md border bg-card p-3 shadow-lg">
              <CardSummary item={dragging} today={today} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

type ColumnProps = {
  status: Status;
  cards: PipelineItem[];
  today: DateOnly;
  onMove: (id: string, status: Status) => void;
};

function BoardColumn({ status, cards, today, onMove }: ColumnProps) {
  const headingId = useId();
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted/60 p-2 lg:w-auto lg:min-w-56 lg:flex-1",
        isOver && "ring-2 ring-ring",
      )}
    >
      <h2 className="flex items-center justify-between gap-2 px-1 pt-1 text-sm font-semibold">
        <span id={headingId}>{STATUS_META[status].label}</span>
        <span className="text-muted-foreground">
          {cards.length}
          <span className="sr-only">{cards.length === 1 ? " application" : " applications"}</span>
        </span>
      </h2>
      {cards.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">No applications</p>
      ) : (
        <ul className="grid gap-2">
          {cards.map((item) => (
            <BoardCard key={item.id} item={item} today={today} onMove={onMove} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BoardCard({ item, today, onMove }: { item: PipelineItem } & Omit<ColumnProps, "status" | "cards">) {
  // No KeyboardSensor attributes: the Move menu is the keyboard and screen reader path.
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      className={cn(
        "grid cursor-grab gap-2 rounded-md border bg-card p-3 shadow-xs",
        isDragging && "opacity-40",
      )}
    >
      <Link
        href={applicationPath(item.id)}
        // A native link drag would take over from the board drag.
        draggable={false}
        className="rounded-sm hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CardSummary item={item} today={today} />
      </Link>
      <MoveMenu item={item} onMove={onMove} />
    </li>
  );
}

function CardSummary({ item, today }: { item: PipelineItem; today: DateOnly }) {
  return (
    <span className="grid gap-1">
      <span className="font-medium break-words">{item.company}</span>
      <span className="text-sm break-words text-muted-foreground">{item.role_title}</span>
      <span className="text-xs text-muted-foreground">{formatDaysInStatus(item.days_in_status)}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        {item.next_follow_up_on ? (
          <>
            <span>Follow up {formatDate(item.next_follow_up_on)}</span>
            <FollowUpBadge state={followUpState(item.next_follow_up_on, today)} />
          </>
        ) : (
          <span className="text-muted-foreground">No follow-up set</span>
        )}
      </span>
    </span>
  );
}

function MoveMenu({ item, onMove }: { item: PipelineItem; onMove: (id: string, status: Status) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          aria-label={`Move ${item.company}, ${item.role_title}`}
        >
          Move
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={item.status}
          onValueChange={(value) => {
            if (isStatus(value)) onMove(item.id, value);
          }}
        >
          {STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {STATUS_META[status].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
