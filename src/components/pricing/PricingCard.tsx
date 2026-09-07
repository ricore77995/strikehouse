import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { TFunction } from "i18next";
import type { PricingItem } from "@/hooks/useYogoPricing";
import { cleanPlanName, derivePlanContent, isMostPopular } from "./planContent";
import {
  monthlyEquivalent,
  perClassPrice,
  planQuota,
  resolveOption,
  weeklyCap,
  type PlanQuota,
} from "./pricingModel";

const MAX_BULLETS = 4;
/** The card states the registration fee itself; the copy would repeat it. */
const REGISTRATION_CLAIM = /inscri[çc][ãa]o|registration/i;

function quotaLabel(quota: PlanQuota, t: TFunction): string {
  switch (quota.kind) {
    case "passes":
      return t("pricing.passesLabel", { count: quota.count });
    case "perMonth":
      return t("pricing.classesPerMonthLabel", { count: quota.count });
    case "perWeek":
      return t("pricing.classesPerWeekLabel", { count: quota.count });
    case "unlimited":
      return t("pricing.unlimitedShort");
    case "classPack":
      return t("pricing.classPack");
    default:
      return t("pricing.plan");
  }
}

function formatEuros(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export default function PricingCard({
  item,
  months,
}: {
  item: PricingItem;
  months: number | null;
}) {
  const { t } = useTranslation();
  const option = resolveOption(item, months);
  // strictNullChecks is off in this project, so this guard is load-bearing.
  if (!option) return null;

  const popular = isMostPopular(item);
  const content = derivePlanContent(item.description);
  const price = monthlyEquivalent(option);
  const perClass = perClassPrice(item, option);

  const weekly = weeklyCap(item);
  const bullets = [
    weekly ? t("pricing.maxPerWeek", { count: weekly }) : null,
    ...content.bullets.filter((line) => !REGISTRATION_CLAIM.test(line)),
    perClass ? t("pricing.perClass", { price: formatEuros(perClass) }) : null,
    item.registrationFee > 0
      ? t("pricing.registrationFeeValue", { price: item.registrationFee })
      : t("pricing.registrationFree"),
    item.validDays ? t("pricing.validDaysLabel", { count: item.validDays }) : null,
  ]
    .filter(Boolean)
    .slice(0, MAX_BULLETS) as string[];

  const periodLabel =
    item.type === "class_pass" && item.numberOfClasses
      ? `/ ${t("pricing.classesCount", { count: item.numberOfClasses })}`
      : t("pricing.perMonth");

  // A plan that does not sell the selected duration falls back to a shorter one; say
  // so rather than hiding the plan or showing a price for a period it cannot deliver.
  const fallback = months != null && option.months != null && option.months !== months;
  const billingNote = fallback
    ? option.months === 1
      ? t("pricing.onlyMonthly")
      : t("pricing.onlyForMonths", { count: option.months })
    : option.months && option.months > 1
      ? t("pricing.billedUpfront", { total: option.price, count: option.months })
      : option.months === 1
        ? t("pricing.billedMonthly")
        : "";

  return (
    <div
      className={`relative flex h-full flex-col rounded-[2rem] border p-7 transition-all duration-500 ${
        popular
          ? "z-10 border-accent/70 bg-gradient-to-br from-accent/15 via-card to-card shadow-[0_30px_80px_-30px_hsl(var(--accent))]"
          : "border-border/60 bg-card shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] hover:border-foreground/30"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-8 rounded-full bg-accent px-4 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground shadow-[0_8px_24px_-8px_hsl(var(--accent))]">
          {t("pricing.mostPopular")}
        </span>
      )}

      <h3 className="line-clamp-2 text-2xl font-semibold uppercase leading-tight tracking-wider text-foreground">
        {cleanPlanName(item.name)}
      </h3>

      {/* The class quota is what separates one plan from the next, so it carries weight
          instead of sitting in a muted 10px eyebrow nobody reads. */}
      <p className="mt-3">
        <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          {quotaLabel(planQuota(item), t)}
        </span>
      </p>

      {/* Fixed slot: keeps the price rows aligned even when a plan has no subtitle. */}
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-muted-foreground">
        {content.subtitle ?? ""}
      </p>

      <div className="mt-5">
        <motion.div
          key={option.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-baseline gap-2"
        >
          {price === 0 ? (
            <span className="text-4xl font-semibold tracking-tight text-foreground">
              {t("pricing.free")}
            </span>
          ) : (
            <>
              <span className="font-mono text-sm text-muted-foreground">€</span>
              <span className="text-5xl font-semibold tracking-tight text-foreground">
                {price}
              </span>
              <span className="font-mono text-sm text-muted-foreground">{periodLabel}</span>
            </>
          )}
        </motion.div>
        <p
          className={`mt-2 min-h-[1.1rem] text-xs ${
            fallback ? "text-accent" : "text-muted-foreground/80"
          }`}
        >
          {billingNote}
        </p>
      </div>

      {bullets.length > 0 && (
        <ul className="mt-6 space-y-3 border-t border-border/60 pt-6">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-sm">
              <span className="mt-[0.6em] h-px w-4 shrink-0 bg-accent" />
              <span className="text-foreground/90">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-7">
        <a
          href={option.purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-yogo-parsed="true"
          className={`flex items-center justify-between gap-4 rounded-full px-6 py-4 font-mono text-xs uppercase tracking-[0.22em] transition-all ${
            popular
              ? "bg-accent text-accent-foreground shadow-[0_12px_28px_-10px_hsl(var(--accent))] hover:opacity-90"
              : "border border-border/60 text-foreground hover:border-accent hover:text-accent"
          }`}
        >
          <span>{t("pricing.buy")}</span>
          <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
