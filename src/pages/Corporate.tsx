import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Users, Shield, Flame, Heart, Building2, Dumbbell } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";
import { WHATSAPP_NUMBER } from "@/constants/contact";

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20eventos%20corporativos.`;

const Corporate = () => {
  const { t } = useTranslation();

  const benefits = [
    { icon: Users, key: "teamwork" },
    { icon: Shield, key: "trust" },
    { icon: Flame, key: "challenge" },
    { icon: Heart, key: "wellness" },
  ];

  const packages = [
    { key: "offsite", icon: Building2 },
    { key: "teamBuilding", icon: Users },
    { key: "wellness", icon: Dumbbell },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center pt-24 bg-charcoal overflow-hidden">
        <OctagonFrame
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[600px] md:h-[600px] opacity-[0.07]"
          strokeWidth={0.3}
        />
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="section-line mx-auto mb-6" />
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-[0.1em] mb-8 leading-tight max-w-4xl mx-auto whitespace-pre-line">
              {t("corporate.heroTitle")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              {t("corporate.heroSubtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Combat Sports */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-line mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] text-center mb-4">
              {t("corporate.whyTitle")}
            </h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
              {t("corporate.whySubtitle")}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center p-8 border border-border"
              >
                <benefit.icon className="w-8 h-8 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-light tracking-[0.1em] mb-3 uppercase">
                  {t(`corporate.benefits.${benefit.key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {t(`corporate.benefits.${benefit.key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Striker's House */}
      <section className="py-16 md:py-24 bg-charcoal">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="section-line mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] text-center">
                {t("corporate.facilityTitle")}
              </h2>
              <p className="text-lg font-light leading-relaxed text-muted-foreground">
                {t("corporate.facilityP1")}
              </p>
              <p className="text-lg font-light leading-relaxed text-muted-foreground">
                {t("corporate.facilityP2")}
              </p>
              <blockquote className="border-l-2 border-accent pl-6 py-2">
                <p className="text-xl font-light tracking-[0.05em] text-foreground">
                  {t("corporate.facilityQuote")}
                </p>
              </blockquote>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="py-20 bg-background relative overflow-hidden">
        <OctagonFrame
          className="absolute -right-32 top-1/4 w-[400px] h-[400px] opacity-5 rotate-12"
          strokeWidth={0.4}
          showInner={false}
        />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-line mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] text-center mb-12">
              {t("corporate.packagesTitle")}
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="p-8 border border-border hover:border-accent/30 transition-colors"
              >
                <pkg.icon className="w-8 h-8 text-accent mb-4" />
                <h3 className="text-lg font-light tracking-[0.1em] mb-3 uppercase">
                  {t(`corporate.packages.${pkg.key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-4">
                  {t(`corporate.packages.${pkg.key}.description`)}
                </p>
                <ul className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="text-xs text-muted-foreground/80 flex items-start gap-2">
                      <span className="text-accent mt-0.5">—</span>
                      {t(`corporate.packages.${pkg.key}.feature${n}`)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-charcoal text-center">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] mb-4">
              {t("corporate.ctaTitle")}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              {t("corporate.ctaDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-accent text-white text-sm uppercase tracking-[0.15em] hover:bg-accent/90 transition-colors rounded-full"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {t("corporate.ctaWhatsApp")}
              </a>
              <a
                href="mailto:info@strikershouse.com?subject=Corporate%20Event%20Inquiry"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 border border-border text-foreground text-sm uppercase tracking-[0.15em] hover:border-accent/50 transition-colors rounded-full"
              >
                {t("corporate.ctaEmail")}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Corporate;
