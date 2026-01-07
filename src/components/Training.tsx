import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import glovesImg from "@/assets/gloves-detail.jpg";
import trainingImg from "@/assets/training-calm.jpg";
import mmaImg from "@/assets/mma.jpg";
import OctagonFrame from "./OctagonFrame";

const Training = () => {
  const { t } = useTranslation();

  const disciplines = [
    {
      title: t('training.striking'),
      description: t('training.strikingDesc'),
      image: glovesImg,
    },
    {
      title: t('training.grappling'),
      description: t('training.grapplingDesc'),
      image: trainingImg,
    },
    {
      title: t('training.mma'),
      description: t('training.mmaDesc'),
      image: mmaImg,
    },
  ];

  return (
    <section id="training" className="py-16 md:py-32 lg:py-40 bg-background relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute -right-40 top-20 w-[500px] h-[500px] opacity-10 rotate-45" 
        strokeWidth={0.4}
        showInner={false}
      />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-xl mb-20"
        >
          <div className="space-y-4 mb-8">
            <div className="section-line" />
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
              {t('training.subtitle')}
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] leading-tight">
            {t('training.title')}
          </h2>
        </motion.div>
        
        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-px bg-border">
          {disciplines.map((discipline, index) => (
            <motion.article 
              key={discipline.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="group bg-background relative overflow-hidden"
            >
              {/* Image */}
              <div className="aspect-square overflow-hidden">
                <img 
                  src={discipline.image} 
                  alt={discipline.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                />
              </div>
              
              {/* Content */}
              <div className="p-8 border-t border-border">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-light tracking-[0.15em]">
                    {discipline.title}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {discipline.description}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Training;
