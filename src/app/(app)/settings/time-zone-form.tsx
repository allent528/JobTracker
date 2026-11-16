"use client";

import { FormButtons, SelectField, useSectionForm } from "@/components/section-ui";
import { Form } from "@/components/ui/form";
import { timeZoneSchema } from "@/lib/schemas/settings";

import { updateTimeZone } from "../actions";

export function TimeZoneForm({ current, options }: { current: string; options: string[] }) {
  const { form, pending, onSubmit } = useSectionForm(timeZoneSchema, {
    defaultValues: { time_zone: current },
    action: updateTimeZone,
    success: "Time zone saved.",
    onDone: () => {},
  });
  return (
    <Form {...form}>
      <form noValidate className="grid gap-4 sm:max-w-sm" onSubmit={onSubmit}>
        <SelectField
          control={form.control}
          name="time_zone"
          label="Time zone"
          options={options}
          labels={Object.fromEntries(options.map((zone) => [zone, zone.replaceAll("_", " ")]))}
        />
        <FormButtons pending={pending} submitLabel="Save time zone" />
      </form>
    </Form>
  );
}
