import { Temporal } from "@js-temporal/polyfill";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { readProgress } from "@/repositories/progress";
import { weeklyProgress } from "@/domain/progress";
import { ScreenTimeForm } from "@/components/progress-forms";
export default async function Progress({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  const params = await searchParams;
  const now = new Date().toISOString();
  let target = now;
  try {
    if (params.date)
      target = Temporal.PlainDate.from(params.date)
        .toZonedDateTime(profile.timezone)
        .toInstant()
        .toString();
  } catch {}
  const date = Temporal.Instant.from(target)
    .toZonedDateTimeISO(profile.timezone)
    .toPlainDate()
    .toString();
  const inputs = await readProgress(client, user.id);
  const progress = weeklyProgress({
    ...inputs,
    now,
    week: target,
    zone: profile.timezone,
  });
  const { data: screen, error } = await client
    .from("screen_time")
    .select("*")
    .eq("user_id", user.id)
    .gte("local_date", progress.week.dates[0])
    .lte("local_date", progress.week.dates[6]);
  if (error) throw Error("Could not load screen-time records.");
  return (
    <>
      <p className="eyebrow">WEEKLY REVIEW</p>
      <h1>Your progress.</h1>
      <form action="/progress">
        <label>
          Review date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button>Review week</button>
      </form>
      <p>
        {progress.week.dates[0]} – {progress.week.dates[6]} · {profile.timezone}
      </p>
      <section className="card">
        <h2>Workload and completion</h2>
        <p>
          {progress.plannedMinutes} planned task minutes ·{" "}
          {progress.completedMinutes} completed minutes
        </p>
        <p>
          {progress.sessions} scheduled sessions · {progress.completedSessions}{" "}
          completed sessions · {progress.unscheduled.length} unallocated tasks
        </p>
        <p>
          Completed minutes use scheduled duration, or the estimate for an
          unscheduled task completed in this week. They are not a timer
          measurement. Completed split chunks count as one session. Reopening a
          task removes its completion from this review.
        </p>
        <p>
          Routines: {progress.routines.filter((r) => r.completed).length} of{" "}
          {progress.routines.length} complete.
        </p>
        <ul>
          {progress.days.map((day) => (
            <li key={day.date}>
              {day.date}: {day.planned}m planned · {day.completed}m completed
              scheduled work
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Manual screen-time journal</h2>
        <p>
          No device usage is collected automatically. These entries stay
          separate from task completion totals.
        </p>
        {["productive", "recreational"].map((kind) => {
          const record = screen.find(
            (r) => r.kind === kind && r.local_date === date,
          );
          return (
            <div key={kind}>
              <p>
                This week:{" "}
                {screen
                  .filter((r) => r.kind === kind)
                  .reduce((n, r) => n + r.minutes, 0)}{" "}
                {kind} minutes
              </p>
              <ScreenTimeForm
                key={kind + date + (record?.version ?? -1)}
                date={date}
                kind={kind}
                minutes={record?.minutes ?? 0}
                version={record?.version ?? -1}
              />
            </div>
          );
        })}
      </section>
    </>
  );
}
