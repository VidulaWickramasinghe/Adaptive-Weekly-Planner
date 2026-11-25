import type { Block } from "./items";
const escape = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const instant = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
// Fold on UTF-8 byte boundaries without splitting Unicode characters (RFC 5545).
function fold(line: string) {
  let output = "",
    bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += char;
    bytes += size;
  }
  return output;
}
export function exportCalendar(blocks: Block[], now: string) {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Weekly//Personal Planner//EN",
      "CALSCALE:GREGORIAN",
      ...blocks
        .filter((b) => !b.cancelled)
        .flatMap((b) => [
          "BEGIN:VEVENT",
          "UID:" +
            b.id +
            "-" +
            b.occurrence_date +
            "-" +
            (b.ordinal ?? 0) +
            "@weekly.local",
          "DTSTAMP:" + instant(now),
          "DTSTART:" + instant(b.start_at),
          "DTEND:" + instant(b.end_at),
          "SUMMARY:" + escape(b.title),
          "DESCRIPTION:" + escape(b.kind + (b.completed ? " · completed" : "")),
          "END:VEVENT",
        ]),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
