import {
  occurrences,
  overlaps,
  type Item,
  type OccurrenceChange,
  type ScheduleSlot,
  type Block,
} from "./items";
import { propose } from "./schedule";
import { planningWeek } from "./week";
export type PlanningSnapshot = {
  profile: { timezone: string; preferred_daily_capacity: number };
  items: Item[];
  changes: OccurrenceChange[];
  slots: ScheduleSlot[];
};
const key = (b: Block) =>
  b.allocation_key ?? (b.weekly || b.daily ? b.occurrence_date : "single");
export function proposeRevision(
  input: Parameters<typeof propose>[0] & { slots: ScheduleSlot[] },
) {
  const week = planningWeek(input.week, input.zone);
  const blocks = occurrences(
    input.items,
    week.start,
    week.end,
    input.changes,
    input.slots,
  ).filter((b) => !b.cancelled);
  const affected = new Set<string>();
  for (const b of blocks) {
    if (
      b.kind !== "task" ||
      b.locked ||
      b.completed ||
      b.time_issue ||
      Date.parse(b.start_at) < Date.parse(input.now)
    )
      continue;
    if (
      blocks.some(
        (other) =>
          other !== b &&
          overlaps(b, other) &&
          (other.kind !== "task" ||
            other.locked ||
            other.completed ||
            other.id.localeCompare(b.id) < 0),
      )
    )
      affected.add(b.id + "@" + key(b));
  }
  const identities = new Map<
    string,
    {
      id: string;
      occurrence_key: string;
      before_spans: { start_at: string; end_at: string }[];
    }
  >();
  const tasks: Item[] = [];
  for (const identity of affected) {
    const group = blocks.filter((b) => b.id + "@" + key(b) === identity);
    // A partially completed or past session remains untouched.
    if (
      group.some(
        (b) =>
          b.completed ||
          b.locked ||
          b.time_issue ||
          Date.parse(b.start_at) < Date.parse(input.now),
      )
    ) {
      affected.delete(identity);
      continue;
    }
    const first = group[0];
    // A group partly outside this week cannot be replaced by a partial diff.
    if (
      input.slots.some(
        (slot) =>
          slot.task_id === first.id &&
          slot.occurrence_key === key(first) &&
          slot.start_at &&
          slot.end_at &&
          (Date.parse(slot.start_at) < Date.parse(week.start) ||
            Date.parse(slot.end_at) > Date.parse(week.end)),
      )
    ) {
      affected.delete(identity);
      continue;
    }
    identities.set(identity, {
      id: first.id,
      occurrence_key: key(first),
      before_spans: group.map((b) => ({
        start_at: b.start_at,
        end_at: b.end_at,
      })),
    });
    tasks.push({
      ...first,
      id: identity,
      start_at: null,
      end_at: null,
      duration: group.reduce(
        (n, b) => n + (Date.parse(b.end_at) - Date.parse(b.start_at)) / 60000,
        0,
      ),
    });
  }
  for (const item of input.items) {
    const allocations = input.slots.filter(
      (s) => s.task_id === item.id && s.occurrence_key === "single",
    );
    if (
      item.kind !== "task" ||
      item.completed ||
      item.locked ||
      item.status === "cancelled" ||
      item.weekly ||
      item.daily ||
      (item.planning_week && item.planning_week > week.dates[0]) ||
      (allocations.length
        ? allocations.some((s) => s.ordinal > 0)
        : item.start_at)
    )
      continue;
    const identity = item.id + "@single";
    if (identities.has(identity)) continue;
    identities.set(identity, {
      id: item.id,
      occurrence_key: "single",
      before_spans: [],
    });
    tasks.push({
      ...item,
      id: identity,
      start_at: null,
      end_at: null,
      duration:
        item.start_at && item.end_at
          ? (Date.parse(item.end_at) - Date.parse(item.start_at)) / 60000
          : item.duration,
    });
  }
  // Empty recurring overrides are still outstanding sessions, not deleted work.
  for (const slot of input.slots.filter(
    (s) =>
      s.ordinal === 0 &&
      s.occurrence_key !== "single" &&
      s.occurrence_key >= week.dates[0] &&
      s.occurrence_key <= week.dates[6],
  )) {
    const item = input.items.find((i) => i.id === slot.task_id);
    const identity = slot.task_id + "@" + slot.occurrence_key;
    const change = input.changes.find(
      (c) =>
        c.item_id === slot.task_id && c.occurrence_date === slot.occurrence_key,
    );
    if (
      !item ||
      item.completed ||
      item.locked ||
      item.status === "cancelled" ||
      change?.completed ||
      change?.cancelled ||
      identities.has(identity)
    )
      continue;
    identities.set(identity, {
      id: item.id,
      occurrence_key: slot.occurrence_key,
      before_spans: [],
    });
    tasks.push({
      ...item,
      id: identity,
      start_at: null,
      end_at: null,
      duration:
        item.start_at && item.end_at
          ? (Date.parse(item.end_at) - Date.parse(item.start_at)) / 60000
          : item.duration,
    });
  }
  const result = propose({
    ...input,
    blocks: blocks.filter((b) => !affected.has(b.id + "@" + key(b))),
    tasks,
  });
  return {
    ...result,
    proposed: result.proposed.map((b) => ({
      ...b,
      ...identities.get(b.id)!,
      reason: identities.get(b.id)!.before_spans.length
        ? "Moved because a new conflict affects this session."
        : "Fits availability, deadline and daily capacity.",
    })),
    unscheduled: result.unscheduled.map((b) => ({
      ...b,
      ...identities.get(b.id)!,
    })),
    conflicts: blocks.flatMap((b, i) =>
      blocks
        .slice(i + 1)
        .filter((o) => overlaps(b, o))
        .map((o) => b.title + " overlaps " + o.title),
    ),
  };
}
