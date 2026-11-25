import { Temporal } from "@js-temporal/polyfill";
import {
  occurrences,
  type Item,
  type OccurrenceChange,
  type ScheduleSlot,
} from "./items";
import { planningWeek } from "./week";
export type ProgressItem = Item & {
  archived?: boolean;
  workstream_id?: string | null;
  stage?: string;
  completed_at?: string | null;
};
export function weeklyProgress(input: {
  now: string;
  week: string;
  zone: string;
  items: ProgressItem[];
  changes: OccurrenceChange[];
  slots: ScheduleSlot[];
}) {
  const week = planningWeek(input.week, input.zone);
  const blocks = occurrences(
    input.items,
    week.start,
    week.end,
    input.changes,
    input.slots,
  ).filter(
    (b) =>
      !b.cancelled &&
      (!input.items.find((i) => i.id === b.id)?.archived || b.completed),
  );
  const clipped = (
    start: string,
    end: string,
    from = week.start,
    to = week.end,
  ) =>
    Math.max(
      0,
      Math.min(Date.parse(end), Date.parse(to)) -
        Math.max(Date.parse(start), Date.parse(from)),
    ) / 60000;
  const tasks = blocks.filter((b) => b.kind === "task");
  const scheduledIds = new Set(tasks.map((b) => b.id));
  const unscheduled = input.items.filter(
    (i) =>
      i.kind === "task" &&
      !i.archived &&
      !i.completed &&
      i.status !== "cancelled" &&
      !i.weekly &&
      !i.daily &&
      (!i.planning_week || i.planning_week <= week.dates[0]) &&
      !scheduledIds.has(i.id) &&
      !input.slots.some((s) => s.task_id === i.id && s.ordinal > 0) &&
      (!i.start_at ||
        input.slots.some((s) => s.task_id === i.id && s.ordinal === 0)),
  );
  const completedUnscheduled = input.items.filter(
    (i) =>
      i.kind === "task" &&
      i.completed &&
      !i.start_at &&
      !input.slots.some((s) => s.task_id === i.id && s.ordinal > 0) &&
      i.completed_at &&
      Date.parse(i.completed_at) >= Date.parse(week.start) &&
      Date.parse(i.completed_at) < Date.parse(week.end),
  );
  const sessions = new Set(
    tasks.map(
      (b) =>
        b.id +
        "@" +
        (b.allocation_key ??
          (b.weekly || b.daily ? b.occurrence_date : "single")),
    ),
  );
  const completedSessions = new Set(
    tasks
      .filter((b) => b.completed)
      .map(
        (b) =>
          b.id +
          "@" +
          (b.allocation_key ??
            (b.weekly || b.daily ? b.occurrence_date : "single")),
      ),
  );
  const routineItems = input.items.filter(
    (i) => i.kind === "routine" && !i.archived && i.status !== "cancelled",
  );
  const routines = week.dates.flatMap((date) =>
    routineItems.flatMap((item) => {
      if (item.daily && !item.start_at) {
        const change = input.changes.find(
          (c) => c.item_id === item.id && c.occurrence_date === date,
        );
        return change?.cancelled
          ? []
          : [{ id: item.id, date, completed: change?.completed ?? false }];
      }
      return blocks
        .filter((b) => b.id === item.id && b.occurrence_date === date)
        .map((b) => ({ id: item.id, date, completed: b.completed }));
    }),
  );
  const streamMinutes = (id: string) => ({
    planned: tasks
      .filter(
        (b) => input.items.find((i) => i.id === b.id)?.workstream_id === id,
      )
      .reduce((n, b) => n + clipped(b.start_at, b.end_at), 0),
    completed:
      tasks
        .filter(
          (b) =>
            b.completed &&
            input.items.find((i) => i.id === b.id)?.workstream_id === id,
        )
        .reduce((n, b) => n + clipped(b.start_at, b.end_at), 0) +
      completedUnscheduled
        .filter((i) => i.workstream_id === id)
        .reduce((n, i) => n + (i.duration ?? 60), 0),
  });
  const todayDate = Temporal.Instant.from(input.now)
    .toZonedDateTimeISO(input.zone)
    .toPlainDate();
  const todayStart = todayDate.toZonedDateTime(input.zone).epochMilliseconds;
  const tomorrow = todayDate
    .add({ days: 1 })
    .toZonedDateTime(input.zone).epochMilliseconds;
  const today = blocks.filter(
    (b) =>
      Date.parse(b.start_at) < tomorrow && Date.parse(b.end_at) > todayStart,
  );
  const next = today.find(
    (b) => !b.completed && Date.parse(b.end_at) > Date.parse(input.now),
  );
  return {
    today,
    next,
    week,
    blocks,
    unscheduled,
    routines,
    streamMinutes,
    plannedMinutes: tasks.reduce(
      (n, b) => n + clipped(b.start_at, b.end_at),
      0,
    ),
    completedMinutes:
      tasks
        .filter((b) => b.completed)
        .reduce((n, b) => n + clipped(b.start_at, b.end_at), 0) +
      completedUnscheduled.reduce((n, i) => n + (i.duration ?? 60), 0),
    sessions: sessions.size,
    completedSessions: completedSessions.size + completedUnscheduled.length,
    days: week.dates.map((date) => {
      const from = Temporal.PlainDate.from(date)
        .toZonedDateTime(input.zone)
        .toInstant()
        .toString();
      const to = Temporal.PlainDate.from(date)
        .add({ days: 1 })
        .toZonedDateTime(input.zone)
        .toInstant()
        .toString();
      return {
        date,
        planned: tasks.reduce(
          (n, b) => n + clipped(b.start_at, b.end_at, from, to),
          0,
        ),
        completed: tasks
          .filter((b) => b.completed)
          .reduce((n, b) => n + clipped(b.start_at, b.end_at, from, to), 0),
      };
    }),
  };
}
