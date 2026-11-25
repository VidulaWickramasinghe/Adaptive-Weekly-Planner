import { Temporal } from "@js-temporal/polyfill";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { readProgress } from "@/repositories/progress";
import { planningWeek } from "@/domain/week";
import { occurrences } from "@/domain/items";
import { exportCalendar } from "@/domain/calendar-export";
export async function GET(request: Request) {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  const now = new Date().toISOString();
  let target = now;
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date)
      target = Temporal.PlainDate.from(date)
        .toZonedDateTime(profile.timezone)
        .toInstant()
        .toString();
  } catch {
    return new Response("Invalid date", { status: 400 });
  }
  const week = planningWeek(target, profile.timezone);
  const input = await readProgress(client, user.id);
  const blocks = occurrences(
    input.items.filter((i) => !i.archived),
    week.start,
    week.end,
    input.changes,
    input.slots,
  );
  return new Response(exportCalendar(blocks, now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="weekly-calendar.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
