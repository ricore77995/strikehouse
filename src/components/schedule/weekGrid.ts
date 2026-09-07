import { slotKey, type ScheduledClass } from "@/hooks/useYogoClasses";

export interface GridDay {
  date: string;
  /** Localised short weekday, e.g. "seg" / "Mon". */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
}

export interface GridCell {
  classes: ScheduledClass[];
  hasTrial: boolean;
}

/**
 * Whether the free trial marker actually distinguishes anything. Today every slot runs a
 * trial shadow, so a per-cell dot would sit on all 24 cells and say nothing — "all" lets
 * the UI state it once instead.
 */
export type TrialCoverage = "all" | "some" | "none";

export interface WeekGrid {
  days: GridDay[];
  /** Distinct start times, ascending — one grid row each. */
  times: string[];
  cellAt: (date: string, time: string) => GridCell | null;
  trialCoverage: TrialCoverage;
  isEmpty: boolean;
}

export function seatsLeft(item: ScheduledClass): number {
  return Math.max(0, item.seats - item.seatsTaken);
}

function dayLabel(date: string, locale: string): string {
  // Parse as UTC noon so a timezone offset can never shift the weekday.
  const parsed = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    .format(parsed)
    .replace(/\.$/, "");
}

/**
 * Lays the week out as times × days. Days come from the classes themselves rather than
 * from a fixed Mon-Sun frame, so the grid starts on today and never shows a stale column.
 */
export function buildWeekGrid(
  classes: ScheduledClass[],
  trialSlots: Set<string>,
  locale = "pt",
  today = new Date().toISOString().split("T")[0]
): WeekGrid {
  const cells = new Map<string, GridCell>();
  const dates = new Set<string>();
  const times = new Set<string>();

  for (const item of classes) {
    dates.add(item.date);
    times.add(item.startTime);

    const key = slotKey(item.date, item.startTime);
    const cell = cells.get(key);
    if (cell) {
      cell.classes.push(item);
    } else {
      cells.set(key, { classes: [item], hasTrial: trialSlots.has(key) });
    }
  }

  const days: GridDay[] = [...dates].sort().map((date) => ({
    date,
    label: dayLabel(date, locale),
    dayOfMonth: Number(date.slice(8, 10)),
    isToday: date === today,
  }));

  const withTrial = [...cells.values()].filter((cell) => cell.hasTrial).length;
  const trialCoverage: TrialCoverage =
    withTrial === 0 ? "none" : withTrial === cells.size ? "all" : "some";

  return {
    days,
    times: [...times].sort(),
    cellAt: (date, time) => cells.get(slotKey(date, time)) ?? null,
    trialCoverage,
    isEmpty: classes.length === 0,
  };
}
