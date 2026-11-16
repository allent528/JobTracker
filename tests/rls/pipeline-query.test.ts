import { beforeAll, describe, expect, it } from "vitest";

import { dateInTimeZone } from "@/lib/dates";
import { selectPipeline, toPipelineItems } from "@/lib/pipeline-query";

import { type Client, localSuperuserQuery, recreateUser, rowOrThrow, signedInClient } from "./support";

// Its own fake user, so this file never shares rows with rls.test.ts.
const USER = "rls-pipeline@example.com";

let userId: string;
let client: Client;

beforeAll(async () => {
  userId = await recreateUser(USER);
  client = await signedInClient(USER);
});

describe("pipeline query (days in current status)", () => {
  it("embeds only each application's newest status event", async () => {
    const [moved, untouched] = rowOrThrow(
      await client
        .from("applications")
        .insert([
          { company: "Acme Corp", role_title: "Software Engineer" },
          { company: "Globex", role_title: "Data Analyst" },
        ])
        .select("id"),
    );
    localSuperuserQuery(
      `update public.status_events set changed_at = now() - interval '10 days' where application_id in ('${moved.id}', '${untouched.id}')`,
    );
    rowOrThrow(await client.from("applications").update({ status: "applied" }).eq("id", moved.id).select("id"));

    const events = rowOrThrow(
      await client.from("status_events").select("application_id, changed_at").order("changed_at", { ascending: false }),
    );
    const newest = (id: string) => events.find((event) => event.application_id === id)?.changed_at;
    expect(events.filter((event) => event.application_id === moved.id)).toHaveLength(2);

    const { data, error } = await selectPipeline(client, userId);
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status_events).toHaveLength(1);
      expect(row.status_events[0].changed_at).toBe(newest(row.id));
    }

    const today = dateInTimeZone(new Date(), "UTC");
    const days = Object.fromEntries(
      toPipelineItems(rows, "UTC", today).map((item) => [item.id, item.days_in_status]),
    );
    expect(days).toEqual({ [moved.id]: 0, [untouched.id]: 10 });
  });
});
