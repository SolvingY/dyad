// The human's local time zone. Oura days are local days, and check-ins run on
// local working hours.
export const TZ = "America/Chicago";

/** The local date (YYYY-MM-DD) and hour (0-23) in America/Chicago. */
export function chicagoParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
