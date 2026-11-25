import { it, expect } from "vitest";
import { weeklyProgress, type ProgressItem } from "../../src/domain/progress";
import { exportCalendar } from "../../src/domain/calendar-export";
const now = "2026-11-23T01:00:00Z";
const item: ProgressItem = {
  id: "task",
  title: "Study",
  kind: "task",
  start_at: null,
  end_at: null,
  timezone: "Australia/Melbourne",
  weekly: false,
  completed: false,
  version: 0,
  duration: 60,
  workstream_id: "course",
};
const base = {
  now,
  week: now,
  zone: item.timezone,
  items: [item],
  changes: [],
  slots: [],
};
it("counts split sessions once while summing all chunk minutes", () => {
  const slots = [
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 1,
      start_at: "2026-11-23T00:00Z",
      end_at: "2026-11-23T00:30Z",
    },
    {
      task_id: item.id,
      occurrence_key: "single",
      ordinal: 2,
      start_at: "2026-11-24T00:00Z",
      end_at: "2026-11-24T00:30Z",
    },
  ];
  const p = weeklyProgress({
    ...base,
    items: [{ ...item, completed: true }],
    slots,
  });
  expect(p.sessions).toBe(1);
  expect(p.completedSessions).toBe(1);
  expect(p.completedMinutes).toBe(60);
  expect(p.streamMinutes("course")).toEqual({ planned: 60, completed: 60 });
});
it("clips overnight work into local daily and weekly boundaries", () => {
  const p = weeklyProgress({
    ...base,
    items: [
      {
        ...item,
        start_at: "2026-11-21T12:30Z",
        end_at: "2026-11-21T14:00Z",
        completed: true,
      },
    ],
  });
  expect(p.plannedMinutes).toBe(60);
  expect(p.days[0].planned).toBe(60);
});
it("attributes unscheduled completion to its recorded completion week", () => {
  const p = weeklyProgress({
    ...base,
    items: [{ ...item, completed: true, completed_at: now }],
  });
  expect(p.completedMinutes).toBe(60);
  expect(p.completedSessions).toBe(1);
  expect(p.plannedMinutes).toBe(0);
  expect(
    weeklyProgress({
      ...base,
      items: [{ ...item, completed: true, completed_at: "2026-11-15T00:00Z" }],
    }).completedMinutes,
  ).toBe(0);
  expect(
    weeklyProgress({
      ...base,
      items: [{ ...item, completed: true, completed_at: null }],
    }).completedMinutes,
  ).toBe(0);
});
it("preserves archived recurring completions and does not count skipped sessions", () => {
  const routine = { ...item, kind: "routine", daily: true };
  const changes = [
    {
      item_id: item.id,
      occurrence_date: "2026-11-23",
      completed: true,
      cancelled: false,
      start_at: null,
      end_at: null,
    },
    {
      item_id: item.id,
      occurrence_date: "2026-11-24",
      completed: false,
      cancelled: true,
      start_at: null,
      end_at: null,
    },
  ];
  const p = weeklyProgress({ ...base, items: [routine], changes });
  expect(p.routines.length).toBe(6);
  expect(p.routines.filter((r) => r.completed)).toHaveLength(1);
  const task = {
    ...item,
    weekly: true,
    archived: true,
    start_at: "2026-11-23T00:00Z",
    end_at: "2026-11-23T01:00Z",
  };
  expect(
    weeklyProgress({ ...base, items: [task], changes }).completedMinutes,
  ).toBe(60);
});
it("exports escaped portable UTC calendar events with byte-safe folding", () => {
  const calendar = exportCalendar(
    [
      {
        ...item,
        title: "Long, title; " + "é".repeat(80) + "\nNext",
        start_at: now,
        end_at: "2026-11-23T02:00Z",
        occurrence_date: "2026-11-23",
      },
    ],
    now,
  );
  expect(calendar).toContain("DTSTART:20261123T010000Z");
  expect(calendar).toContain("Long\\, title\\;");
  expect(calendar).toContain("\\nNext");
  expect(
    calendar
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBe(true);
});
it("selects today's ongoing next activity using the injected clock", () => {
  const p = weeklyProgress({
    ...base,
    items: [
      { ...item, start_at: "2026-11-23T00:30Z", end_at: "2026-11-23T01:30Z" },
      {
        ...item,
        id: "tomorrow",
        start_at: "2026-11-24T00:00Z",
        end_at: "2026-11-24T01:00Z",
      },
    ],
  });
  expect(p.today).toHaveLength(1);
  expect(p.next?.id).toBe("task");
});
