import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/** Renders a titled list section (h3 + optional intro + ul + optional note). */
function ListSection({
  title,
  intro,
  items,
  note,
}: {
  title?: string;
  intro?: string;
  items: string[];
  note?: string;
}) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="text-lg font-medium tracking-wide mb-2">{title}</h3>
      )}
      {intro && (
        <p className="text-muted-foreground text-sm leading-relaxed mb-3">
          {intro}
        </p>
      )}
      <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {note && (
        <p className="text-muted-foreground/70 text-xs mt-2 italic">{note}</p>
      )}
    </div>
  );
}

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  // Helper to safely get arrays from i18n
  const items = (key: string): string[] => {
    const val = t(key, { returnObjects: true });
    return Array.isArray(val) ? val : [];
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-charcoal">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-line mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">
              {t("privacy.title")}
            </h1>
            <p className="text-sm text-muted-foreground font-light whitespace-pre-line">
              {t("privacy.entity")}
              {"\n"}
              {t("privacy.address")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-4">
              {t("privacy.lastUpdated")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* 1. Who We Are */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s1.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("privacy.s1.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("privacy.s1.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("privacy.s1.p2")}
              </p>
            </div>

            {/* 2. What Data We Collect */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s2.title")}
              </h2>
              {(
                [
                  "identification",
                  "contact",
                  "tax",
                  "payment",
                  "health",
                  "usage",
                ] as const
              ).map((sub) => (
                <ListSection
                  key={sub}
                  title={t(`privacy.s2.${sub}.title`)}
                  items={items(`privacy.s2.${sub}.items`)}
                  note={t(`privacy.s2.${sub}.note`, { defaultValue: "" }) || undefined}
                />
              ))}
            </div>

            {/* 3-4: Simple intro + list + closing paragraph */}
            {([3, 4] as const).map((n) => (
              <div key={n}>
                <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                  {t(`privacy.s${n}.title`)}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                  {t(`privacy.s${n}.p1`)}
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                  {items(`privacy.s${n}.items`).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`privacy.s${n}.p2`)}
                </p>
              </div>
            ))}

            {/* 5. Data Retention — list only */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s5.title")}
              </h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed">
                {items("privacy.s5.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 6. Data Sharing */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s6.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("privacy.s6.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("privacy.s6.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                {t("privacy.s6.p2")}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                {t("privacy.s6.p3")}
              </p>
            </div>

            {/* 7. Security */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s7.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("privacy.s7.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed">
                {items("privacy.s7.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 8. Data Subject Rights */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("privacy.s8.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("privacy.s8.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-4">
                {items("privacy.s8.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                {t("privacy.s8.contact")}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("privacy.s8.p2")}
              </p>
            </div>

            {/* 9-11: Simple paragraph sections */}
            {([9, 10, 11] as const).map((n) => (
              <div key={n}>
                <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                  {t(`privacy.s${n}.title`)}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`privacy.s${n}.p1`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
