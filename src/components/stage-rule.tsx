import { ACTIVE_STATUSES, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * A segmented rule along the active stages, filled up to `status`. Decorative: the status is
 * always stated in text beside it. A closed status leaves every segment empty.
 */
export function StageRule({ status, className }: { status: Status; className?: string }) {
  const reached = ACTIVE_STATUSES.indexOf(status);
  return (
    <span aria-hidden="true" className={cn("grid grid-flow-col gap-0.5", className)}>
      {ACTIVE_STATUSES.map((stage, i) => (
        <span
          key={stage}
          style={{ transitionDelay: `calc(var(--duration-stagger) * ${i})` }}
          className={cn(
            "h-[3px] transition-colors duration-(--duration-fast)",
            i <= reached ? "bg-stage-on" : "bg-stage-off",
          )}
        />
      ))}
    </span>
  );
}
