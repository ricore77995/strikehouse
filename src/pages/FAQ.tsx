import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";

const FAQ = () => {
  const { t } = useTranslation();

  const faqCategories = ["classes", "modalities", "enrollment", "facilities"];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-charcoal relative overflow-hidden">
        <OctagonFrame
          className="absolute -right-32 top-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-5 rotate-12"
          strokeWidth={0.4}
          showInner={false}
        />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="section-line mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-[0.1em] mb-4">
              {t("membership.page.faqTitle")}
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("membership.page.faqDescription")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            {faqCategories.map((cat, catIndex) => (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: catIndex * 0.1 }}
                className="mb-10"
              >
                <h2 className="text-xl font-medium text-accent mb-6 tracking-wider">
                  {t(`membership.page.faq.${cat}.title`)}
                </h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {[1, 2, 3, 4].map((i) => {
                    const question = t(`membership.page.faq.${cat}.q${i}`, {
                      defaultValue: "",
                    });
                    const answer = t(`membership.page.faq.${cat}.a${i}`, {
                      defaultValue: "",
                    });
                    if (!question) return null;
                    return (
                      <AccordionItem
                        key={i}
                        value={`${cat}-${i}`}
                        className="border border-border bg-card px-5 rounded-lg"
                      >
                        <AccordionTrigger className="text-left hover:no-underline hover:text-accent py-4">
                          {question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                          {answer}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
