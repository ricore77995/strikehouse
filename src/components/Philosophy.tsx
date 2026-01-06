import athleteImg from "@/assets/athlete-portrait.jpg";

const Philosophy = () => {
  return (
    <section id="philosophy" className="py-32 md:py-40 bg-charcoal">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Text content */}
          <div className="space-y-8 order-2 lg:order-1">
            <div className="space-y-4">
              <div className="section-line" />
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
                Our Philosophy
              </p>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] leading-tight">
              Discipline Creates Freedom
            </h2>
            
            <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
              <p>
                We are not a gym. We are a training space for those who understand 
                that martial arts is a practice, not a performance.
              </p>
              <p>
                Fighters, executives, expats, students. Different lives, 
                same mat. Respect the space. Respect each other.
              </p>
            </div>
            
            {/* Values */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
              <div>
                <p className="text-2xl font-light mb-1">
                  Focus
                </p>
                <p className="text-xs text-muted-foreground tracking-wider">
                  Sharp mind
                </p>
              </div>
              <div>
                <p className="text-2xl font-light mb-1">
                  Respect
                </p>
                <p className="text-xs text-muted-foreground tracking-wider">
                  For all
                </p>
              </div>
              <div>
                <p className="text-2xl font-light mb-1">
                  Growth
                </p>
                <p className="text-xs text-muted-foreground tracking-wider">
                  Every day
                </p>
              </div>
            </div>
          </div>
          
          {/* Image */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              <img 
                src={athleteImg} 
                alt="Athlete in contemplation"
                className="w-full aspect-[3/4] object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />
              {/* Accent line */}
              <div className="absolute -bottom-4 -left-4 w-24 h-px bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Philosophy;
