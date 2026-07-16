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

export default function Terms() {
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
              {t("terms.title")}
            </h1>
            <p className="text-sm text-muted-foreground font-light whitespace-pre-line">
              {t("terms.entity")}
              {"\n"}
              {t("terms.address")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* 1. Scope and Acceptance */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("terms.s1.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("terms.s1.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed">
                {items("terms.s1.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 2. Access and Facilities */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("terms.s2.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("terms.s2.p1")}
              </p>
              {(
                [
                  "eligibility",
                  "checkIn",
                  "hours",
                  "conduct",
                ] as const
              ).map((sub) => (
                <ListSection
                  key={sub}
                  title={t(`terms.s2.${sub}.title`)}
                  intro={t(`terms.s2.${sub}.intro`, { defaultValue: "" }) || undefined}
                  items={items(`terms.s2.${sub}.items`)}
                  note={t(`terms.s2.${sub}.note`, { defaultValue: "" }) || undefined}
                />
              ))}
            </div>

            {/* 3. Plans and Payments */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("terms.s3.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("terms.s3.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("terms.s3.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("terms.s3.p2")}
              </p>
            </div>

            {/* 4. Cancellations and Refunds */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("terms.s4.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("terms.s4.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("terms.s4.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("terms.s4.p2")}
              </p>
            </div>

            {/* 5-8: Simple paragraph/list sections */}
            {([5, 6, 7, 8] as const).map((n) => (
              <div key={n}>
                <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                  {t(`terms.s${n}.title`)}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                  {t(`terms.s${n}.p1`)}
                </p>
                {items(`terms.s${n}.items`).length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                    {items(`terms.s${n}.items`).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`terms.s${n}.p2`)}
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
