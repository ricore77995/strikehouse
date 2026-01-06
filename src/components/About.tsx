const About = () => {
  return (
    <section id="about" className="py-24 md:py-32 bg-charcoal">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Section Label */}
          <p className="text-primary uppercase tracking-[0.3em] text-sm">
            Our Philosophy
          </p>
          
          {/* Heading */}
          <h2 className="text-4xl md:text-6xl font-display tracking-wide">
            TRAIN LIKE A WARRIOR
          </h2>
          
          {/* Divider */}
          <div className="section-divider" />
          
          {/* Description */}
          <div className="space-y-6 text-muted-foreground text-lg leading-relaxed font-serif">
            <p>
              At Striker's House, we believe that martial arts is more than just physical training—it's a 
              transformative journey that builds discipline, resilience, and inner strength.
            </p>
            <p>
              Located in the heart of Cascais, our state-of-the-art facility combines world-class 
              coaching with an intimate, boutique atmosphere. Whether you're a complete beginner 
              or a seasoned competitor, our expert trainers will guide you to reach your full potential.
            </p>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-12">
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-display text-primary">10+</p>
              <p className="text-sm uppercase tracking-wider text-muted-foreground">Years Experience</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-display text-primary">500+</p>
              <p className="text-sm uppercase tracking-wider text-muted-foreground">Athletes Trained</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-display text-primary">15</p>
              <p className="text-sm uppercase tracking-wider text-muted-foreground">Pro Champions</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
