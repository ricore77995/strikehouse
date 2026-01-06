import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-editorial.jpg";
import heroFightersDuo from "@/assets/hero-fighters-duo.jpg";
import OctagonFrame from "./OctagonFrame";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
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
      <div className="relative z-10 container mx-auto px-6 md:px-12 py-32">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text Content */}
          <div className="max-w-2xl lg:flex-1">
            {/* Main heading */}
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] leading-tight mb-8 animate-fade-up"
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
              style={{ animationDelay: "0.15s" }}
            >
              Train with purpose. A private space for those who take discipline seriously.
            </p>
            
            {/* CTA */}
            <div 
              className="flex items-center gap-6 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Button variant="outline" size="lg">
                Book a Visit
              </Button>
              <a href="#training" className="nav-link">
                Explore →
              </a>
            </div>
          </div>

          {/* Fighters Image */}
          <div 
            className="relative lg:flex-1 flex justify-center animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <img 
              src={heroFightersDuo} 
              alt="Strikers House fighters" 
              className="w-full max-w-xl lg:max-w-2xl h-auto object-cover"
            />
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
