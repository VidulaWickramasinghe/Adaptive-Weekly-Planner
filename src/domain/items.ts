import { Temporal } from "@js-temporal/polyfill";
export type Item = {
  id: string;
  title: string;
  kind: string;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  weekly: boolean;
  completed: boolean;
  version: number;
  can_split?: boolean;
  minimum_session?: number;
  earliest_at?: string | null;
  preferred_start?: number;
  preferred_end?: number;
  daily?: boolean;
  status?: string;
  locked?: boolean;
  category?: string;
  buffer_before?: number;
  buffer_after?: number;
  duration?: number;
  priority?: string;
  due_at?: string | null;
  planning_week?: string | null;
  session_number?: number | null;
};
export type OccurrenceChange = {
  item_id: string;
  occurrence_date: string;
  cancelled: boolean;
  completed: boolean;
  start_at: string | null;
  end_at: string | null;
};
export type ScheduleSlot = {
  task_id: string;
  occurrence_key: string;
  ordinal: number;
  start_at: string | null;
  end_at: string | null;
};
export type Block = Item & {
  allocation_key?: string;
  ordinal?: number;
  start_at: string;
  end_at: string;
  occurrence_date: string;
  cancelled?: boolean;
  time_issue?: boolean;
};
export function occurrences(
  items: Item[],
  start: string,
  end: string,
  changes: OccurrenceChange[] = [],
  slots: ScheduleSlot[] = [],
): Block[] {
  const result: Block[] = [];
  for (const item of items) {
    if (item.status === "cancelled") continue;
    if (!item.start_at || !item.end_at) continue;
    const original = Temporal.Instant.from(item.start_at).toZonedDateTimeISO(
      item.timezone,
    );
    const originalEnd = Temporal.Instant.from(item.end_at).toZonedDateTimeISO(
      item.timezone,
    );
    const interval = item.daily ? 1 : item.weekly ? 7 : 0;
    const target = Temporal.Instant.from(start).toZonedDateTimeISO(
      item.timezone,
    );
    const days = original.toPlainDate().until(target.toPlainDate()).days;
    const durationDays = original
      .toPlainDate()
      .until(originalEnd.toPlainDate()).days;
    const first = interval
      ? Math.max(0, Math.floor((days - durationDays) / interval) - 1)
      : 0;
    const candidates = new Map<
      string,
      { from: string; to: string; issue?: boolean }
    >();
    for (let n = first; n < first + 400; n++) {
      const from = original.add({ days: n * interval }),
        to = originalEnd.add({ days: n * interval });
      if (
        Temporal.Instant.compare(
          from.toInstant(),
          Temporal.Instant.from(end),
        ) >= 0
      )
        break;
      let issue = false;
      if (interval)
        try {
          original
            .toPlainDateTime()
            .add({ days: n * interval })
            .toZonedDateTime(item.timezone, { disambiguation: "reject" });
          originalEnd
            .toPlainDateTime()
            .add({ days: n * interval })
            .toZonedDateTime(item.timezone, { disambiguation: "reject" });
        } catch {
          issue = true;
        }
      candidates.set(from.toPlainDate().toString(), {
        issue,
        from: from.toInstant().toString(),
        to: to.toInstant().toString(),
      });
      if (!interval) break;
    }
    // Include relocated occurrences whose original dates are outside this view.
    for (const change of changes.filter(
      (change) =>
        change.item_id === item.id && change.start_at && change.end_at,
    )) {
      candidates.set(change.occurrence_date, {
        from: change.start_at!,
        to: change.end_at!,
      });
    }
    for (const [date, span] of candidates) {
      const change = changes.find(
        (change) =>
          change.item_id === item.id && change.occurrence_date === date,
      );
      const from = change?.start_at ?? span.from,
        to = change?.end_at ?? span.to;
      if (
        Date.parse(to) + (item.buffer_after ?? 0) * 60000 <=
          Date.parse(start) ||
        Date.parse(from) - (item.buffer_before ?? 0) * 60000 >= Date.parse(end)
      )
        continue;
      result.push({
        ...item,
        start_at: from,
        end_at: to,
        occurrence_date: date,
        time_issue: change?.start_at ? false : (span.issue ?? false),
        cancelled: change?.cancelled ?? false,
        completed: change?.completed ?? item.completed,
      });
    }
  }
  const overlaid = result.filter(
    (block) =>
      !slots.some(
        (slot) =>
          slot.task_id === block.id &&
          slot.occurrence_key ===
            (block.weekly || block.daily ? block.occurrence_date : "single"),
      ),
  );
  for (const slot of slots) {
    const item = items.find((item) => item.id === slot.task_id);
    if (!item || item.status === "cancelled" || !slot.start_at || !slot.end_at)
      continue;
    if (
      Date.parse(slot.end_at) + (item.buffer_after ?? 0) * 60000 <=
        Date.parse(start) ||
      Date.parse(slot.start_at) - (item.buffer_before ?? 0) * 60000 >=
        Date.parse(end)
    )
      continue;
    const date =
      slot.occurrence_key === "single"
        ? Temporal.Instant.from(item.start_at ?? slot.start_at)
            .toZonedDateTimeISO(item.timezone)
            .toPlainDate()
            .toString()
        : slot.occurrence_key;
    const change = changes.find(
      (c) => c.item_id === item.id && c.occurrence_date === date,
    );
    overlaid.push({
      ...item,
      start_at: slot.start_at,
      end_at: slot.end_at,
      occurrence_date: date,
      allocation_key: slot.occurrence_key,
      ordinal: slot.ordinal,
      completed: change?.completed ?? item.completed,
      cancelled: change?.cancelled ?? false,
    });
  }
  return overlaid.sort(
    (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
  );
}
export function overlaps(
  a: {
    start_at: string;
    end_at: string;
    buffer_before?: number;
    buffer_after?: number;
  },
  b: {
    start_at: string;
    end_at: string;
    buffer_before?: number;
    buffer_after?: number;
  },
) {
  return (
    Date.parse(a.start_at) - (a.buffer_before ?? 0) * 60000 <
      Date.parse(b.end_at) + (b.buffer_after ?? 0) * 60000 &&
    Date.parse(b.start_at) - (b.buffer_before ?? 0) * 60000 <
      Date.parse(a.end_at) + (a.buffer_after ?? 0) * 60000
  );
}
export function localInstant(value: string, zone: string) {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
