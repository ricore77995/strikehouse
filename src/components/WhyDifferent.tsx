import { motion } from "framer-motion";
import whyDifferentImage from "@/assets/why-different.png";

const WhyDifferent = () => {
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-red/10 blur-2xl rounded-full" />
              <img
                src={whyDifferentImage}
                alt="Striker's House coach"
                className="relative w-full max-w-md mx-auto lg:max-w-none grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="order-1 lg:order-2"
          >
            <span className="text-red uppercase tracking-[0.2em] text-sm font-medium">
              Our Approach
            </span>
            
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-foreground mt-4 mb-8 leading-tight">
              Why Striker's House is Different
            </h2>

            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
              <p>
                Here, competition and personal growth share the same floor.<br />
                Athletes prepare to compete.<br />
                Others come to become stronger — physically and mentally.
              </p>

              <p className="text-foreground font-medium text-xl">
                Different paths. One discipline.
              </p>

              <p>
                We don't separate people by ego, age or background.<br />
                We bring them together through structure, respect and consistency.
              </p>

              <p className="text-foreground/80 italic">
                Because real strength is built over time.
              </p>
            </div>

            <div className="mt-10 w-16 h-px bg-red" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhyDifferent;
