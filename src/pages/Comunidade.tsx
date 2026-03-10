import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Target, Users, Shield, Flame } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";

import { Link } from "react-router-dom";

const Comunidade = () => {
  const { t } = useTranslation();

  const values = [
    { icon: Target, key: "discipline" },
    { icon: Users, key: "respect" },
    { icon: Shield, key: "consistency" },
    { icon: Flame, key: "evolution" },
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
              {t("community.heroTitle")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              {t("community.manifesto")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, i) => (
              <motion.div
                key={value.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center p-8 border border-border"
              >
                <value.icon className="w-8 h-8 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-light tracking-[0.1em] mb-3 uppercase">
                  {t(`community.values.${value.key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {t(`community.values.${value.key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Extended Manifesto */}
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
              <p className="text-lg font-light leading-relaxed text-muted-foreground">
                {t("community.paragraph1")}
              </p>
              <p className="text-lg font-light leading-relaxed text-muted-foreground">
                {t("community.paragraph2")}
              </p>
              <blockquote className="border-l-2 border-accent pl-6 py-2">
                <p className="text-xl font-light tracking-[0.05em] text-foreground">
                  {t("community.quote")}
                </p>
              </blockquote>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Diversity & Inclusion */}
      <section className="py-16 md:py-24 bg-background relative overflow-hidden">
        {/* Rainbow gradient accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)' }} />

        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-12"
            >
              {/* Rainbow gradient line instead of plain section-line */}
              <div className="w-12 h-[2px] mx-auto mb-6" style={{ background: 'linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)' }} />
              <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] mb-6">
                {t("community.diversity.title")}
              </h2>
              <p className="text-lg font-light leading-relaxed text-muted-foreground max-w-2xl mx-auto">
                {t("community.diversity.text")}
              </p>
            </motion.div>

            {/* Colored diversity circles */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex justify-center gap-3 md:gap-4 mb-12"
            >
              {['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'].map((color, i) => (
                <motion.div
                  key={color}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full opacity-80"
                  style={{ backgroundColor: color }}
                />
              ))}
            </motion.div>

            {/* Commitment quote with rainbow left border */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="max-w-2xl mx-auto"
            >
              <blockquote
                className="pl-6 py-4 text-center md:text-left"
                style={{ borderLeft: '3px solid', borderImage: 'linear-gradient(180deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787) 1' }}
              >
                <p className="text-lg md:text-xl font-light tracking-[0.03em] text-foreground/90 italic">
                  {t("community.diversity.commitment")}
                </p>
              </blockquote>
            </motion.div>
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
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] mb-8">
              {t("community.ctaTitle")}
            </h2>
            <Link
              to="/#try-now"
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white text-sm uppercase tracking-[0.15em] hover:bg-accent/90 transition-colors rounded-full"
            >
              {t("community.ctaButton")}
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Comunidade;
