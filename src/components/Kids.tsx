import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import kidsImage from "@/assets/kids-training.png";

const Kids = () => {
  const { t } = useTranslation();

  return (
    <section className="py-24 md:py-32 bg-charcoal">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <span className="text-red uppercase tracking-[0.2em] text-sm font-medium">
              {t('kids.subtitle')}
            </span>
            
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-foreground mt-4 mb-8 leading-tight">
              {t('kids.title1')}<br />
              {t('kids.title2')}
            </h2>

            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
              <p>{t('kids.description1')}</p>
              <p>{t('kids.description2')}</p>
            </div>

            <div className="mt-10 w-16 h-px bg-red" />
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-red/10 blur-2xl rounded-full" />
              <img
                src={kidsImage}
                alt="Young athlete training at Striker's House"
                className="relative w-full max-w-md mx-auto lg:max-w-none grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Kids;
