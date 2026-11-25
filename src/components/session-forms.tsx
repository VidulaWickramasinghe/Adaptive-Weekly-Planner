"use client";
import { useActionState } from "react";
import { changeOccurrence, saveTemplate } from "@/app/planner-actions";
import type { Block } from "@/domain/items";
import { Temporal } from "@js-temporal/polyfill";
export function OccurrenceForm({ block }: { block: Block }) {
  const [state, action, pending] = useActionState(changeOccurrence, {});
  const local = (instant: string) =>
    Temporal.Instant.from(instant)
      .toZonedDateTimeISO(block.timezone)
      .toPlainDateTime()
      .toString({ smallestUnit: "minute" });
  return (
    <details>
      <summary>Manage this occurrence</summary>
      <form action={action}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="date" value={block.occurrence_date} />
        {block.allocation_key && (
          <>
            <input
              type="hidden"
              name="allocation_key"
              value={block.allocation_key}
            />
            <input type="hidden" name="ordinal" value={block.ordinal} />
            <input type="hidden" name="expected_start" value={block.start_at} />
            <input type="hidden" name="expected_end" value={block.end_at} />
            <p>
              Completion applies to the whole session, including its split
              chunks. Moves preserve this chunk’s duration.
            </p>
          </>
        )}
        <button
          name="operation"
          value={block.completed ? "reopen" : "complete"}
          disabled={pending}
        >
          {block.completed ? "Reopen occurrence" : "Complete occurrence"}
        </button>
        {!block.allocation_key && (
          <button
            name="operation"
            value={block.cancelled ? "restore" : "cancel"}
            disabled={pending}
          >
            {block.cancelled ? "Restore occurrence" : "Skip occurrence"}
          </button>
        )}
        <label>
          Occurrence start
          <input
            name="start"
            type="datetime-local"
            defaultValue={local(block.start_at)}
          />
        </label>
        <label>
          Occurrence end
          <input
            name="end"
            type="datetime-local"
            defaultValue={local(block.end_at)}
          />
        </label>
        <button name="operation" value="move" disabled={pending}>
          Move this occurrence
        </button>
        <p role="alert">{state.error}</p>
        <p role="status">{state.success}</p>
      </form>
    </details>
  );
}
export type Template = {
  id: string;
  title: string;
  duration: number;
  frequency: number;
  priority: string;
};
export function TemplateForm({ template }: { template?: Template }) {
  const [state, action, pending] = useActionState(saveTemplate, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={template?.id ?? ""} />
      <label>
        Template title
        <input
          name="title"
          defaultValue={template?.title}
          required
          maxLength={200}
        />
      </label>
      <label>
        Session minutes
        <input
          name="duration"
          type="number"
          min="1"
          max="1440"
          defaultValue={template?.duration ?? 60}
          required
        />
      </label>
      <label>
        Sessions per week
        <input
          name="frequency"
          type="number"
          min="1"
          max="21"
          defaultValue={template?.frequency ?? 3}
          required
        />
      </label>
      <label>
        Template priority
        <select name="priority" defaultValue={template?.priority ?? "medium"}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <button disabled={pending}>Save template</button>
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
    </form>
  );
}
export function RoutineCheck({
  id,
  date,
  title,
  completed,
  skipped,
  locked,
}: {
  id: string;
  date: string;
  title: string;
  completed: boolean;
  skipped: boolean;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(changeOccurrence, {});
  return (
    <form action={action} className="setting-line">
      <div>
        <strong>{title}</strong>
        <p>
          {date}
          {skipped ? " · Skipped" : completed ? " · Complete" : ""}
        </p>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="date" value={date} />
        <button
          disabled={locked || pending}
          name="operation"
          value={completed ? "reopen" : "complete"}
        >
          {completed ? "Reopen" : "Complete"}
        </button>
        <button
          disabled={locked || pending}
          name="operation"
          value={skipped ? "restore" : "cancel"}
        >
          {skipped ? "Restore" : "Skip"}
        </button>
        <p role="alert">{state.error}</p>
      </div>
    </form>
  );
}
