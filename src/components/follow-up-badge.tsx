import { Badge } from "@/components/ui/badge";
import type { FollowUpState } from "@/lib/follow-ups";

/** Upcoming follow-ups get no badge; the date beside it says enough. */
export function FollowUpBadge({ state }: { state: FollowUpState | null }) {
  if (state === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  if (state === "today") return <Badge>Due today</Badge>;
  return null;
}
