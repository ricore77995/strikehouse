import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import whyDifferentImage from "@/assets/why-different.png";
import OctagonFrame from "./OctagonFrame";

const WhyDifferent = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute -left-24 top-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-10 rotate-12" 
        strokeWidth={0.4}
        showInner={false}
      />
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-red/10 blur-2xl rounded-full" />
              <img
                src={whyDifferentImage}
                alt="Striker's House coach"
                className="relative w-full max-w-md mx-auto lg:max-w-none grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="order-1 lg:order-2"
          >
            <span className="text-red uppercase tracking-[0.2em] text-sm font-medium">
              {t('whyDifferent.subtitle')}
            </span>
            
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-foreground mt-4 mb-8 leading-tight">
              {t('whyDifferent.title')}
            </h2>

            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
              <p>
                {t('whyDifferent.description1')}<br />
                {t('whyDifferent.description1a')}<br />
                {t('whyDifferent.description1b')}
              </p>

              <p className="text-foreground font-medium text-xl">
                {t('whyDifferent.highlight')}
              </p>

              <p>
                {t('whyDifferent.description2')}<br />
                {t('whyDifferent.description2a')}
              </p>

              <p className="text-foreground/80 italic">
                {t('whyDifferent.closing')}
              </p>
            </div>

            <div className="mt-10 w-16 h-px bg-red" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhyDifferent;
