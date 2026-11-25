import Link from "next/link";
import { readProgress } from "@/repositories/progress";
import { weeklyProgress } from "@/domain/progress";
import { overlaps } from "@/domain/items";
import { OccurrenceForm, RoutineCheck } from "@/components/session-forms";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { planningWeek, dateLabel } from "@/domain/week";
export default async function Dashboard() {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  const now = new Date().toISOString();
  const week = planningWeek(now, profile.timezone);
  const input = await readProgress(client, user.id);
  const progress = weeklyProgress({
    ...input,
    now,
    week: now,
    zone: profile.timezone,
  });
  const { today, next } = progress;
  const clock = (instant: string) =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: profile.timezone,
    }).format(new Date(instant));
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">YOUR WEEK, AT A GLANCE</p>
        <span className="zone">{profile.timezone.replaceAll("_", " ")}</span>
      </header>
      <section className="intro">
        <h1>
          Make room for
          <br />
          <em>what matters.</em>
        </h1>
        <p>A calm place to bring your week together.</p>
      </section>
      <section className="week-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THIS WEEK</p>
            <h2>
              {dateLabel(week.dates[0], { day: "numeric", month: "short" })} —{" "}
              {dateLabel(week.dates[6], {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </h2>
          </div>
          <span className="tag">Sunday start</span>
        </div>
        <ol className="week-strip">
          {week.dates.map((date) => (
            <li
              key={date}
              className={date === week.today ? "today" : ""}
              aria-current={date === week.today ? "date" : undefined}
            >
              <span>{dateLabel(date, { weekday: "short" })}</span>
              <strong>{dateLabel(date, { day: "numeric" })}</strong>
              <span className="day-marker">
                {date === week.today ? "Today" : "·"}
              </span>
            </li>
          ))}
        </ol>
        <div className="week-note">
          <span className="note-icon">↗</span>
          <div>
            <h3>Your week starts with you.</h3>
            <p>
              Set your time zone and daily capacity to lay the groundwork for
              your planner.
            </p>
          </div>
          <Link className="text-link" href="/settings">
            Personalise your week →
          </Link>
        </div>
      </section>
      <section className="card">
        <h2>Today</h2>
        <p>
          {next
            ? "Next activity: " + next.title + " at " + clock(next.start_at)
            : "No remaining scheduled activities today."}
        </p>
        {!today.length && <p>Your calendar is clear today.</p>}
        {today.map((block) => (
          <article
            className="setting-line"
            key={block.id + block.occurrence_date + (block.ordinal ?? 0)}
          >
            <div>
              <strong>
                {block.completed ? "✓ " : ""}
                {block.title}
              </strong>
              <p>
                {clock(block.start_at)} – {clock(block.end_at)} · {block.kind}
              </p>
              {today.some(
                (other) => other !== block && overlaps(block, other),
              ) && (
                <p className="error">
                  Overlaps another activity. Review a schedule proposal.
                </p>
              )}
              {!block.locked && <OccurrenceForm block={block} />}
            </div>
          </article>
        ))}
        <Link href="/planner">Open calendar →</Link>
      </section>
      <section className="card">
        <h2>Today’s routine checklist</h2>
        {input.items
          .filter(
            (i) =>
              i.kind === "routine" &&
              i.daily &&
              !i.start_at &&
              !i.archived &&
              i.status !== "cancelled",
          )
          .map((item) => {
            const change = input.changes.find(
              (c) => c.item_id === item.id && c.occurrence_date === week.today,
            );
            return (
              <RoutineCheck
                key={item.id}
                id={item.id}
                date={week.today}
                title={item.title}
                completed={change?.completed ?? false}
                skipped={change?.cancelled ?? false}
                locked={item.locked ?? false}
              />
            );
          })}
        {!input.items.some(
          (i) =>
            i.kind === "routine" &&
            i.daily &&
            !i.start_at &&
            !i.archived &&
            i.status !== "cancelled",
        ) && <p>No checklist routines yet.</p>}
      </section>
      <section className="card">
        <h2>Upcoming and overdue deadlines</h2>
        {input.items
          .filter(
            (i) =>
              !i.archived &&
              !i.completed &&
              i.status !== "cancelled" &&
              i.due_at,
          )
          .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
          .slice(0, 10)
          .map((i) => (
            <p key={i.id}>
              {i.title} ·{" "}
              {new Date(i.due_at!).toLocaleString("en-AU", {
                timeZone: profile.timezone,
              })}
              {Date.parse(i.due_at!) < Date.parse(now) ? " · Overdue" : ""}
            </p>
          ))}
        {!input.items.some(
          (i) =>
            !i.archived && !i.completed && i.status !== "cancelled" && i.due_at,
        ) && <p>No outstanding deadlines.</p>}
        <Link href="/progress">Review weekly progress →</Link>
      </section>
      <div className="detail-grid">
        <section className="card">
          <p className="eyebrow">DAILY CAPACITY</p>
          <h2 className="stat">
            {Math.floor(profile.preferred_daily_capacity / 60)}
            <small>h</small> {profile.preferred_daily_capacity % 60}
            <small>m</small>
          </h2>
          <p>Your preferred time for flexible activities.</p>
          <Link href="/settings" className="text-link">
            Adjust capacity →
          </Link>
        </section>
        <section className="card warm">
          <p className="eyebrow">A WEEK THAT FITS YOUR LIFE</p>
          <h2>Start with the essentials.</h2>
          <p>
            {progress.plannedMinutes} task minutes planned this week ·{" "}
            {progress.completedMinutes} minutes complete ·{" "}
            {progress.unscheduled.length} tasks need a time.
          </p>
        </section>
      </div>
    </>
  );
}
