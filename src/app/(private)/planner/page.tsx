import Link from "next/link";
import { Temporal } from "@js-temporal/polyfill";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { planningWeek, dateLabel } from "@/domain/week";
import {
  occurrences,
  type Item,
  type OccurrenceChange,
  type ScheduleSlot,
} from "@/domain/items";
import { ItemForm } from "@/components/item-form";
import { Calendar } from "@/components/calendar";
import {
  TemplateForm,
  RoutineCheck,
  type Template,
} from "@/components/session-forms";
import { changeItem, templateOperation } from "@/app/planner-actions";
export default async function Planner({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; filter?: string }>;
}) {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  const params = await searchParams;
  const now = new Date().toISOString();
  let instant = now;
  try {
    if (params.date)
      instant = Temporal.PlainDate.from(params.date)
        .toZonedDateTime(profile.timezone)
        .toInstant()
        .toString();
  } catch {}
  const week = planningWeek(instant, profile.timezone);
  const { data, error } = await client
    .from("planner_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("title");
  if (error) throw Error("Unable to load activities.");
  const items = data as Item[];
  const [
    { data: changes, error: changesError },
    { data: slots, error: slotsError },
    { data: templates, error: templatesError },
  ] = await Promise.all([
    client.from("occurrence_changes").select("*").eq("user_id", user.id),
    client.from("schedule_slots").select("*").eq("user_id", user.id),
    client
      .from("task_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("title"),
  ]);
  if (changesError || templatesError || slotsError)
    throw Error("Could not load session records.");
  const selected = Temporal.Instant.from(instant)
    .toZonedDateTimeISO(profile.timezone)
    .toPlainDate();
  const view = ["week", "day", "month", "agenda"].includes(params.view ?? "")
    ? params.view!
    : "week";
  let dates = week.dates;
  if (view === "day") dates = [selected.toString()];
  if (view === "month") {
    const first = selected.with({ day: 1 });
    const sunday = first.subtract({ days: first.dayOfWeek % 7 });
    dates = Array.from({ length: 42 }, (_, i) =>
      sunday.add({ days: i }).toString(),
    );
  }
  const rangeStart = Temporal.PlainDate.from(dates[0])
    .toZonedDateTime(profile.timezone)
    .toInstant()
    .toString();
  const rangeEnd = Temporal.PlainDate.from(dates.at(-1)!)
    .add({ days: 1 })
    .toZonedDateTime(profile.timezone)
    .toInstant()
    .toString();
  const blocks = occurrences(
    items,
    rangeStart,
    rangeEnd,
    (changes ?? []) as OccurrenceChange[],
    (slots ?? []) as ScheduleSlot[],
  );
  const navigate = (direction: number) =>
    "/planner?view=" +
    view +
    "&date=" +
    selected
      .add(
        view === "month"
          ? { months: direction }
          : { days: direction * (view === "day" ? 1 : 7) },
      )
      .toString();
  const scheduled = (item: Item) => {
    const assigned =
      slots?.filter(
        (slot) => slot.task_id === item.id && slot.occurrence_key === "single",
      ) ?? [];
    return assigned.length
      ? assigned.some((slot) => slot.ordinal > 0)
      : !!item.start_at;
  };
  const pool = items.filter((item) =>
    params.filter === "unscheduled"
      ? !scheduled(item)
      : params.filter === "overdue"
        ? item.due_at &&
          !item.completed &&
          Date.parse(item.due_at) < Date.parse(now)
        : true,
  );
  return (
    <>
      <p className="eyebrow">YOUR WEEK</p>
      <h1>Make time for it.</h1>
      <p className="lede">
        {dateLabel(week.dates[0], { day: "numeric", month: "short" })} –{" "}
        {dateLabel(week.dates[6], {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}{" "}
        · {profile.timezone}
      </p>
      <nav aria-label="Week navigation">
        <Link href={navigate(-1)}>← Previous week</Link>
        <Link href="/planner">This week</Link>
        <Link href={navigate(1)}>Next week →</Link>
      </nav>
      <nav aria-label="Calendar view">
        {["week", "day", "month", "agenda"].map((mode) => (
          <Link
            key={mode}
            aria-current={mode === view ? "page" : undefined}
            href={"/planner?view=" + mode + "&date=" + selected.toString()}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </Link>
        ))}
      </nav>
      <form action="/planner" className="date-picker">
        <label>
          Go to date
          <input type="date" name="date" defaultValue={selected.toString()} />
        </label>
        <input type="hidden" name="view" value={view} />
        <button>Go</button>
      </form>
      <p>
        <Link href={"/proposal?date=" + week.dates[0]}>
          Review a schedule proposal for this week
        </Link>
      </p>
      <Calendar
        blocks={blocks}
        dates={dates}
        zone={profile.timezone}
        view={view}
      />
      <section className="card">
        <h2>Daily checklist</h2>
        {items.filter((item) => item.daily && !item.start_at).length === 0 && (
          <p>No checklist routines yet.</p>
        )}
        {items
          .filter((item) => item.daily && !item.start_at)
          .map((item) =>
            dates.map((date) => {
              const change = changes?.find(
                (change) =>
                  change.item_id === item.id && change.occurrence_date === date,
              );
              return (
                <RoutineCheck
                  key={item.id + date}
                  id={item.id}
                  date={date}
                  title={item.title}
                  completed={change?.completed ?? false}
                  skipped={change?.cancelled ?? false}
                  locked={item.locked ?? false}
                />
              );
            }),
          )}
      </section>
      <div className="detail-grid">
        <section className="card">
          <h2>Add an activity</h2>
          <ItemForm zone={profile.timezone} />
        </section>
        <section className="card">
          <h2>Activities and task pool</h2>
          {items.length === 0 && (
            <p>Add your first commitment or flexible task.</p>
          )}
          <nav aria-label="Task filters">
            <Link href="/planner">All</Link>
            <Link href="/planner?filter=unscheduled">Unscheduled</Link>
            <Link href="/planner?filter=overdue">Overdue</Link>
          </nav>
          {pool.map((item) => (
            <details key={item.id}>
              <summary>
                {item.completed ? "✓ " : ""}
                {item.title} · {scheduled(item) ? "Scheduled" : "Unscheduled"}
              </summary>
              <p>
                {item.category} · {item.priority} · {item.duration} minutes
                {item.session_number ? " · Session " + item.session_number : ""}
              </p>
              <form action={changeItem}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  name="operation"
                  value={item.locked ? "unlock" : "lock"}
                >
                  {item.locked ? "Unlock activity" : "Lock activity"}
                </button>
                <button name="operation" value="duplicate">
                  Duplicate
                </button>
              </form>
              {item.locked ? (
                <p>Unlock this activity to edit it.</p>
              ) : (
                <ItemForm key={item.version} item={item} zone={item.timezone} />
              )}
              {!item.weekly && !item.daily && !item.locked && (
                <form action={changeItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    name="operation"
                    value={item.completed ? "reopen" : "complete"}
                  >
                    {item.completed ? "Reopen" : "Mark complete"}
                  </button>
                </form>
              )}
              {!item.locked && (
                <details>
                  <summary>Remove activity</summary>
                  <p>This archives the activity and its weekly series.</p>
                  <form action={changeItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button name="operation" value="archive">
                      Confirm archive
                    </button>
                  </form>
                </details>
              )}
            </details>
          ))}
        </section>
      </div>
      <section className="card">
        <h2>Reusable task templates</h2>
        <details>
          <summary>Create template</summary>
          <TemplateForm />
        </details>
        {(templates as Template[]).map((template) => (
          <details key={template.id}>
            <summary>
              {template.title} · {template.frequency} × {template.duration}{" "}
              minutes
            </summary>
            <TemplateForm template={template} />
            <details>
              <summary>Remove template</summary>
              <form action={templateOperation}>
                <input type="hidden" name="id" value={template.id} />
                <button name="operation" value="archive">
                  Confirm archive template
                </button>
              </form>
            </details>
          </details>
        ))}
        <form action={templateOperation}>
          <input type="hidden" name="week" value={week.dates[0]} />
          <button name="operation" value="generate">
            Generate sessions for {week.dates[0]}
          </button>
        </form>
        <p className="hint">
          Existing sessions are preserved when you generate this week again.
        </p>
      </section>
    </>
  );
}
