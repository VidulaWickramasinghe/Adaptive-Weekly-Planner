import { expect, it } from "vitest";
import { proposeRevision } from "../../src/domain/revisions";
import {
  occurrences,
  type Item,
  type ScheduleSlot,
} from "../../src/domain/items";
const base = {
  now: "2026-11-21T13:00:00Z",
  week: "2026-11-21T13:00:00Z",
  zone: "Australia/Melbourne",
  capacity: 180,
  startHour: 9,
  endHour: 17,
  changes: [],
  slots: [],
};
const task = (
  id: string,
  start_at: string | null = null,
  end_at: string | null = null,
): Item => ({
  id,
  title: id,
  kind: "task",
  start_at,
  end_at,
  timezone: base.zone,
  weekly: false,
  completed: false,
  version: 0,
  duration: 60,
});
const study = task("study", "2026-11-22T22:00:00Z", "2026-11-22T23:00:00Z");
const shift = {
  ...study,
  id: "shift",
  title: "shift",
  kind: "commitment",
  end_at: "2026-11-23T03:00:00Z",
};
it("moves only affected flexible sessions and reports before/after", () => {
  const unaffected = task(
    "other",
    "2026-11-23T22:00:00Z",
    "2026-11-23T23:00:00Z",
  );
  const input = { ...base, items: [study, shift, unaffected] };
  const result = proposeRevision(input);
  expect(result).toEqual(proposeRevision(input));
  expect(result.proposed.map((p) => p.id)).toEqual(["study"]);
  expect(result.proposed[0].before_spans).toEqual([
    { start_at: study.start_at, end_at: study.end_at },
  ]);
  expect(result.proposed[0].start_at).not.toBe(study.start_at);
  expect(input.items[0]).toEqual(study);
});
it("preserves locked, completed and past sessions", () => {
  for (const patch of [{ locked: true }, { completed: true }])
    expect(
      proposeRevision({ ...base, items: [{ ...study, ...patch }, shift] })
        .proposed,
    ).toEqual([]);
  expect(
    proposeRevision({
      ...base,
      now: "2026-11-22T22:30:00Z",
      items: [study, shift],
    }).proposed,
  ).toEqual([]);
});
it("retains displaced work with an explicit unallocated outcome", () => {
  const result = proposeRevision({
    ...base,
    capacity: 0,
    items: [study, shift],
  });
  expect(result.proposed).toHaveLength(0);
  expect(result.unscheduled[0]).toMatchObject({
    id: "study",
    occurrence_key: "single",
    before_spans: [{ start_at: study.start_at, end_at: study.end_at }],
  });
});
it("relocates only the affected occurrence of a weekly task", () => {
  const result = proposeRevision({
    ...base,
    items: [{ ...study, weekly: true }, shift],
  });
  expect(result.proposed[0]).toMatchObject({
    id: "study",
    occurrence_key: "2026-11-23",
  });
});
it("renders split allocations once and does not schedule the task again", () => {
  const item = { ...task("split"), duration: 120, can_split: true };
  const slots: ScheduleSlot[] = [
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 1,
      start_at: "2026-11-22T22:00Z",
      end_at: "2026-11-22T23:00Z",
    },
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 2,
      start_at: "2026-11-23T22:00Z",
      end_at: "2026-11-23T23:00Z",
    },
  ];
  expect(
    occurrences([item], base.week, "2026-11-28T13:00Z", [], slots),
  ).toHaveLength(2);
  expect(proposeRevision({ ...base, items: [item], slots }).proposed).toEqual(
    [],
  );
});
it("an empty override hides the old conflicting time and retains demand", () => {
  const slots: ScheduleSlot[] = [
    {
      task_id: study.id,
      occurrence_key: "single",
      ordinal: 0,
      start_at: null,
      end_at: null,
    },
  ];
  expect(
    occurrences([study], base.week, "2026-11-28T13:00Z", [], slots),
  ).toEqual([]);
  expect(
    proposeRevision({ ...base, items: [study], slots }).proposed[0].id,
  ).toBe(study.id);
});
it("completed split sessions retain their chunks without becoming new demand", () => {
  const item = { ...task("split"), completed: true };
  const slots: ScheduleSlot[] = [
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 1,
      start_at: "2026-11-22T22:00Z",
      end_at: "2026-11-22T23:00Z",
    },
  ];
  expect(
    occurrences([item], base.week, "2026-11-28T13:00Z", [], slots)[0].completed,
  ).toBe(true);
  expect(
    proposeRevision({ ...base, items: [item, shift], slots }).proposed,
  ).toEqual([]);
});
it("does not replace only part of an allocation spanning two weeks", () => {
  const item = { ...task("split"), duration: 120, can_split: true };
  const slots: ScheduleSlot[] = [
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 1,
      start_at: study.start_at,
      end_at: study.end_at,
    },
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 2,
      start_at: "2026-11-30T22:00Z",
      end_at: "2026-11-30T23:00Z",
    },
  ];
  const result = proposeRevision({ ...base, items: [item, shift], slots });
  expect(result.proposed).toEqual([]);
  expect(result.conflicts).toHaveLength(1);
});
