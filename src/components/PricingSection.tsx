import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useYogoPricing, type PriceGroup } from "@/hooks/useYogoPricing";
import DurationToggle from "@/components/pricing/DurationToggle";
import PricingCard from "@/components/pricing/PricingCard";
import TrialInvite from "@/components/pricing/TrialInvite";
import { durationSaving, groupDurations, isFreeItem } from "@/components/pricing/pricingModel";

function GroupTabs({
  groups,
  activeId,
  onSelect,
}: {
  groups: PriceGroup[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="scrollbar-hide mb-10 flex flex-wrap justify-center gap-2 overflow-x-auto pb-2">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelect(group.id)}
          className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            activeId === group.id
              ? "bg-foreground text-background"
              : "border border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}

function gridColumns(count: number): string {
  if (count === 1) return "grid-cols-1 max-w-sm mx-auto";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto";
  if (count === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}

export default function PricingSection() {
  const { data: priceGroups, isLoading, error } = useYogoPricing();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [pickedMonths, setPickedMonths] = useState<number | null>(null);
  const { t } = useTranslation();

  const groups = priceGroups || [];
  const effectiveActiveId = activeGroupId ?? groups[0]?.id ?? 0;
  const activeGroup = groups.find((g) => g.id === effectiveActiveId);

  const items = useMemo(() => activeGroup?.items ?? [], [activeGroup]);
  const trialItems = useMemo(() => items.filter(isFreeItem), [items]);
  const paidItems = useMemo(() => items.filter((item) => !isFreeItem(item)), [items]);
  const durations = useMemo(() => groupDurations(paidItems), [paidItems]);

  // Derived, not synced: switching price group can never leave a stale duration.
  const months =
    pickedMonths && durations.includes(pickedMonths) ? pickedMonths : (durations[0] ?? null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !groups.length) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      {groups.length > 1 && (
        <GroupTabs
          groups={groups}
          activeId={effectiveActiveId}
          onSelect={setActiveGroupId}
        />
      )}

      {trialItems.map((item) => (
        <TrialInvite key={`${item.type}-${item.id}`} item={item} />
      ))}

      {months != null && durations.length > 1 && (
        <DurationToggle
          durations={durations}
          value={months}
          onChange={setPickedMonths}
          savingFor={(value) => durationSaving(paidItems, value)}
        />
      )}

      <AnimatePresence mode="wait">
        {activeGroup && (
          <motion.div
            key={activeGroup.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`grid items-stretch gap-6 ${gridColumns(paidItems.length)}`}
          >
            {paidItems.map((item) => (
              <PricingCard key={`${item.type}-${item.id}`} item={item} months={months} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("pricing.noContracts")}
      </p>
    </motion.div>
  );
}
