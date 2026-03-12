import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Gift, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/constants/contact";

export default function TryNowSection() {
  const { t } = useTranslation();

  const whatsappMessage = encodeURIComponent(t("tryNow.whatsappMessage"));
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`;

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

        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5" />
                  {t("tryNow.free")}
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("tryNow.cardTitle")}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {t("tryNow.cardDescription")}
              </p>
              <div className="space-y-2 mb-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: t(`tryNow.features.${n}`) }} className="[&_a]:text-red-600 [&_a]:underline [&_a]:hover:text-red-700" />
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
        </div>
      </div>
    </section>
  );
}
