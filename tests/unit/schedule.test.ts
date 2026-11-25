import { expect, it } from "vitest";
import { propose } from "../../src/domain/schedule";
import type { Item } from "../../src/domain/items";
const base = {
  now: "2026-11-21T13:00:00Z",
  week: "2026-11-21T13:00:00Z",
  zone: "Australia/Melbourne",
  capacity: 120,
  startHour: 9,
  endHour: 17,
  changes: [],
};
const task = (id: string): Item => ({
  id,
  title: id,
  kind: "task",
  start_at: null,
  end_at: null,
  timezone: base.zone,
  weekly: false,
  completed: false,
  version: 0,
  duration: 60,
});
it("balances tasks and produces deterministic results", () => {
  const input = { ...base, items: [task("a"), task("b")] };
  const result = propose(input);
  expect(result).toEqual(propose(input));
  expect(result.proposed).toHaveLength(2);
  expect(result.proposed[0].start_at.slice(0, 10)).not.toBe(
    result.proposed[1].start_at.slice(0, 10),
  );
});
it("reports a missed deadline without dropping the task", () => {
  const result = propose({
    ...base,
    items: [{ ...task("a"), due_at: base.now }],
  });
  expect(result.proposed).toHaveLength(0);
  expect(result.unscheduled).toHaveLength(1);
});
it("keeps fixed commitments and buffers clear", () => {
  const fixed = {
    ...task("fixed"),
    kind: "commitment",
    start_at: "2026-11-21T22:00:00Z",
    end_at: "2026-11-21T23:00:00Z",
    buffer_after: 30,
  };
  const result = propose({ ...base, items: [fixed, task("a")] });
  expect(result.proposed[0].start_at).toBe("2026-11-21T23:30:00.000Z");
});
it("splits only when allowed and retains the complete duration", () => {
  const input = {
    ...base,
    capacity: 60,
    startHour: 9,
    endHour: 10,
    items: [
      { ...task("split"), duration: 120, can_split: true, minimum_session: 45 },
    ],
  };
  const result = propose(input);
  expect(result.proposed).toHaveLength(2);
  expect(result.proposedMinutes).toBe(120);
  expect(result.unscheduled).toHaveLength(0);
  expect(
    propose({ ...input, items: [{ ...input.items[0], can_split: false }] })
      .unscheduled,
  ).toHaveLength(1);
});
it("rolls back partial placement when the deadline prevents completion", () => {
  const result = propose({
    ...base,
    capacity: 60,
    startHour: 9,
    endHour: 10,
    items: [
      {
        ...task("split"),
        duration: 120,
        can_split: true,
        minimum_session: 45,
        due_at: "2026-11-21T23:00:00Z",
      },
    ],
  });
  expect(result.proposed).toHaveLength(0);
  expect(result.unscheduled).toHaveLength(1);
  expect(result.proposedMinutes).toBe(0);
});
it("honours release dates and task time windows", () => {
  const result = propose({
    ...base,
    items: [
      {
        ...task("a"),
        earliest_at: "2026-11-23T00:00:00Z",
        preferred_start: 14,
        preferred_end: 16,
      },
    ],
  });
  expect(result.proposed[0].start_at).toBe("2026-11-23T03:00:00.000Z");
});
