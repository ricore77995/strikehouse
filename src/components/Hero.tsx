import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-editorial.jpg";
import OctagonFrame from "./OctagonFrame";

const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex items-start justify-center overflow-hidden pt-32">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-[center_75%] bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 hero-overlay" />
      
      {/* Decorative octagon - top right */}
      <OctagonFrame 
        className="absolute -top-20 -right-20 w-80 h-80 opacity-20 rotate-12" 
        strokeWidth={0.5}
      />
      
      {/* Decorative octagon - bottom left */}
      <OctagonFrame 
        className="absolute -bottom-32 -left-32 w-96 h-96 opacity-15 -rotate-6" 
        strokeWidth={0.5}
      />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 md:px-12">
        <div className="max-w-2xl">
          {/* Main heading */}
          <h1 
            className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] leading-tight mb-8 animate-fade-up"
          >
            {t('hero.controlled')}
            <span className="text-accent">.</span>
            <br />
            {t('hero.chaos')}
            <span className="text-accent">.</span>
          </h1>
          
          {/* Subtitle */}
          <p 
            className="text-muted-foreground text-base md:text-lg font-light leading-relaxed max-w-md mb-12 animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            {t('hero.subtitle')}
          </p>
          
          {/* CTA */}
          <div 
            className="flex items-center gap-6 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Button variant="outline" size="lg">
              {t('hero.bookVisit')}
            </Button>
            <a href="#training" className="nav-link">
              {t('hero.explore')} →
            </a>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-12 left-6 md:left-12 flex items-center gap-4">
        <div className="w-px h-16 bg-muted-foreground/30" />
        <span className="text-xs tracking-[0.2em] text-muted-foreground rotate-90 origin-left translate-y-6">
          {t('hero.scroll')}
        </span>
      </div>
    </section>
  );
};

export default Hero;
