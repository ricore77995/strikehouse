import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DurationSaving } from "./pricingModel";

interface DurationToggleProps {
  durations: number[];
  value: number;
  onChange: (months: number) => void;
  savingFor: (months: number) => DurationSaving | null;
}

/**
 * Replaces the stack of per-duration buttons that used to live inside every card —
 * the single biggest contributor to card height. One choice up here drives all cards.
 */
export default function DurationToggle({
  durations,
  value,
  onChange,
  savingFor,
}: DurationToggleProps) {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      // Radix emits "" when the active item is clicked again; a duration must always
      // be selected, so ignore the deselect.
      onValueChange={(next) => {
        if (next) onChange(Number(next));
      }}
      aria-label={t("pricing.duration.label")}
      className="mb-10 flex-wrap gap-2"
    >
      {durations.map((months) => {
        const saving = savingFor(months);
        return (
          <ToggleGroupItem
            key={months}
            value={String(months)}
            className="group h-auto gap-2 rounded-full border border-border/60 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            <span>
              {months === 1
                ? t("pricing.duration.monthly")
                : t("pricing.duration.count", { count: months })}
            </span>
            {saving && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-accent transition-colors group-data-[state=on]:bg-accent group-data-[state=on]:text-accent-foreground">
                {saving.uniform
                  ? t("pricing.savePercent", { percent: saving.percent })
                  : t("pricing.savePercentUpTo", { percent: saving.percent })}
              </span>
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
