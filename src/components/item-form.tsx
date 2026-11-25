"use client";
import { useActionState, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { saveItem } from "@/app/planner-actions";
import type { Item } from "@/domain/items";
export function ItemForm({ item, zone }: { item?: Item; zone: string }) {
  const [state, action, pending] = useActionState(
    async (previous: { error?: string; success?: string }, form: FormData) => {
      try {
        return await saveItem(previous, form);
      } catch {
        return { error: "Connection failed. Your draft is retained." };
      }
    },
    {},
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const value = (name: string, fallback: string) => draft[name] ?? fallback;
  const edit = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setDraft({ ...draft, [event.target.name]: event.target.value });
  const local = (instant: string | null | undefined) =>
    instant
      ? Temporal.Instant.from(instant)
          .toZonedDateTimeISO(zone)
          .toPlainDateTime()
          .toString({ smallestUnit: "minute" })
      : "";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="version" value={item?.version ?? 0} />
      <label>
        Title
        <input
          name="title"
          value={value("title", item?.title ?? "")}
          onChange={edit}
          required
          maxLength={200}
        />
      </label>
      <label>
        Activity type
        <select
          name="kind"
          value={value("kind", item?.kind ?? "commitment")}
          onChange={edit}
        >
          <option value="commitment">Fixed commitment</option>
          <option value="task">Flexible task</option>
          <option value="routine">Routine</option>
          <option value="protected">Protected time</option>
        </select>
      </label>
      <label>
        Start
        <input
          name="start"
          type="datetime-local"
          value={value("start", local(item?.start_at))}
          onChange={edit}
        />
      </label>
      <label>
        End
        <input
          name="end"
          type="datetime-local"
          value={value("end", local(item?.end_at))}
          onChange={edit}
        />
      </label>
      <p className="hint">
        Times use {zone}. Leave both blank for an unscheduled task or checklist
        routine.
      </p>
      <label>
        <input type="checkbox" name="weekly" defaultChecked={item?.weekly} />{" "}
        Repeat weekly
      </label>
      <label>
        <input type="checkbox" name="daily" defaultChecked={item?.daily} />{" "}
        Daily routine
      </label>
      <label>
        Category
        <input
          name="category"
          value={value("category", item?.category ?? "Personal")}
          onChange={edit}
        />
      </label>
      <label>
        Confirmation
        <select
          name="status"
          value={value("status", item?.status ?? "confirmed")}
          onChange={edit}
        >
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label>
        Estimated duration (minutes)
        <input
          type="number"
          name="duration"
          min="1"
          max="1440"
          value={value("duration", String(item?.duration ?? 60))}
          onChange={edit}
          required
        />
      </label>
      <label>
        Priority
        <select
          name="priority"
          value={value("priority", item?.priority ?? "medium")}
          onChange={edit}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Deadline
        <input
          type="datetime-local"
          name="due"
          value={value("due", local(item?.due_at))}
          onChange={edit}
        />
      </label>
      <label>
        Travel / preparation before (minutes)
        <input
          name="buffer_before"
          type="number"
          min="0"
          max="1440"
          value={value("buffer_before", String(item?.buffer_before ?? 0))}
          onChange={edit}
        />
      </label>
      <label>
        Travel after (minutes)
        <input
          name="buffer_after"
          type="number"
          min="0"
          max="1440"
          value={value("buffer_after", String(item?.buffer_after ?? 0))}
          onChange={edit}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="can_split"
          defaultChecked={item?.can_split}
        />{" "}
        Allow splitting
      </label>
      <label>
        Minimum session minutes
        <input
          name="minimum_session"
          type="number"
          min="1"
          max="1440"
          defaultValue={item?.minimum_session ?? 30}
        />
      </label>
      <label>
        Earliest start
        <input
          name="earliest"
          type="datetime-local"
          defaultValue={local(item?.earliest_at)}
        />
      </label>
      <label>
        Allowed start hour
        <input
          name="preferred_start"
          type="number"
          min="0"
          max="22"
          defaultValue={item?.preferred_start ?? 0}
        />
      </label>
      <label>
        Allowed end hour
        <input
          name="preferred_end"
          type="number"
          min="1"
          max="23"
          defaultValue={item?.preferred_end ?? 23}
        />
      </label>
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
      <button disabled={pending}>
        {pending ? "Saving…" : "Save activity"}
      </button>
    </form>
  );
}
