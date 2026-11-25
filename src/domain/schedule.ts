import { Temporal } from "@js-temporal/polyfill";
import {
  occurrences,
  overlaps,
  type Item,
  type Block,
  type OccurrenceChange,
} from "./items";
import { planningWeek } from "./week";
export function propose(input: {
  now: string;
  week: string;
  zone: string;
  capacity: number;
  startHour: number;
  endHour: number;
  items: Item[];
  changes: OccurrenceChange[];
  blocks?: Block[];
  tasks?: Item[];
}) {
  const week = planningWeek(input.week, input.zone);
  const existing = (
    input.blocks ??
    occurrences(input.items, week.start, week.end, input.changes)
  ).filter((block) => !block.cancelled);
  const conflicts = existing.flatMap((block, i) =>
    existing
      .slice(i + 1)
      .filter((other) => overlaps(block, other))
      .map((other) => block.title + " overlaps " + other.title),
  );
  const blocked = existing.some((block) => block.time_issue);
  const occupied = existing.map((block) => ({
    start_at: new Date(
      Date.parse(block.start_at) - (block.buffer_before ?? 0) * 60000,
    ).toISOString(),
    end_at: new Date(
      Date.parse(block.end_at) + (block.buffer_after ?? 0) * 60000,
    ).toISOString(),
  }));
  const loads = week.dates.map((date) =>
    existing
      .filter(
        (block) =>
          block.kind === "task" &&
          Temporal.Instant.from(block.start_at)
            .toZonedDateTimeISO(input.zone)
            .toPlainDate()
            .toString() === date,
      )
      .reduce(
        (sum, block) =>
          sum + (Date.parse(block.end_at) - Date.parse(block.start_at)) / 60000,
        0,
      ),
  );
  const tasks =
    input.tasks ??
    input.items.filter(
      (item) =>
        item.kind === "task" &&
        !item.start_at &&
        !item.completed &&
        !item.locked &&
        item.status !== "cancelled" &&
        (!item.planning_week || item.planning_week <= week.dates[0]),
    );
  const priorities: Record<string, number> = { high: 0, medium: 1, low: 2 };
  tasks.sort(
    (a, b) =>
      (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
      priorities[a.priority ?? "medium"] - priorities[b.priority ?? "medium"] ||
      a.id.localeCompare(b.id),
  );
  const proposed: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
  }[] = [];
  const unscheduled: { id: string; title: string; reason: string }[] = [];
  for (const task of tasks) {
    const total = task.duration ?? 60;
    const checkpoint = occupied.length;
    const initialLoads = [...loads];
    const chunks: typeof proposed = [];
    let remaining = total;
    while (remaining > 0) {
      let duration = remaining;
      let placed = false;
      while (duration > 0) {
        if (
          task.can_split &&
          remaining - duration > 0 &&
          remaining - duration < (task.minimum_session ?? 30)
        ) {
          duration--;
          continue;
        }
        const candidates: { day: number; start_at: string; end_at: string }[] =
          [];
        if (!blocked)
          for (let day = 0; day < 7; day++) {
            if (loads[day] + duration > input.capacity) continue;
            const date = Temporal.PlainDate.from(week.dates[day]);
            const start = date
              .toPlainDateTime({
                hour: Math.max(input.startHour, task.preferred_start ?? 0),
              })
              .toZonedDateTime(input.zone).epochMilliseconds;
            const end = date
              .toPlainDateTime({
                hour: Math.min(input.endHour, task.preferred_end ?? 23),
              })
              .toZonedDateTime(input.zone).epochMilliseconds;
            for (
              let at = Math.max(
                start,
                Math.ceil(Date.parse(input.now) / 60000) * 60000,
                task.earliest_at ? Date.parse(task.earliest_at) : 0,
              );
              at + duration * 60000 <= end;
              at += 60000
            ) {
              const candidate = {
                day,
                start_at: new Date(at).toISOString(),
                end_at: new Date(at + duration * 60000).toISOString(),
              };
              if (
                task.due_at &&
                Date.parse(candidate.end_at) > Date.parse(task.due_at)
              )
                break;
              if (
                !occupied.some((block) =>
                  overlaps(
                    {
                      ...candidate,
                      buffer_before: task.buffer_before,
                      buffer_after: task.buffer_after,
                    },
                    block,
                  ),
                )
              ) {
                candidates.push(candidate);
                break;
              }
            }
          }
        candidates.sort(
          (a, b) =>
            loads[a.day] - loads[b.day] || a.start_at.localeCompare(b.start_at),
        );
        const best = candidates[0];
        if (best) {
          loads[best.day] += duration;
          occupied.push({
            start_at: new Date(
              Date.parse(best.start_at) - (task.buffer_before ?? 0) * 60000,
            ).toISOString(),
            end_at: new Date(
              Date.parse(best.end_at) + (task.buffer_after ?? 0) * 60000,
            ).toISOString(),
          });
          chunks.push({
            id: task.id,
            title: task.title,
            start_at: best.start_at,
            end_at: best.end_at,
          });
          remaining -= duration;
          placed = true;
          break;
        }
        if (!task.can_split) break;
        duration--;
        if (duration < (task.minimum_session ?? 30)) break;
      }
      if (!placed) break;
    }
    if (remaining === 0) proposed.push(...chunks);
    else {
      occupied.splice(checkpoint);
      loads.splice(0, loads.length, ...initialLoads);
      unscheduled.push({
        id: task.id,
        title: task.title,
        reason: blocked
          ? "Resolve daylight-saving occurrences before planning."
          : "No complete allocation fits the window, minimum session, deadline and daily capacity.",
      });
    }
  }
  let availableMinutes = 0;
  for (const dateText of week.dates) {
    const date = Temporal.PlainDate.from(dateText);
    const begin = date
      .toPlainDateTime({ hour: input.startHour })
      .toZonedDateTime(input.zone).epochMilliseconds;
    const finish = date
      .toPlainDateTime({ hour: input.endHour })
      .toZonedDateTime(input.zone).epochMilliseconds;
    for (
      let at = Math.max(
        begin,
        Math.ceil(Date.parse(input.now) / 60000) * 60000,
      );
      at + 60000 <= finish;
      at += 60000
    ) {
      if (
        !occupied.some(
          (block) =>
            Date.parse(block.start_at) < at + 60000 &&
            Date.parse(block.end_at) > at,
        )
      )
        availableMinutes++;
    }
  }
  const proposedMinutes = proposed.reduce(
    (sum, block) =>
      sum + (Date.parse(block.end_at) - Date.parse(block.start_at)) / 60000,
    0,
  );
  return {
    proposed,
    unscheduled,
    conflicts,
    availableMinutes,
    proposedMinutes,
    calendarMinutes: (Date.parse(week.end) - Date.parse(week.start)) / 60000,
  };
}
