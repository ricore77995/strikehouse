import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-editorial.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 hero-overlay" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 md:px-12">
        <div className="max-w-2xl">
          {/* Tagline */}
          <p 
            className="text-xs tracking-[0.3em] text-muted-foreground mb-8 animate-fade-up"
          >
            MMA Boutique — Cascais
          </p>
          
          {/* Main heading */}
          <h1 
            className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] leading-tight mb-8 animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            Controlled
            <span className="text-accent">.</span>
            <br />
            Chaos
            <span className="text-accent">.</span>
          </h1>
          
          {/* Subtitle */}
          <p 
            className="text-muted-foreground text-base md:text-lg font-light leading-relaxed max-w-md mb-12 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            Train with purpose. A private space for those who take discipline seriously.
          </p>
          
          {/* CTA */}
          <div 
            className="flex items-center gap-6 animate-fade-up"
            style={{ animationDelay: "0.45s" }}
          >
            <Button variant="outline" size="lg">
              Book a Visit
            </Button>
            <a href="#training" className="nav-link">
              Explore →
            </a>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-12 left-6 md:left-12 flex items-center gap-4">
        <div className="w-px h-16 bg-muted-foreground/30" />
        <span className="text-xs tracking-[0.2em] text-muted-foreground rotate-90 origin-left translate-y-6">
          Scroll
        </span>
      </div>
    </section>
  );
};

export default Hero;
