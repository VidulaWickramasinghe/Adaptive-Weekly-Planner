import { Temporal } from "@js-temporal/polyfill";
import { saveProposal } from "@/app/proposal-actions";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { readPlanning } from "@/repositories/planning";
import { ProposalDecision } from "@/components/proposal-decision";
import { proposeRevision } from "@/domain/revisions";

export default async function Proposal({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    saved?: string;
    date?: string;
    notice?: string;
  }>;
}) {
  const { client, user } = await requireUser();
  const { snapshot } = await readPlanning(client);
  const { profile, items, changes, slots } = snapshot;
  const params = await searchParams;
  const start = Number(params.start ?? 9),
    end = Number(params.end ?? 17);
  let target = new Date().toISOString();
  let validDate = true;
  try {
    if (params.date)
      target = Temporal.PlainDate.from(params.date)
        .toZonedDateTime(profile.timezone)
        .toInstant()
        .toString();
  } catch {
    validDate = false;
  }
  const valid =
    validDate &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end <= 23 &&
    end > start;
  const now = new Date().toISOString();
  const result = valid
    ? proposeRevision({
        slots,
        now,
        week: target,
        zone: profile.timezone,
        capacity: profile.preferred_daily_capacity,
        startHour: start,
        endHour: end,
        items,
        changes,
      })
    : null;
  const { data: history } = await client
    .from("schedule_proposals")
    .select("id,created_at,status,base_fingerprint")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const saved = history?.find((row) => row.id === params.saved);
  const savedId = saved?.id;
  const { data: savedEntries } = savedId
    ? await client
        .from("proposal_entries")
        .select("*")
        .eq("proposal_id", savedId)
        .eq("user_id", user.id)
    : { data: null };
  const format = (instant: string) =>
    new Intl.DateTimeFormat("en-AU", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: profile.timezone,
    }).format(new Date(instant));
  return (
    <>
      <p className="eyebrow">PLAN YOUR WEEK</p>
      <h1>Scheduling preview</h1>
      {params.notice && <p role="alert">{params.notice}</p>}
      <p className="lede">
        Choose the daily hours available for flexible tasks. Existing activities
        and protected periods are reserved.
      </p>
      <form action="/proposal">
        <label>
          Planning date
          <input
            name="date"
            type="date"
            defaultValue={
              params.date ??
              Temporal.Instant.from(target)
                .toZonedDateTimeISO(profile.timezone)
                .toPlainDate()
                .toString()
            }
          />
        </label>
        <label>
          Start hour (0–22)
          <input
            name="start"
            type="number"
            min="0"
            max="22"
            defaultValue={valid ? start : 9}
            required
          />
        </label>
        <label>
          End hour (1–23)
          <input
            name="end"
            type="number"
            min="1"
            max="23"
            defaultValue={valid ? end : 17}
            required
          />
        </label>
        <button>Generate proposal</button>
      </form>
      {!valid && <p role="alert">Choose a valid start and end hour.</p>}
      {savedEntries && (
        <section className="card">
          <h2>Saved proposal</h2>
          <p>Status: {saved?.status}. Review all changes before accepting.</p>
          {saved && (
            <ProposalDecision
              id={saved.id}
              status={saved.status}
              legacy={!saved.base_fingerprint}
            />
          )}
          <p>
            Undo is available only while planning inputs remain unchanged and
            the old placements are safe.
          </p>
          {savedEntries.map((row) => (
            <p key={row.id}>
              {row.title} —{" "}
              {row.before_spans?.length > 0 && (
                <>
                  From{" "}
                  {row.before_spans
                    .map(
                      (span: { start_at: string; end_at: string }) =>
                        format(span.start_at) + " – " + format(span.end_at),
                    )
                    .join(", ")}{" "}
                  →{" "}
                </>
              )}
              {row.start_at
                ? format(row.start_at) + " – " + format(row.end_at)
                : row.reason}
            </p>
          ))}
        </section>
      )}
      {result && (
        <>
          <section className="card">
            <h2>Proposed sessions</h2>
            <p>
              {result.proposedMinutes} minutes proposed ·{" "}
              {result.availableMinutes} free minutes remain inside the daily
              window · {result.calendarMinutes} elapsed minutes in this week.
            </p>
            <form action={saveProposal}>
              <input
                type="hidden"
                name="date"
                value={Temporal.Instant.from(target)
                  .toZonedDateTimeISO(profile.timezone)
                  .toPlainDate()
                  .toString()}
              />
              <input type="hidden" name="start" value={start} />
              <input type="hidden" name="end" value={end} />
              <button>Save proposal for review</button>
            </form>
            <p>
              Save the proposal to review, accept or reject it. Conflicting
              flexible sessions are proposed for relocation; unaffected sessions
              stay in place.
            </p>
            {!result.proposed.length && (
              <p>No eligible tasks could be placed.</p>
            )}
            {result.proposed.map((block) => (
              <article
                className="setting-line"
                key={block.id + block.occurrence_key + block.start_at}
              >
                <strong>{block.title}</strong>
                {block.before_spans.length > 0 && (
                  <span>
                    From{" "}
                    {block.before_spans
                      .map(
                        (span) =>
                          format(span.start_at) + " – " + format(span.end_at),
                      )
                      .join(", ")}
                  </span>
                )}
                <span>{block.reason}</span>
                <span>
                  {format(block.start_at)} – {format(block.end_at)}
                </span>
              </article>
            ))}
          </section>
          <section className="card">
            <h2>Unscheduled tasks</h2>
            {result.unscheduled.length === 0 && (
              <p>No unallocated eligible tasks.</p>
            )}
            {result.unscheduled.map((item) => (
              <p key={item.id + item.occurrence_key}>
                {item.title} —{" "}
                {item.before_spans.length > 0
                  ? "Will become unscheduled. "
                  : ""}
                {item.reason}
              </p>
            ))}
          </section>
          <section className="card">
            <h2>Existing conflicts</h2>
            {result.conflicts.length === 0 ? (
              <p>No existing overlaps detected.</p>
            ) : (
              result.conflicts.map((text, i) => <p key={i}>{text}</p>)
            )}
          </section>
        </>
      )}
      <section className="card">
        <h2>Saved proposals</h2>
        {history?.map((row) => (
          <p key={row.id}>
            <Link href={"/proposal?saved=" + row.id}>
              {new Date(row.created_at).toLocaleString("en-AU", {
                timeZone: profile.timezone,
              })}
            </Link>
          </p>
        ))}
      </section>
    </>
  );
}
