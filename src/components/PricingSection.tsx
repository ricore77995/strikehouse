import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Repeat, Zap, Loader2 } from "lucide-react";
import { useYogoPricing, type PricingItem, type PriceGroup } from "@/hooks/useYogoPricing";

const yogoEnabled = import.meta.env.VITE_YOGO_ENABLED === "true";

function PricingCard({ item }: { item: PricingItem }) {
  const { t } = useTranslation();
  const hasMultipleOptions = item.paymentOptions.length > 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col overflow-hidden"
    >
      {/* Image */}
      {item.imageUrl && (
        <div className="w-full h-44 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Name */}
        <h3 className="text-lg font-semibold text-black mb-2">
          {item.name}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-gray-500 mb-4">{item.description}</p>
        )}

        {/* Single price (simple plans) */}
        {!hasMultipleOptions && (
          <div className="mb-6">
            <span className="text-4xl font-bold text-red-600">
              {item.paymentOptions[0].price}€
            </span>
            {item.type === "membership" && item.paymentOptions[0].name && (
              <span className="text-sm text-gray-500 ml-1">
                /{item.paymentOptions[0].name.toLowerCase()}
              </span>
            )}
            {item.type === "class_pass" && (
              <span className="text-sm text-gray-500 ml-1">
                /{item.numberOfClasses} {t("pricing.classes")}
              </span>
            )}
          </div>
        )}

        {/* Features */}
        <div className="space-y-3 mb-6 flex-1">
          {item.type === "membership" && (
            <>
              {item.isUnlimited ? (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Zap className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{t("pricing.unlimited")}</span>
                </div>
              ) : (
                <>
                  {item.classesPerWeek && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Repeat className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>
                        {item.classesPerWeek}x/{t("pricing.week")}
                      </span>
                    </div>
                  )}
                  {item.classesPerMonth && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>
                        {item.classesPerMonth} {t("pricing.sessionsMonth")}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {item.type === "class_pass" && item.validDays && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>
                {t("pricing.validFor")} {item.validDays} {t("pricing.days")}
              </span>
            </div>
          )}
        </div>

        {/* Registration fee */}
        {item.registrationFee > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            + {t("pricing.registrationFee")}: {item.registrationFee}€
          </p>
        )}
      </div>

      {/* CTA — single option */}
      {!hasMultipleOptions && (
        <div className="px-6 pb-6">
          {yogoEnabled ? (
            <a
              href={item.paymentOptions[0].purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-yogo-parsed="true"
              className="block w-full text-center py-3 bg-black text-white rounded-full text-sm font-medium uppercase tracking-wider hover:bg-gray-800 transition-colors"
            >
              {t("pricing.buy")}
            </a>
          ) : (
            <span className="block w-full text-center py-3 bg-gray-300 text-gray-500 rounded-full text-sm font-medium uppercase tracking-wider cursor-not-allowed">
              {t("pricing.comingSoon")}
            </span>
          )}
        </div>
      )}

      {/* CTA — multiple options */}
      {hasMultipleOptions && (
        <div className="px-6 pb-6 space-y-2">
          {item.paymentOptions.map((opt) => (
            yogoEnabled ? (
              <a
                key={opt.id}
                href={opt.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-yogo-parsed="true"
                className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm hover:border-red-600 hover:bg-red-50 transition-colors group"
              >
                <span className="text-gray-700 group-hover:text-black">{opt.name}</span>
                <span className="font-semibold text-red-600">{opt.price}€</span>
              </a>
            ) : (
              <div
                key={opt.id}
                className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm cursor-not-allowed opacity-60"
              >
                <span className="text-gray-500">{opt.name}</span>
                <span className="font-semibold text-gray-400">{opt.price}€</span>
              </div>
            )
          ))}
        </div>
      )}
    </motion.div>
  );
}

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
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-10 justify-center flex-wrap">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelect(group.id)}
          className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeId === group.id
              ? "bg-red-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}

export default function PricingSection() {
  const { data: priceGroups, isLoading, error } = useYogoPricing();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const { t } = useTranslation();

  // Set default active group once data loads
  const groups = priceGroups || [];
  const effectiveActiveId = activeGroupId ?? groups[0]?.id ?? 0;
  const activeGroup = groups.find((g) => g.id === effectiveActiveId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (error || !groups.length) {
    return null; // Silently hide if API fails
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      {/* Tabs */}
      <GroupTabs
        groups={groups}
        activeId={effectiveActiveId}
        onSelect={setActiveGroupId}
      />

      {/* Cards */}
      <AnimatePresence mode="wait">
        {activeGroup && (
          <motion.div
            key={activeGroup.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`grid gap-6 ${
              activeGroup.items.length === 1
                ? "grid-cols-1 max-w-sm mx-auto"
                : activeGroup.items.length === 2
                  ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {activeGroup.items.map((item) => (
              <PricingCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sem contratos note */}
      <p className="text-center text-sm text-gray-500 mt-8">
        {t("pricing.noContracts")}
      </p>
    </motion.div>
  );
}
