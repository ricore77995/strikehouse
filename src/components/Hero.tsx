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
        className="absolute inset-0 bg-cover bg-[10%_75%] md:bg-[center_75%] bg-no-repeat"
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
            className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] leading-tight mb-8 animate-fade-up text-white md:text-foreground [text-shadow:_0_2px_20px_rgb(0_0_0_/_90%),_0_4px_40px_rgb(0_0_0_/_80%)] md:[text-shadow:none]"
          >
            {t('hero.controlled')}
            <span className="text-accent">.</span>
            <br />
            {t('hero.chaos')}
            <span className="text-accent">.</span>
          </h1>
          
          {/* Subtitle */}
          <div 
            className="text-white/90 md:text-muted-foreground text-base md:text-lg font-light leading-relaxed max-w-[200px] sm:max-w-xs md:max-w-md animate-fade-up [text-shadow:_0_2px_15px_rgb(0_0_0_/_100%),_0_4px_30px_rgb(0_0_0_/_90%)] md:[text-shadow:none]"
            style={{ animationDelay: "0.15s" }}
          >
            <p>{t('hero.subtitle1')}</p>
            <p className="mt-2">{t('hero.subtitle2')}</p>
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
