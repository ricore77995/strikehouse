import { useTranslation } from "react-i18next";
import type { PricingItem } from "@/hooks/useYogoPricing";
import { cleanPlanName, derivePlanContent } from "./planContent";

/**
 * The free trial as an entry invitation above the paid plans, rather than a fifth
 * card that orphans itself onto a second grid row. Links straight to the Yogo
 * purchase URL from the data, so there is no hardcoded item id to drift.
 */
export default function TrialInvite({ item }: { item: PricingItem }) {
  const { t } = useTranslation();
  const option = item.paymentOptions[0];
  if (!option) return null;

  const content = derivePlanContent(item.description, { maxBullets: 1 });
  const meta = [
    cleanPlanName(item.name),
    item.numberOfClasses ? t("pricing.classesCount", { count: item.numberOfClasses }) : null,
    item.validDays ? t("pricing.validDaysLabel", { count: item.validDays }) : null,
    t("pricing.noCommitment"),
  ].filter(Boolean) as string[];

  return (
    <a
      href={option.purchaseUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-yogo-parsed="true"
      className="group mb-8 flex flex-col items-start gap-5 rounded-[2rem] border-2 border-dashed border-accent/70 bg-card px-6 py-5 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between sm:px-8"
    >
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <span className="rounded-full bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-background">
            {t("pricing.free")}
          </span>
          <span className="text-lg font-medium tracking-wide text-foreground">
            {t("pricing.trialTitle")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {content.subtitle ?? meta.join(" · ")}
        </p>
        {content.subtitle && (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {meta.join(" · ")}
          </p>
        )}
      </div>

      <span className="flex shrink-0 items-center gap-3 rounded-full bg-accent px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] text-accent-foreground transition-opacity group-hover:opacity-90">
        {t("pricing.trialCta")}
        <span aria-hidden>→</span>
      </span>
    </a>
  );
}
