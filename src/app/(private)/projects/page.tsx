import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { readProgress } from "@/repositories/progress";
import { weeklyProgress } from "@/domain/progress";
import { WorkstreamForm, ProjectTaskForm } from "@/components/progress-forms";
import { changeItem } from "@/app/planner-actions";
export default async function Projects() {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  const inputs = await readProgress(client, user.id);
  const now = new Date().toISOString();
  const progress = weeklyProgress({
    ...inputs,
    now,
    week: now,
    zone: profile.timezone,
  });
  const { data: streams, error } = await client
    .from("workstreams")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("title");
  if (error) throw Error("Could not load projects.");
  return (
    <>
      <p className="eyebrow">STUDY & PUBLICATION</p>
      <h1>Move your work forward.</h1>
      <p>
        Tasks share the planner’s schedule and completion records. Use the
        planner to set deadlines, allowed hours and priorities.
      </p>
      <section className="card">
        <h2>Create a course or publication</h2>
        <WorkstreamForm />
      </section>
      {!streams.length && (
        <p>No projects yet. Add a course or publication to begin.</p>
      )}
      {streams.map((stream) => {
        const tasks = inputs.items.filter(
          (i) => i.workstream_id === stream.id && (!i.archived || i.completed),
        );
        const total = progress.streamMinutes(stream.id);
        return (
          <section className="card" key={stream.id}>
            <h2>{stream.title}</h2>
            <details>
              <summary>Edit project settings</summary>
              <WorkstreamForm key={stream.version} stream={stream} />
            </details>
            <p>
              {stream.kind} · Weekly target {stream.weekly_target}m · Planned{" "}
              {total.planned}m · Completed {total.completed}m
            </p>
            <p>
              {tasks.filter((t) => t.completed).length} of {tasks.length} tasks
              complete across all weeks.
            </p>
            {!tasks.length && <p>No tasks yet.</p>}
            {tasks.map((task) => (
              <article className="setting-line" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.stage || "Study task"} · {task.duration}m ·{" "}
                    {task.completed ? "Complete" : "Outstanding"}
                    {task.archived ? " · Archived" : ""}
                  </p>
                </div>
                {!task.locked &&
                  !task.archived &&
                  !task.weekly &&
                  !task.daily && (
                    <form action={changeItem}>
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        name="operation"
                        value={task.completed ? "reopen" : "complete"}
                      >
                        {task.completed ? "Reopen task" : "Complete task"}
                      </button>
                    </form>
                  )}
              </article>
            ))}
            <details>
              <summary>Add a task or assignment</summary>
              <ProjectTaskForm id={stream.id} kind={stream.kind} />
            </details>
            <Link href="/planner">Edit scheduling and deadlines →</Link>
          </section>
        );
      })}
    </>
  );
}
