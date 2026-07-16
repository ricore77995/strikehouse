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

export default function SubscriptionTerms() {
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
              {t("subscriptionTerms.title")}
            </h1>
            <p className="text-sm text-muted-foreground font-light whitespace-pre-line">
              {t("subscriptionTerms.entity")}
              {"\n"}
              {t("subscriptionTerms.address")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* 1. Object */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s1.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("subscriptionTerms.s1.p1")}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("subscriptionTerms.s1.p2")}
              </p>
            </div>

            {/* 2. Monthly Plan */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s2.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("subscriptionTerms.s2.p1")}
              </p>
              {(
                [
                  "renewal",
                  "debit",
                  "cancellationRequest",
                  "noticePeriod",
                  "noticeAccess",
                  "noRefund",
                  "noCommitment",
                  "pause",
                ] as const
              ).map((sub) => (
                <ListSection
                  key={sub}
                  items={items(`subscriptionTerms.s2.${sub}.items`)}
                  intro={
                    t(`subscriptionTerms.s2.${sub}.intro`, { defaultValue: "" }) ||
                    undefined
                  }
                  note={
                    t(`subscriptionTerms.s2.${sub}.note`, { defaultValue: "" }) ||
                    undefined
                  }
                />
              ))}
            </div>

            {/* 3. Plan Change */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s3.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("subscriptionTerms.s3.p1")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("subscriptionTerms.s3.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("subscriptionTerms.s3.p2")}
              </p>
            </div>

            {/* 4. Pass Packages */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s4.title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {t("subscriptionTerms.s4.p1")}
              </p>
              {(
                [
                  "prepaid",
                  "changeRequest",
                  "upgrade",
                  "downgrade",
                  "charge",
                ] as const
              ).map((sub) => (
                <ListSection
                  key={sub}
                  title={t(`subscriptionTerms.s4.${sub}.title`)}
                  intro={
                    t(`subscriptionTerms.s4.${sub}.intro`, { defaultValue: "" }) ||
                    undefined
                  }
                  items={items(`subscriptionTerms.s4.${sub}.items`)}
                  note={
                    t(`subscriptionTerms.s4.${sub}.note`, { defaultValue: "" }) ||
                    undefined
                  }
                />
              ))}
            </div>

            {/* 5. Quarterly Plan */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s5.title")}
              </h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("subscriptionTerms.s5.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("subscriptionTerms.s5.p1")}
              </p>
            </div>

            {/* 6. Klarna / External Financing */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s6.title")}
              </h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("subscriptionTerms.s6.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 7. Medical Exception */}
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                {t("subscriptionTerms.s7.title")}
              </h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                {items("subscriptionTerms.s7.items").map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 8-14: Simple paragraph/list sections */}
            {([8, 9, 10, 11, 12, 13, 14] as const).map((n) => (
              <div key={n}>
                <h2 className="text-xl md:text-2xl font-light tracking-[0.08em] mb-4 border-b border-border pb-2">
                  {t(`subscriptionTerms.s${n}.title`)}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                  {t(`subscriptionTerms.s${n}.p1`)}
                </p>
                {items(`subscriptionTerms.s${n}.items`).length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm leading-relaxed mb-3">
                    {items(`subscriptionTerms.s${n}.items`).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`subscriptionTerms.s${n}.p2`)}
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
