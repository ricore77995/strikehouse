import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";
import heroImage from "@/assets/training-calm.jpg";

const Membership = () => {
  const { t } = useTranslation();

  const fullAccessPlans = [
    {
      name: t('membership.plans.full.name'),
      description: t('membership.plans.full.description'),
      features: [
        t('membership.plans.full.feature1'),
        t('membership.plans.full.feature2'),
        t('membership.plans.full.feature3'),
        t('membership.plans.full.feature4'),
      ],
      highlighted: true,
    },
    {
      name: t('membership.plans.offPeak.name'),
      description: t('membership.plans.offPeak.description'),
      features: [
        t('membership.plans.offPeak.feature1'),
        t('membership.plans.offPeak.feature2'),
        t('membership.plans.offPeak.feature3'),
      ],
      highlighted: false,
    },
    {
      name: t('membership.plans.student.name'),
      description: t('membership.plans.student.description'),
      features: [
        t('membership.plans.student.feature1'),
        t('membership.plans.student.feature2'),
        t('membership.plans.student.feature3'),
      ],
      highlighted: false,
    },
  ];

  const benefits = [
    t('membership.benefits.benefit1'),
    t('membership.benefits.benefit2'),
    t('membership.benefits.benefit3'),
    t('membership.benefits.benefit4'),
    t('membership.benefits.benefit5'),
    t('membership.benefits.benefit6'),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden pt-24">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-background/80" />
        
        <OctagonFrame 
          className="absolute top-20 right-10 w-64 h-64 opacity-10 rotate-12" 
          strokeWidth={0.5}
        />
        
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-xs tracking-[0.3em] text-accent uppercase mb-4">
              {t('membership.subtitle')}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] mb-6">
              {t('membership.title')}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
              {t('membership.description')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Membership Plans */}
      <section className="py-16 md:py-24 bg-background relative overflow-hidden">
        <OctagonFrame 
          className="absolute -left-32 top-1/4 w-[400px] h-[400px] opacity-10 -rotate-12" 
          strokeWidth={0.4}
          showInner={false}
        />
        
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em]">
              {t('membership.plansTitle')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {fullAccessPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`p-8 border ${plan.highlighted ? 'border-accent bg-accent/5' : 'border-border bg-card'} relative`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-8 bg-accent text-accent-foreground px-3 py-1 text-xs tracking-wider uppercase">
                    {t('membership.popular')}
                  </div>
                )}
                
                <h3 className="text-xl font-light tracking-[0.1em] mb-3 uppercase">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-6 font-light">
                  {plan.description}
                </p>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  variant={plan.highlighted ? "default" : "outline"} 
                  className="w-full"
                >
                  {t('membership.enquire')}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24 bg-charcoal relative overflow-hidden">
        <OctagonFrame 
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-10 rotate-6" 
          strokeWidth={0.4}
          showInner={false}
        />
        
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="section-line mb-4" />
              <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">
                {t('membership.benefitsTitle')}
              </h2>
              <p className="text-muted-foreground font-light leading-relaxed">
                {t('membership.benefitsDescription')}
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <ul className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 * index }}
                    className="flex items-start gap-3"
                  >
                    <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">
              {t('membership.ctaTitle')}
            </h2>
            <p className="text-muted-foreground font-light mb-8">
              {t('membership.ctaDescription')}
            </p>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://wa.me/351913378459"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('membership.ctaButton')}
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Membership;