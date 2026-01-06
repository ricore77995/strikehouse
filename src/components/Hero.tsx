import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 hero-overlay" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Subtitle */}
          <p className="text-primary uppercase tracking-[0.3em] text-sm md:text-base animate-fade-up font-sans">
            Premium MMA Boutique • Cascais
          </p>
          
          {/* Main Title */}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-display tracking-wider animate-fade-up" style={{ animationDelay: "0.2s" }}>
            STRIKER'S
            <span className="block font-serif italic text-4xl md:text-6xl lg:text-7xl text-primary font-normal -mt-2">
              house
            </span>
          </h1>
          
          {/* Tagline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up font-serif italic" style={{ animationDelay: "0.4s" }}>
            Where champions are forged. Elevate your fighting skills in Portugal's most exclusive MMA training facility.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 animate-fade-up" style={{ animationDelay: "0.6s" }}>
            <Button variant="hero" size="xl">
              Start Your Journey
            </Button>
            <Button variant="ghost" size="lg" className="text-muted-foreground hover:text-foreground">
              View Schedule →
            </Button>
          </div>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-px h-16 bg-gradient-to-b from-primary to-transparent" />
      </div>
    </section>
  );
};

export default Hero;
