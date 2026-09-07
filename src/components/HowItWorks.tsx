import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useYogoClasses } from "@/hooks/useYogoClasses";
import { useYogoPricing } from "@/hooks/useYogoPricing";
import { cleanPlanName } from "@/components/pricing/planContent";
import { isFreeItem, weeklyCap } from "@/components/pricing/pricingModel";

interface Block {
  title: string;
  body: string;
  extra?: string;
}

/**
 * The rules every prospective member asks about. They already existed in full on
 * /termos-subscricao, behind a single footer link — this states them in plain language
 * next to the plans, and links to the legal page rather than restating it loosely.
 */
export default function HowItWorks() {
  const { t } = useTranslation();
  const { data: priceGroups } = useYogoPricing();
  const { data: weekClasses } = useYogoClasses();

  // Weekly caps are the one pass mechanic the price cards only whisper, and only some
  // plans have one — so it is derived, not written down.
  const weeklyCaps = useMemo(() => {
    const items = (priceGroups ?? []).flatMap((group) => group.items).filter((i) => !isFreeItem(i));
    return items
      .map((item) => ({ plan: cleanPlanName(item.name), count: weeklyCap(item) }))
      .filter((entry): entry is { plan: string; count: number } => entry.count !== null);
  }, [priceGroups]);

  const hours = weekClasses?.signoffHours ?? null;

  const blocks: Block[] = [
    {
      title: t("howItWorks.passesTitle"),
      body: t("howItWorks.passesBody"),
      extra: weeklyCaps
        .map((entry) => t("howItWorks.passesWeeklyCap", { plan: entry.plan, count: entry.count }))
        .join(" "),
    },
    {
      title: t("howItWorks.bookingTitle"),
      // Derived from the class data, so it follows the studio's YOGO setting.
      body: hours
        ? t("howItWorks.bookingBody", { hours })
        : t("howItWorks.bookingBodyNoHours"),
    },
    {
      title: t("howItWorks.firstClassTitle"),
      body: t("howItWorks.firstClassBody"),
    },
    {
      title: t("howItWorks.pauseTitle"),
      body: t("howItWorks.pauseBody"),
    },
    {
      title: t("howItWorks.uscTitle"),
      body: t("howItWorks.uscBody"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.1 }}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((block) => (
          <div
            key={block.title}
            className="rounded-[2rem] border border-border/60 bg-card p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]"
          >
            <div className="mb-4 h-px w-8 bg-accent" />
            <h3 className="mb-3 text-lg font-medium tracking-wide text-foreground">
              {block.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{block.body}</p>
            {block.extra && (
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">{block.extra}</p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm">
        <Link
          to="/termos-subscricao"
          className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-accent"
        >
          {t("howItWorks.termsLink")}
        </Link>
      </p>
    </motion.div>
  );
}
