"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applicationPath } from "@/lib/applications";
import { isWorkMode, WORK_MODE_LABELS, WORK_MODES } from "@/lib/closed-sets";
import { dateInTimeZone, formatDate } from "@/lib/dates";
import {
  ALL,
  DEFAULT_TABLE_FILTERS,
  DEFAULT_TABLE_SORT,
  filterApplications,
  nextSort,
  type PipelineItem,
  type SortKey,
  sortApplications,
  type TableFilters,
  type TableSort,
} from "@/lib/pipeline";
import { isStatus, STATUS_META, STATUSES } from "@/lib/status";

const COLUMNS = [
  { key: "company", label: "Company" },
  { key: "role_title", label: "Role" },
  { key: "status", label: "Status" },
  { key: "date_applied", label: "Date applied" },
  { key: "updated_at", label: "Last updated" },
] as const satisfies readonly { key: SortKey; label: string }[];

export function PipelineTable({ items, timeZone }: { items: PipelineItem[]; timeZone: string }) {
  const ids = { search: useId(), status: useId(), workMode: useId(), archived: useId() };
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_TABLE_FILTERS);
  const [sort, setSort] = useState<TableSort>(DEFAULT_TABLE_SORT);
  const rows = sortApplications(filterApplications(items, filters), sort);
  const update = (patch: Partial<TableFilters>) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full gap-2 sm:w-64">
          <Label htmlFor={ids.search}>Search</Label>
          <Input
            id={ids.search}
            type="search"
            placeholder="Company or role"
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={ids.status}>Status</Label>
          <NativeSelect
            id={ids.status}
            value={filters.status}
            onChange={(event) => {
              const value = event.target.value;
              update({ status: isStatus(value) ? value : ALL });
            }}
          >
            <NativeSelectOption value={ALL}>All statuses</NativeSelectOption>
            {STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {STATUS_META[status].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={ids.workMode}>Work mode</Label>
          <NativeSelect
            id={ids.workMode}
            value={filters.workMode}
            onChange={(event) => {
              const value = event.target.value;
              update({ workMode: isWorkMode(value) ? value : ALL });
            }}
          >
            <NativeSelectOption value={ALL}>All work modes</NativeSelectOption>
            {WORK_MODES.map((mode) => (
              <NativeSelectOption key={mode} value={mode}>
                {WORK_MODE_LABELS[mode]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id={ids.archived}
            checked={filters.includeArchived}
            onCheckedChange={(checked) => update({ includeArchived: checked === true })}
          />
          <Label htmlFor={ids.archived}>Show archived</Label>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {rows.length === 1 ? "1 application" : `${rows.length} applications`}
      </p>

      <Table aria-label="Applications">
        <TableHeader>
          <TableRow>
            {COLUMNS.map(({ key, label }) => (
              <SortableHead key={key} column={key} label={label} sort={sort} onSort={setSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-6 text-center text-muted-foreground">
                No applications match these filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link
                    href={applicationPath(item.id)}
                    className="underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.company}
                  </Link>
                </TableCell>
                <TableCell>{item.role_title}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={item.status} />
                    {item.archived_at && <Badge variant="outline">Archived</Badge>}
                  </span>
                </TableCell>
                <TableCell>
                  {item.date_applied ? (
                    formatDate(item.date_applied)
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-muted-foreground">
                        —
                      </span>
                      <span className="sr-only">Not set</span>
                    </>
                  )}
                </TableCell>
                <TableCell>{formatDate(dateInTimeZone(item.updated_at, timeZone))}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type SortableHeadProps = {
  column: SortKey;
  label: string;
  sort: TableSort;
  onSort: (sort: TableSort) => void;
};

function SortableHead({ column, label, sort, onSort }: SortableHeadProps) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDownIcon : sort.direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, column))}
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 font-medium hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        <Icon aria-hidden="true" className={active ? "size-3.5" : "size-3.5 text-muted-foreground"} />
      </button>
    </TableHead>
  );
}
