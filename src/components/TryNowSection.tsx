import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, MessageCircle } from "lucide-react";
import { useYogoTrialPlans, type PricingItem } from "@/hooks/useYogoPricing";
import glovesImg from "@/assets/gloves-detail.jpg";
import trainingImg from "@/assets/training-calm.jpg";
import mmaImg from "@/assets/mma.jpg";

const WHATSAPP_NUMBER = "351913378459";

// --- WhatsApp fallback (when no 0€ plans exist in YOGO) ---

const fallbackModalities = [
  { key: "boxing", image: glovesImg },
  { key: "muayThai", image: trainingImg },
  { key: "mma", image: mmaImg },
];

function WhatsAppFallback() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(fallbackModalities[0].key);
  const current = fallbackModalities.find((m) => m.key === selected)!;

  const name = t(`tryNow.modalities.${current.key}.name`);
  const description = t(`tryNow.modalities.${current.key}.description`);
  const whatsappMessage = encodeURIComponent(
    t("tryNow.whatsappMessage", { modality: name })
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`;

  return (
    <>
      <div className="flex gap-3 justify-center flex-wrap mb-10">
        {fallbackModalities.map((mod) => (
          <button
            key={mod.key}
            onClick={() => setSelected(mod.key)}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              selected === mod.key
                ? "bg-red-600 text-white shadow-lg shadow-red-600/25"
                : "bg-white/10 border border-foreground/20 text-foreground hover:border-foreground/40"
            }`}
          >
            {t(`tryNow.modalities.${mod.key}.name`)}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="relative h-52 overflow-hidden">
              <img src={current.image} alt={name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Gift className="w-3.5 h-3.5" />
                {t("tryNow.free")}
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-2">{name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{description}</p>
              <div className="space-y-2 mb-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                    {t(`tryNow.features.${n}`)}
                  </div>
                ))}
              </div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-red-600">0€</span>
                <span className="text-sm text-muted-foreground">{t("tryNow.firstClass")}</span>
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] text-white rounded-full text-sm font-medium uppercase tracking-wider hover:bg-[#1fb855] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {t("tryNow.cta")}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

// --- YOGO trial plans (self-service booking) ---

function YogoTrialCards({ plans }: { plans: PricingItem[] }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(plans[0].id);
  const current = plans.find((p) => p.id === selectedId) || plans[0];

  return (
    <>
      {/* Radio pills */}
      {plans.length > 1 && (
        <div className="flex gap-3 justify-center flex-wrap mb-10">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedId(plan.id)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                selectedId === plan.id
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/25"
                  : "bg-white/10 border border-foreground/20 text-foreground hover:border-foreground/40"
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>
      )}

      {/* Card */}
      <div className="max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl"
          >
            {/* Image */}
            {current.imageUrl && (
              <div className="relative h-52 overflow-hidden">
                <img
                  src={current.imageUrl}
                  alt={current.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              </div>
            )}

            <div className="p-6">
              {/* Free badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5" />
                  {t("tryNow.free")}
                </span>
              </div>

              <h3 className="text-xl font-semibold mb-2">{current.name}</h3>

              {current.description && (
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {current.description}
                </p>
              )}

              {/* Features */}
              <div className="space-y-2 mb-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                    {t(`tryNow.features.${n}`)}
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-red-600">0€</span>
                <span className="text-sm text-muted-foreground">{t("tryNow.firstClass")}</span>
              </div>

              {/* YOGO booking CTA */}
              <a
                href={current.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-yogo-parsed="true"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-600 text-white rounded-full text-sm font-medium uppercase tracking-wider hover:bg-red-700 transition-colors"
              >
                {t("tryNow.ctaYogo")}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

// --- Main section ---

export default function TryNowSection() {
  const { t } = useTranslation();
  const { data: trialPlans, isLoading } = useYogoTrialPlans();

  const hasYogoTrials = !isLoading && trialPlans && trialPlans.length > 0;

  return (
    <section id="try-now" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="section-line mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">
            {t("tryNow.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("tryNow.subtitle")}
          </p>
        </motion.div>

        {hasYogoTrials ? (
          <YogoTrialCards plans={trialPlans} />
        ) : (
          <WhatsAppFallback />
        )}
      </div>
    </section>
  );
}
