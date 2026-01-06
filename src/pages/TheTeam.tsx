import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Target, Users, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";

const TheTeam = () => {
  const { t } = useTranslation();

  const athletes = [
    {
      name: "João Mendes",
      discipline: t('team.athletes.joao.discipline'),
      achievements: t('team.athletes.joao.achievements'),
      quote: t('team.athletes.joao.quote'),
      image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500&h=600&fit=crop&crop=face",
      record: "12-2-0"
    },
    {
      name: "Ana Costa",
      discipline: t('team.athletes.ana.discipline'),
      achievements: t('team.athletes.ana.achievements'),
      quote: t('team.athletes.ana.quote'),
      image: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=500&h=600&fit=crop&crop=face",
      record: "8-1-0"
    },
    {
      name: "Miguel Santos",
      discipline: t('team.athletes.miguel.discipline'),
      achievements: t('team.athletes.miguel.achievements'),
      quote: t('team.athletes.miguel.quote'),
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&h=600&fit=crop&crop=face",
      record: "15-3-1"
    },
  ];

  const pathway = [
    {
      icon: Target,
      title: t('team.pathway.step1.title'),
      description: t('team.pathway.step1.description'),
    },
    {
      icon: Users,
      title: t('team.pathway.step2.title'),
      description: t('team.pathway.step2.description'),
    },
    {
      icon: Flame,
      title: t('team.pathway.step3.title'),
      description: t('team.pathway.step3.description'),
    },
    {
      icon: Trophy,
      title: t('team.pathway.step4.title'),
      description: t('team.pathway.step4.description'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pb-32 bg-charcoal overflow-hidden">
        <OctagonFrame 
          className="absolute -right-32 top-1/4 w-[500px] h-[500px] opacity-10 rotate-12" 
          strokeWidth={0.4}
          showInner={false}
        />
        <OctagonFrame 
          className="absolute -left-24 bottom-0 w-[350px] h-[350px] opacity-[0.06] -rotate-6" 
          strokeWidth={0.4}
        />
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm tracking-wider">{t('team.backHome')}</span>
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-xs tracking-[0.3em] uppercase text-accent mb-4 block">
              {t('team.subtitle')}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.1em] leading-tight max-w-3xl">
              {t('team.title')}
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl font-light mt-8 max-w-2xl leading-relaxed">
              {t('team.description')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Athletes Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <OctagonFrame 
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.04]" 
          strokeWidth={0.3}
        />
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mb-16 md:mb-20"
          >
            <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
              {t('team.athletesSubtitle')}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight">
              {t('team.athletesTitle')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {athletes.map((athlete, index) => (
              <motion.article
                key={athlete.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.15,
                  ease: [0.22, 1, 0.36, 1] 
                }}
                className="group"
              >
                <div className="relative aspect-[4/5] mb-6 overflow-hidden bg-muted">
                  <img
                    src={athlete.image}
                    alt={athlete.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                  
                  {/* Record badge */}
                  <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5">
                    <span className="text-xs tracking-wider font-medium">{athlete.record}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-light tracking-wide">
                    {athlete.name}
                  </h3>
                  <p className="text-xs tracking-[0.2em] uppercase text-accent">
                    {athlete.discipline}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {athlete.achievements}
                  </p>
                  <blockquote className="pt-4 border-t border-border/30">
                    <p className="text-sm italic text-foreground/80">
                      "{athlete.quote}"
                    </p>
                  </blockquote>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Become an Athlete Section */}
      <section className="py-24 md:py-32 bg-charcoal relative overflow-hidden">
        <OctagonFrame 
          className="absolute -right-20 top-20 w-[400px] h-[400px] opacity-10 rotate-45" 
          strokeWidth={0.4}
          showInner={false}
        />
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mb-16 md:mb-20"
          >
            <span className="text-xs tracking-[0.3em] uppercase text-accent mb-4 block">
              {t('team.becomeSubtitle')}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-8">
              {t('team.becomeTitle')}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {t('team.becomeDescription')}
            </p>
          </motion.div>

          {/* Pathway Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pathway.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.1,
                  ease: [0.22, 1, 0.36, 1] 
                }}
                className="relative"
              >
                {/* Step number */}
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-accent flex items-center justify-center">
                  <span className="text-xs font-medium text-accent-foreground">0{index + 1}</span>
                </div>
                
                <div className="pt-8 pb-6 px-6 border border-border/30 bg-background/5 h-full">
                  <step.icon className="w-6 h-6 text-accent mb-4" />
                  <h3 className="text-lg font-light tracking-wide mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <OctagonFrame 
          className="absolute -left-32 bottom-20 w-[450px] h-[450px] opacity-10 -rotate-12" 
          strokeWidth={0.4}
          showInner={false}
        />
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
                {t('team.requirementsSubtitle')}
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-8">
                {t('team.requirementsTitle')}
              </h2>
              
              <ul className="space-y-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <li key={num} className="flex items-start gap-4">
                    <span className="w-6 h-6 bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-accent">{num}</span>
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {t(`team.requirements.req${num}`)}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="bg-charcoal p-8 md:p-12"
            >
              <h3 className="text-2xl font-light tracking-wide mb-6">
                {t('team.ctaTitle')}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t('team.ctaDescription')}
              </p>
              <Button variant="default" size="lg" asChild>
                <Link to="/#contact">
                  {t('team.ctaButton')}
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TheTeam;
