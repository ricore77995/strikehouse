import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import coachTankImage from "@/assets/coach-tank.jpg";

const Coaches = () => {
  const { t } = useTranslation();

  const coaches = [
    {
      name: "Marcus Silva",
      role: t('coaches.marcus.role'),
      bio: t('coaches.marcus.bio'),
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop&crop=face"
    },
    {
      name: "Elena Volkov",
      role: t('coaches.elena.role'),
      bio: t('coaches.elena.bio'),
      image: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=500&fit=crop&crop=face"
    },
    {
      name: "Rafael Santos",
      role: t('coaches.rafael.role'),
      bio: t('coaches.rafael.bio'),
      image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=500&fit=crop&crop=face"
    },
    {
      name: "Dmitri Kozlov",
      role: t('coaches.dmitri.role'),
      bio: t('coaches.dmitri.bio'),
      image: coachTankImage
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6 md:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 md:mb-20"
        >
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
            {t('coaches.subtitle')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight">
            {t('coaches.title')}
          </h2>
        </motion.div>

        {/* Coaches Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {coaches.map((coach, index) => (
            <motion.article
              key={coach.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: index * 0.15,
                ease: [0.22, 1, 0.36, 1] 
              }}
              viewport={{ once: true, margin: "-50px" }}
              className="group"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/5] mb-6 overflow-hidden bg-muted">
                <img
                  src={coach.image}
                  alt={coach.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                />
                {/* Red accent line */}
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </div>

              {/* Content */}
              <div className="space-y-3">
                <h3 className="text-xl font-light tracking-wide">
                  {coach.name}
                </h3>
                <p className="text-xs tracking-[0.2em] uppercase text-accent">
                  {coach.role}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {coach.bio}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Coaches;
