import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";
import SectionHeader from "@/components/SectionHeader";
import ChatBubble from "@/components/ChatBubble";
import WhyDifferent from "@/components/WhyDifferent";
import Kids from "@/components/Kids";
import PricingSection from "@/components/PricingSection";
import HowItWorks from "@/components/HowItWorks";
import Modalities from "@/components/Modalities";
import WeeklyGrid from "@/components/schedule/WeeklyGrid";
import TryNowSection from "@/components/TryNowSection";
import AppDownloadSection from "@/components/AppDownloadSection";
import ReviewsSection from "@/components/ReviewsSection";
import GalleryCarousel from "@/components/GalleryCarousel";
import { WHATSAPP_URL } from "@/constants/contact";
import heroVideo from "@/assets/hero-bg.mp4";
import heroPoster from "@/assets/hero-poster.jpg";
import athleteImg from "@/assets/athlete-portrait.jpg";

const scrollToTryNow = () =>
  document.getElementById("try-now")?.scrollIntoView({ behavior: "smooth" });

const Index = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-start overflow-hidden pt-32 md:pt-40">
        {/* Backdrop: same video heavily blurred to fill everything */}
        <video
          className="absolute inset-0 object-cover"
          style={{ width: "100%", height: "100%", transform: "scale(1.4)", filter: "blur(50px) brightness(0.65) saturate(0.8)" }}
          src={heroVideo}
          poster={heroPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        {/* Sharp video: natural portrait aspect, anchored to the right, scaled 20% larger, red glow on visible edge */}
        <video
          className="absolute inset-0 object-contain object-right"
          style={{
            width: "100%",
            height: "100%",
            transform: "scale(1.2)",
            transformOrigin: "right center",
            filter: "drop-shadow(0 0 30px rgba(220, 38, 38, 0.45)) drop-shadow(0 0 60px rgba(220, 38, 38, 0.2))",
          }}
          src={heroVideo}
          poster={heroPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        {/* Left → right darkening overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
        {/* Bottom vignette so seam to next section is soft */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        <OctagonFrame
          className="absolute top-20 right-10 w-64 h-64 opacity-10 rotate-12"
          strokeWidth={0.5}
        />

        <div className="relative z-10 container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl md:text-[3rem] md:leading-[1] lg:text-[4.4rem] lg:leading-[1] font-light tracking-[0.08em] mb-8">
              {t("membership.page.heroTitle1")}
              <br />
              <span className="text-accent">{t("membership.page.heroTitle2")}</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-light leading-relaxed mb-10 whitespace-pre-line">
              {t("membership.page.heroDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-base px-8 rounded-full hover:bg-accent hover:text-accent-foreground" onClick={scrollToTryNow}>
                {t("membership.page.trialCta")}
              </Button>
              <Button
                size="lg"
                className="text-base px-8 rounded-full bg-red-600 text-white border border-red-600 hover:bg-transparent hover:text-red-600"
                onClick={() =>
                  document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {t("membership.page.viewPlans")}
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      {/* Modalities Section - Light Box */}
      <section id="modalities" className="py-20 bg-background">
        <div className="light-box">
          <OctagonFrame
            className="absolute -right-24 top-10 w-[350px] h-[350px] opacity-20 rotate-12"
            strokeWidth={0.5}
            showInner={true}
            strokeColor="#c9a84c"
            innerStrokeColor="#d4a843"
          />
          <OctagonFrame
            className="absolute -left-16 bottom-20 w-[250px] h-[250px] opacity-20 -rotate-6"
            strokeWidth={0.4}
            showInner={false}
            strokeColor="#c9a84c"
          />
          <OctagonFrame
            className="absolute right-20 bottom-10 w-[150px] h-[150px] opacity-20 rotate-[30deg]"
            strokeWidth={0.3}
            showInner={true}
            strokeColor="#d4a843"
            innerStrokeColor="#c9a84c"
          />
          <OctagonFrame
            className="absolute left-10 top-16 w-[120px] h-[120px] opacity-20 -rotate-[15deg]"
            strokeWidth={0.3}
            showInner={false}
            strokeColor="#c9a84c"
          />
          <SectionHeader
            title={t("membership.page.modalitiesTitle")}
            description={t("membership.page.modalitiesDescription")}
            titleClassName="text-black"
            descriptionClassName="text-gray-600"
          />

          <Modalities />
        </div>
      </section>

      {/* Schedule - YOGO Calendar */}
      <section id="horario" className="py-20 bg-background relative overflow-hidden">
        <div className="container mx-auto px-6">
          <SectionHeader
            title={t("membership.page.scheduleTitle")}
            description={t("membership.page.scheduleDescription")}
          />
          <WeeklyGrid />
        </div>
      </section>

      <section id="planos" className="py-20 bg-[#0a0a14] relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <SectionHeader
            title={t("membership.page.plansTitle")}
            description={t("membership.page.plansDescription")}
            titleClassName="text-accent"
            descriptionClassName="text-white/60"
          />
          <PricingSection />
        </div>
      </section>

      {/* How it works — the rules everyone asks about, right after the prices */}
      <section id="como-funciona" className="py-20 bg-[#0a0a14] relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <SectionHeader
            title={t("howItWorks.title")}
            description={t("howItWorks.description")}
            titleClassName="text-accent"
            descriptionClassName="text-white/60"
          />
          <HowItWorks />
        </div>
      </section>

      {/* Gallery Carousel */}
      <GalleryCarousel />

      {/* Google Reviews */}
      <ReviewsSection />

      {/* Welcome + Try Now - Light Box Grid */}
      <section id="try-now" className="py-20 bg-background">
        <div className="light-box">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left — Welcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start"
            >
              <div>
                <p className="text-black text-sm font-bold tracking-wider uppercase mb-3">
                  {t("welcome.subtitle")}
                </p>
                <h2 className="text-3xl break-words text-black leading-tight mb-4 font-light">
                  {t("welcome.title")}{" "}
                  <span className="font-bold text-red-600">{t("welcome.titleBold")}</span>
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  {t("welcome.description")}
                </p>
                <a
                  href="#faq-chat"
                  className="inline-block px-5 py-2.5 bg-black text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-accent transition-colors"
                >
                  {t("welcome.ctaExpect")}
                </a>
              </div>
              <div className="rounded-xl overflow-hidden shadow-lg">
                <img src={athleteImg} alt="Athlete" className="w-full h-[400px] object-cover" />
              </div>
            </motion.div>

            {/* Right — Try Now */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <TryNowSection />
            </motion.div>
          </div>
        </div>
      </section>

      {/* App Download */}
      <AppDownloadSection />

      {/* Why Different */}
      <WhyDifferent />

      {/* Kids */}
      <Kids />

      {/* Final CTA */}
      <section className="py-20 bg-charcoal">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">
              {t("membership.page.finalCtaTitle")}
            </h2>
            <p className="text-muted-foreground font-light mb-8 text-lg">
              {t("membership.page.finalCtaDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8 rounded-full hover:bg-accent hover:text-accent-foreground" onClick={scrollToTryNow}>
                {t("membership.page.freeClass")}
              </Button>
              <Button size="lg" variant="outline" className="px-8 rounded-full hover:border-accent hover:text-accent hover:bg-transparent" asChild>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("membership.page.whatsapp")}
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ - Light Box */}
      <section id="faq-chat" className="py-16 md:py-24 bg-background">
        <div className="light-box">
          <OctagonFrame
            className="absolute -right-20 top-20 w-[300px] h-[300px] opacity-20 rotate-12"
            strokeWidth={0.4}
            showInner={true}
            strokeColor="#c9a84c"
            innerStrokeColor="#d4a843"
          />
          <OctagonFrame
            className="absolute -left-16 bottom-32 w-[220px] h-[220px] opacity-20 -rotate-[20deg]"
            strokeWidth={0.35}
            showInner={false}
            strokeColor="#c9a84c"
          />
          <OctagonFrame
            className="absolute left-1/4 top-10 w-[140px] h-[140px] opacity-20 rotate-[8deg]"
            strokeWidth={0.25}
            showInner={true}
            strokeColor="#d4a843"
            innerStrokeColor="#c9a84c"
          />
          <OctagonFrame
            className="absolute right-16 bottom-16 w-[100px] h-[100px] opacity-20 -rotate-[30deg]"
            strokeWidth={0.2}
            showInner={false}
            strokeColor="#c9a84c"
          />
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <div className="section-line mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] mb-2 text-black">
                {t("firstTime.heroTitle")}
              </h2>
              <p className="text-gray-600">
                {t("firstTime.heroDescription")}
              </p>
            </motion.div>

            {/* Sender labels */}
            <div className="flex justify-between mb-8 px-2">
              <span className="text-xs tracking-[0.2em] uppercase text-gray-500">
                {t("firstTime.senderYou")}
              </span>
              <span className="text-xs tracking-[0.2em] uppercase text-red-600">
                {t("firstTime.senderStriker")}
              </span>
            </div>

            {/* Chat bubbles */}
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div key={n} className="mb-8">
                <ChatBubble message={String(t(`firstTime.q${n}`))} sender="user" index={n * 2} />
                <ChatBubble message={String(t(`firstTime.a${n}`))} sender="striker" index={n * 2 + 1} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
