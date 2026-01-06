import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "I have trained at gyms across three continents. This is the first place that felt like home.",
    name: "David Chen",
    detail: "Member since 2022",
  },
  {
    quote: "The coaches here see what others miss. My technique transformed in ways I did not think possible.",
    name: "Sarah Mitchell",
    detail: "Competitive Fighter",
  },
  {
    quote: "No ego. No drama. Just people committed to getting better every single day.",
    name: "Marcus Webb",
    detail: "Member since 2021",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 md:py-32 bg-charcoal">
      <div className="container mx-auto px-6 md:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 md:mb-20 text-center"
        >
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
            The Community
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight">
            In Their Words
          </h2>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={testimonial.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: index * 0.15,
                ease: [0.22, 1, 0.36, 1] 
              }}
              viewport={{ once: true, margin: "-50px" }}
              className="relative"
            >
              {/* Quote mark */}
              <span className="absolute -top-4 -left-2 text-6xl text-accent/20 font-serif leading-none select-none">
                "
              </span>
              
              {/* Quote content */}
              <blockquote className="pt-8 pb-6 border-t border-border/30">
                <p className="text-lg md:text-xl font-light leading-relaxed text-foreground/90 mb-8">
                  {testimonial.quote}
                </p>
                
                <footer className="flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-accent" />
                  <div>
                    <cite className="not-italic text-sm font-medium text-foreground">
                      {testimonial.name}
                    </cite>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {testimonial.detail}
                    </p>
                  </div>
                </footer>
              </blockquote>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;