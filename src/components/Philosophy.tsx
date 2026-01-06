import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import athleteImg from "@/assets/athlete-portrait.jpg";

const Philosophy = () => {
  const { t } = useTranslation();

  const values = [
    { title: t('philosophy.focus'), subtitle: t('philosophy.focusSub') },
    { title: t('philosophy.respect'), subtitle: t('philosophy.respectSub') },
    { title: t('philosophy.growth'), subtitle: t('philosophy.growthSub') },
  ];

  return (
    <section id="philosophy" className="py-32 md:py-40 bg-charcoal">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Text content */}
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-8 order-2 lg:order-1"
          >
            <div className="space-y-4">
              <div className="section-line" />
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
                {t('philosophy.subtitle')}
              </p>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] leading-tight">
              {t('philosophy.title')}
            </h2>
            
            <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
              <p>{t('philosophy.description1')}</p>
              <p>{t('philosophy.description2')}</p>
            </div>
            
            {/* Values */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                >
                  <p className="text-2xl font-light mb-1">{value.title}</p>
                  <p className="text-xs text-muted-foreground tracking-wider">
                    {value.subtitle}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
          {/* Image */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="order-1 lg:order-2"
          >
            <div className="relative">
              <img 
                src={athleteImg} 
                alt="Athlete in contemplation"
                className="w-full aspect-[3/4] object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />
              {/* Accent line */}
              <div className="absolute -bottom-4 -left-4 w-24 h-px bg-accent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Philosophy;
