import { Temporal } from "@js-temporal/polyfill";
export function planningWeek(instant: string, timezone: string) {
  const today = Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  const sunday = today.subtract({ days: today.dayOfWeek % 7 });
  const end = sunday.add({ days: 7 });
  return {
    today: today.toString(),
    start: sunday.toZonedDateTime(timezone).toInstant().toString(),
    end: end.toZonedDateTime(timezone).toInstant().toString(),
    dates: Array.from({ length: 7 }, (_, day) =>
      sunday.add({ days: day }).toString(),
    ),
  };
}
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-AU", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
