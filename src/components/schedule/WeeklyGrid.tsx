import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useYogoClasses, type ScheduledClass } from "@/hooks/useYogoClasses";
import { useYogoTrialPlans } from "@/hooks/useYogoPricing";
import { buildWeekGrid, seatsLeft, type GridCell } from "./weekGrid";

function ClassChip({
  cell,
  showTrialDot,
  trialMark,
}: {
  cell: GridCell;
  showTrialDot: boolean;
  trialMark: string;
}) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/10 px-2 py-2 text-center">
      {cell.classes.map((item) => (
        <span key={item.id} className="block text-xs leading-tight text-foreground">
          {item.name}
        </span>
      ))}
      {showTrialDot && cell.hasTrial && (
        <span
          className="mx-auto mt-1 block h-1 w-1 rounded-full bg-accent"
          title={trialMark}
          aria-label={trialMark}
        />
      )}
    </div>
  );
}

export default function WeeklyGrid() {
  const { data, isLoading, error } = useYogoClasses();
  const { data: trialPlans } = useYogoTrialPlans();
  const { t, i18n } = useTranslation();

  const grid = useMemo(
    () => buildWeekGrid(data?.classes ?? [], data?.trialSlots ?? new Set(), i18n.language),
    [data, i18n.language]
  );

  const trialUrl = trialPlans?.find((plan) => plan.paymentOptions[0]?.purchaseUrl)
    ?.paymentOptions[0]?.purchaseUrl;

  const room = data?.classes[0]?.room ?? null;
  // A dot on every cell marks nothing; when the trial covers the whole week, say it once.
  const showTrialDot = grid.trialCoverage === "some";
  const hasTrial = grid.trialCoverage !== "none";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // The full YOGO widget renders below, so a failure here degrades rather than breaks.
  if (error || grid.isEmpty) return null;

  const dayList = grid.days
    .map((day) => ({
      day,
      rows: grid.times
        .map((time) => ({ time, cell: grid.cellAt(day.date, time) }))
        .filter((row): row is { time: string; cell: GridCell } => row.cell !== null),
    }))
    .filter((entry) => entry.rows.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.1 }}
    >
      {/* The dashed accent frame is the page's established "free" language (see
          TrialInvite in the pricing section). Wrapping the calendar in it states the
          scope a loose caption cannot: everything inside this box can be tried. */}
      <div
        className={`overflow-hidden rounded-[2rem] ${
          hasTrial ? "border-2 border-dashed border-accent/70" : "border border-border/60"
        }`}
      >
        {hasTrial && (
          <div className="flex flex-col items-start gap-5 border-b border-dashed border-accent/40 bg-accent/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground">
                  {t("pricing.free")}
                </span>
                <span className="text-base font-medium tracking-wide text-foreground sm:text-lg">
                  {showTrialDot ? t("schedule.trialSomeTitle") : t("schedule.trialAllTitle")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{t("schedule.trialSubtitle")}</p>
            </div>
            {trialUrl && (
              <a
                href={trialUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-yogo-parsed="true"
                className="flex shrink-0 items-center gap-3 rounded-full bg-accent px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] text-accent-foreground transition-opacity hover:opacity-90"
              >
                {t("schedule.trialCta")}
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
        )}

        <div className="p-4 md:p-6">
          {/* Grid at md and up; the 7-column layout cannot fit a phone. */}
          <div className="hidden md:block">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-16" />
                  {grid.days.map((day) => (
                    <th key={day.date} className="pb-2 text-center">
                      <span
                        className={`block font-mono text-[10px] uppercase tracking-[0.22em] ${
                          day.isToday ? "text-accent" : "text-muted-foreground"
                        }`}
                      >
                        {day.label}
                      </span>
                      <span className="block text-sm text-foreground/70">{day.dayOfMonth}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.times.map((time) => (
                  <tr key={time}>
                    <th className="pr-3 text-right align-middle font-mono text-xs font-normal tabular-nums text-muted-foreground">
                      {time}
                    </th>
                    {grid.days.map((day) => {
                      const cell = grid.cellAt(day.date, time);
                      return (
                        <td key={day.date} className="align-middle">
                          {cell && (
                            <ClassChip
                              cell={cell}
                              showTrialDot={showTrialDot}
                              trialMark={t("schedule.trialMark")}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Same information stacked by day on phones — the site never scrolls sideways. */}
          <div className="space-y-6 md:hidden">
            {dayList.map(({ day, rows }) => (
              <div key={day.date}>
                <p
                  className={`mb-2 font-mono text-[10px] uppercase tracking-[0.22em] ${
                    day.isToday ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {day.label} {day.dayOfMonth}
                  {day.isToday && ` · ${t("schedule.today")}`}
                </p>
                <ul className="space-y-1">
                  {rows.map(({ time, cell }) => (
                    <li
                      key={time}
                      className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
                    >
                      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {time}
                      </span>
                      <span className="flex-1 text-sm text-foreground">
                        {cell.classes.map((item: ScheduledClass) => item.name).join(" · ")}
                      </span>
                      {showTrialDot && cell.hasTrial && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      )}
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("schedule.seatsLeft", { count: seatsLeft(cell.classes[0]) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Footer carries only the venue note now — the trial message moved to the header
          so it lands before the calendar rather than after it. */}
      {(room || showTrialDot) && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {showTrialDot && (
            <>
              <span className="mr-2 inline-block h-1 w-1 translate-y-[-2px] rounded-full bg-accent" />
              {t("schedule.trialMark")}
              {room && " · "}
            </>
          )}
          {room && t("schedule.allIn", { room })}
        </p>
      )}
    </motion.div>
  );
}
