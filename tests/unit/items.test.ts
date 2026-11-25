import { expect, it } from "vitest";
import { occurrences, overlaps, type Item } from "../../src/domain/items";
const item: Item = {
  id: "one",
  title: "Lecture",
  kind: "commitment",
  start_at: "2026-09-27T23:00:00Z",
  end_at: "2026-09-28T00:00:00Z",
  timezone: "Australia/Melbourne",
  weekly: true,
  completed: false,
  version: 0,
};
it("keeps a recurring lecture at local 09:00 across DST", () => {
  const blocks = occurrences(
    [item],
    "2026-10-03T14:00:00Z",
    "2026-10-10T13:00:00Z",
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0].start_at).toBe("2026-10-04T22:00:00Z");
});
it("includes overnight commitments crossing the week boundary", () => {
  expect(
    occurrences(
      [
        {
          ...item,
          weekly: false,
          start_at: "2026-11-21T12:00:00Z",
          end_at: "2026-11-21T15:00:00Z",
        },
      ],
      "2026-11-21T13:00:00Z",
      "2026-11-28T13:00:00Z",
    ),
  ).toHaveLength(1);
});
it("uses half-open conflict boundaries", () => {
  expect(
    overlaps(
      { start_at: "2026-11-22T10:00Z", end_at: "2026-11-22T11:00Z" },
      { start_at: "2026-11-22T11:00Z", end_at: "2026-11-22T12:00Z" },
    ),
  ).toBe(false);
});
it("retains future sessions when completing one recurrence", () => {
  const blocks = occurrences(
    [item],
    "2026-09-27T00:00:00Z",
    "2026-10-12T00:00:00Z",
    [
      {
        item_id: item.id,
        occurrence_date: "2026-09-28",
        completed: true,
        cancelled: false,
        start_at: null,
        end_at: null,
      },
    ],
  );
  expect(blocks[0].completed).toBe(true);
  expect(blocks[1].completed).toBe(false);
});
it("includes an exception moved into a different month", () => {
  const blocks = occurrences(
    [item],
    "2026-11-01T00:00:00Z",
    "2026-11-02T00:00:00Z",
    [
      {
        item_id: item.id,
        occurrence_date: "2026-09-28",
        completed: false,
        cancelled: false,
        start_at: "2026-11-01T01:00:00Z",
        end_at: "2026-11-01T02:00:00Z",
      },
    ],
  );
  expect(blocks.some((block) => block.occurrence_date === "2026-09-28")).toBe(
    true,
  );
});
it("buffers participate in conflict detection", () => {
  expect(
    overlaps(
      {
        start_at: "2026-11-22T10:00Z",
        end_at: "2026-11-22T11:00Z",
        buffer_after: 30,
      },
      { start_at: "2026-11-22T11:15Z", end_at: "2026-11-22T12:00Z" },
    ),
  ).toBe(true);
});
it("flags nonexistent recurring local times for review", () => {
  const blocks = occurrences(
    [
      {
        ...item,
        start_at: "2026-09-26T16:30:00Z",
        end_at: "2026-09-26T17:30:00Z",
      },
    ],
    "2026-10-03T14:00:00Z",
    "2026-10-10T13:00:00Z",
  );
  expect(blocks[0].time_issue).toBe(true);
});
