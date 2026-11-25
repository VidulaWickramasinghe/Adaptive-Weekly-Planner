"use client";
import { useActionState } from "react";
import {
  saveWorkstream,
  saveProjectTask,
  saveScreenTime,
} from "@/app/progress-actions";
export function WorkstreamForm({
  stream,
}: {
  stream?: {
    id: string;
    title: string;
    kind: string;
    weekly_target: number;
    version: number;
  };
}) {
  const [state, action, pending] = useActionState(saveWorkstream, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={stream?.id ?? ""} />
      <input type="hidden" name="version" value={stream?.version ?? 0} />
      <label>
        Project or course title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={stream?.title}
        />
      </label>
      <label>
        Track
        <select name="kind" defaultValue={stream?.kind ?? "study"}>
          <option value="study">Study course</option>
          <option value="publication">Publication project</option>
        </select>
      </label>
      <label>
        Weekly target minutes
        <input
          name="weekly_target"
          type="number"
          min={0}
          max={10080}
          defaultValue={stream?.weekly_target ?? 120}
        />
      </label>
      <button disabled={pending} name="operation" value="save">
        {stream ? "Save project" : "Create project"}
      </button>
      {stream && (
        <details>
          <summary>Archive this project</summary>
          <p>Associated tasks and history remain in the planner.</p>
          <button disabled={pending} name="operation" value="archive">
            Confirm archive project
          </button>
        </details>
      )}
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
    </form>
  );
}
export function ProjectTaskForm({ id, kind }: { id: string; kind: string }) {
  const [state, action, pending] = useActionState(saveProjectTask, {});
  return (
    <form action={action}>
      <input type="hidden" name="workstream_id" value={id} />
      <label>
        Task or assignment title
        <input name="title" required maxLength={200} />
      </label>
      <label>
        Estimated minutes
        <input
          name="duration"
          type="number"
          min={1}
          max={1440}
          defaultValue={60}
        />
      </label>
      <label>
        Publication stage
        <select name="stage" defaultValue="">
          <option value="">Not applicable</option>
          {kind === "publication" &&
            [
              "research",
              "draft",
              "edit",
              "fact-check",
              "proofread",
              "publish",
            ].map((stage) => <option key={stage}>{stage}</option>)}
        </select>
      </label>
      <button disabled={pending}>Add project task</button>
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
    </form>
  );
}
export function ScreenTimeForm({
  date,
  kind,
  minutes,
  version,
}: {
  date: string;
  kind: string;
  minutes: number;
  version: number;
}) {
  const [state, action, pending] = useActionState(saveScreenTime, {});
  return (
    <form action={action}>
      <input name="local_date" type="hidden" value={date} />
      <input name="kind" type="hidden" value={kind} />
      <input name="version" type="hidden" value={version} />
      <label>
        {kind === "productive"
          ? "Productive screen minutes"
          : "Recreational screen minutes"}
        <input
          name="minutes"
          type="number"
          min={0}
          max={1440}
          required
          defaultValue={minutes}
        />
      </label>
      <button disabled={pending}>Save {kind} time</button>
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
    </form>
  );
}
