import { ACTIVE_STATUSES, forwardPathFrom, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Active stages reached: all of them at the end of the forward path, none for other closed statuses. */
function stagesReached(status: Status): number {
  const active = ACTIVE_STATUSES.indexOf(status);
  if (active !== -1) return active + 1;
  return forwardPathFrom(status).length === 1 ? ACTIVE_STATUSES.length : 0;
}

export function StageRule({ status, className }: { status: Status; className?: string }) {
  const reached = stagesReached(status);
  return (
    <span aria-hidden="true" className={cn("grid grid-flow-col gap-0.5", className)}>
      {ACTIVE_STATUSES.map((stage, i) => (
        <span
          key={stage}
          style={{ transitionDelay: `calc(var(--duration-stagger) * ${i})` }}
          className={cn(
            "h-[3px] transition-colors duration-(--duration-fast)",
            i < reached ? "bg-stage-on" : "bg-stage-off",
          )}
        />
      ))}
    </span>
  );
}
