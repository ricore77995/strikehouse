import { useQuery } from "@tanstack/react-query";

// --- Types matching YOGO API responses ---

interface YogoClassType {
  id: number;
  name: string;
}

interface YogoTeacher {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

interface YogoRoom {
  id: number;
  name: string;
}

interface YogoClass {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  seats: number;
  signup_count?: number;
  cancelled: boolean;
  archived: number;
  class_type?: YogoClassType | null;
  teachers?: YogoTeacher[];
  room?: YogoRoom | null;
  class_signoff_deadline_timestamp?: number | null;
}

/** GET /classes wraps its payload; the array lives under `classes`. */
interface YogoClassesResponse {
  responseType: string;
  classes: YogoClass[];
}

// --- Processed types for the UI ---

export interface ScheduledClass {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  classTypeId: number | null;
  teacher: string | null;
  room: string | null;
  seats: number;
  seatsTaken: number;
}

export interface WeekClasses {
  classes: ScheduledClass[];
  /** `date|start_time` keys that also run a free trial class, for the sales marker. */
  trialSlots: Set<string>;
  /** How long before a class starts a booking can still be cancelled. */
  signoffHours: number | null;
}

const GYM_TIME_ZONE = "Europe/Lisbon";

/**
 * Hours between a class starting and its cancellation deadline. Both sides are read as
 * gym wall-clock time, so the answer does not shift with the visitor's own time zone.
 */
export function signoffHours(startTime: string, deadlineTs: number | null | undefined): number | null {
  if (!deadlineTs) return null;
  const deadline = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(deadlineTs));

  const [deadlineH, deadlineM] = deadline.split(":").map(Number);
  const [startH, startM] = startTime.split(":").map(Number);
  const minutes = startH * 60 + startM - (deadlineH * 60 + deadlineM);
  // A negative result means the deadline fell on the previous day; ignore those rather
  // than reporting a nonsensical offset.
  return minutes > 0 ? minutes / 60 : null;
}

/** The offset the gym actually uses, taken as the most common across the week. */
export function commonSignoffHours(values: (number | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const API_BASE = "/api/yogo";

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Yogo recreates class types, so match the trial by name and treat the id as a hint. */
const TRIAL_CLASS_TYPE_ID = 21792;

export function isTrialClass(name: string, classTypeId: number | null): boolean {
  return /experimental|trial/i.test(name) || classTypeId === TRIAL_CLASS_TYPE_ID;
}

export function slotKey(date: string, startTime: string): string {
  return `${date}|${startTime}`;
}

function teacherName(teachers: YogoTeacher[] | undefined): string | null {
  const first = teachers?.[0];
  if (!first) return null;
  const name = `${first.first_name ?? ""} ${first.last_name ?? ""}`.trim();
  return name || null;
}

function toScheduledClass(raw: YogoClass): ScheduledClass {
  return {
    id: raw.id,
    date: raw.date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    name: raw.class_type?.name ?? "",
    classTypeId: raw.class_type?.id ?? null,
    teacher: teacherName(raw.teachers),
    room: raw.room?.name ?? null,
    seats: raw.seats ?? 0,
    seatsTaken: raw.signup_count ?? 0,
  };
}

async function fetchWeekClasses(): Promise<WeekClasses> {
  const today = new Date();
  const end = new Date(today);
  // Six days ahead, not seven: a seven-day offset spans eight dates and repeats a weekday.
  end.setDate(end.getDate() + 6);

  const params = new URLSearchParams({
    startDate: toIsoDate(today),
    endDate: toIsoDate(end),
  });
  for (const populate of [
    "class_type",
    "teachers",
    "room",
    "signup_count",
    "class_signoff_deadline_timestamp",
  ]) {
    params.append("populate[]", populate);
  }
  for (const sort of ["date ASC", "start_time ASC"]) {
    params.append("sort[]", sort);
  }

  const res = await fetch(`${API_BASE}/classes?${params}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`YOGO classes: ${res.status}`);

  const payload: YogoClassesResponse = await res.json();
  const live = (payload.classes || []).filter((c) => !c.cancelled && !c.archived);

  const classes: ScheduledClass[] = [];
  const trialSlots = new Set<string>();
  const signoffs: (number | null)[] = [];

  for (const raw of live) {
    const item = toScheduledClass(raw);
    signoffs.push(signoffHours(raw.start_time, raw.class_signoff_deadline_timestamp));
    // Every real slot carries a 4-seat trial shadow. Collapsing those into a marker is
    // what halves the calendar — and it doubles as the free-trial sales hook.
    if (isTrialClass(item.name, item.classTypeId)) {
      trialSlots.add(slotKey(item.date, item.startTime));
    } else {
      classes.push(item);
    }
  }

  return { classes, trialSlots, signoffHours: commonSignoffHours(signoffs) };
}

export function useYogoClasses() {
  return useQuery<WeekClasses>({
    queryKey: ["yogo-classes"],
    queryFn: fetchWeekClasses,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
