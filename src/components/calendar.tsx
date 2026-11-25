"use client";
import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { type Block, overlaps } from "@/domain/items";
import { changeOccurrence } from "@/app/planner-actions";
import { OccurrenceForm } from "./session-forms";
export function Calendar({
  blocks,
  dates,
  zone,
  view,
}: {
  blocks: Block[];
  dates: string[];
  zone: string;
  view: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const time = (instant: string) =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
    }).format(new Date(instant));
  async function drop(event: React.DragEvent, date: string) {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    const block = blocks.find(
      (block) =>
        block.id + "@" + block.occurrence_date + "@" + (block.ordinal ?? 0) ===
        key,
    );
    if (
      !block ||
      block.locked ||
      block.completed ||
      block.kind !== "task" ||
      block.time_issue
    )
      return;
    const local = Temporal.Instant.from(block.start_at).toZonedDateTimeISO(
      zone,
    );
    const days = local.toPlainDate().until(Temporal.PlainDate.from(date)).days;
    const start = local.add({ days }),
      end = Temporal.Instant.from(block.end_at)
        .toZonedDateTimeISO(zone)
        .add({ days });
    const form = new FormData();
    form.set("id", block.id);
    form.set("date", block.occurrence_date);
    form.set("operation", "move");
    if (block.allocation_key) {
      form.set("allocation_key", block.allocation_key);
      form.set("ordinal", String(block.ordinal));
      form.set("expected_start", block.start_at);
      form.set("expected_end", block.end_at);
    }
    form.set(
      "start",
      start.withTimeZone(block.timezone).toPlainDateTime().toString(),
    );
    form.set(
      "end",
      end.withTimeZone(block.timezone).toPlainDateTime().toString(),
    );
    setBusy(true);
    try {
      const result = await changeOccurrence({}, form);
      setMessage(result.error ?? result.success ?? "");
    } catch {
      setMessage("Move failed. Try the occurrence form.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Calendar" aria-busy={busy}>
      <p role="status">{message}</p>
      <div
        className={
          view === "week" || view === "month"
            ? "calendar-grid"
            : "calendar-list"
        }
      >
        {dates.map((date) => {
          const start =
            Temporal.PlainDate.from(date).toZonedDateTime(
              zone,
            ).epochMilliseconds;
          const end = Temporal.PlainDate.from(date)
            .add({ days: 1 })
            .toZonedDateTime(zone).epochMilliseconds;
          const dayBlocks = blocks.filter(
            (block) =>
              Date.parse(block.start_at) < end &&
              Date.parse(block.end_at) > start,
          );
          return (
            <section
              className="calendar-day"
              key={date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void drop(event, date)}
            >
              <h3>
                {Temporal.PlainDate.from(date).toLocaleString("en-AU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </h3>
              {!dayBlocks.length && <p className="hint">No activities</p>}
              {dayBlocks.map((block) => (
                <article
                  className={"calendar-block " + block.kind}
                  key={block.id + block.occurrence_date + (block.ordinal ?? 0)}
                  draggable={
                    !busy &&
                    block.kind === "task" &&
                    !block.locked &&
                    !block.completed
                  }
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      "text/plain",
                      block.id +
                        "@" +
                        block.occurrence_date +
                        "@" +
                        (block.ordinal ?? 0),
                    )
                  }
                >
                  {block.time_issue && (
                    <p className="error">
                      Daylight-saving time needs review. Choose an explicit
                      valid time for this occurrence.
                    </p>
                  )}
                  <strong>
                    {block.completed ? "✓ " : ""}
                    {block.title}
                  </strong>
                  <p>
                    {time(block.start_at)} – {time(block.end_at)}
                  </p>
                  <p className="hint">
                    {block.kind} · {block.status ?? "confirmed"}
                    {block.locked ? " · Locked" : ""}
                    {block.cancelled ? " · Skipped" : ""}
                  </p>
                  {(block.buffer_before ?? 0) + (block.buffer_after ?? 0) >
                    0 && (
                    <p className="hint">
                      Buffers {block.buffer_before}m before /{" "}
                      {block.buffer_after}m after
                    </p>
                  )}
                  {!block.cancelled &&
                    !block.time_issue &&
                    blocks.some(
                      (other) =>
                        other !== block &&
                        !other.cancelled &&
                        !other.time_issue &&
                        overlaps(block, other),
                    ) && <p className="error">Overlaps another activity</p>}
                  {!block.locked && <OccurrenceForm block={block} />}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
