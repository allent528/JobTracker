import { Badge } from "@/components/ui/badge";
import { STATUS_META, type Status } from "@/lib/status";

/** Closed statuses are outlined. */
export function StatusBadge({ status }: { status: Status }) {
  const { label, kind } = STATUS_META[status];
  return <Badge variant={kind === "active" ? "secondary" : "outline"}>{label}</Badge>;
}
