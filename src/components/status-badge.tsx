import { Badge } from "@/components/ui/badge";
import { STATUS_META, isStatus } from "@/lib/status";

/** A stored status as a badge; closed statuses are outlined (labels come from status.ts). */
export function StatusBadge({ status }: { status: string }) {
  if (!isStatus(status)) return <Badge variant="outline">{status}</Badge>;
  const { label, kind } = STATUS_META[status];
  return <Badge variant={kind === "active" ? "secondary" : "outline"}>{label}</Badge>;
}
