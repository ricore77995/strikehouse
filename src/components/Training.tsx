import { motion } from "framer-motion";
import glovesImg from "@/assets/gloves-detail.jpg";
import trainingImg from "@/assets/training-calm.jpg";
import mmaImg from "@/assets/mma.jpg";
import OctagonFrame from "./OctagonFrame";

const disciplines = [
  {
    title: "Striking",
    description: "Boxing. Kickboxing. Muay Thai. Precision over power.",
    image: glovesImg,
  },
  {
    title: "Grappling",
    description: "Brazilian Jiu-Jitsu. Wrestling. Control through technique.",
    image: trainingImg,
  },
  {
    title: "MMA",
    description: "The complete discipline. For those ready to integrate all arts.",
    image: mmaImg,
  },
];

const Training = () => {
  return (
    <section id="training" className="py-32 md:py-40 bg-background relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute -right-40 top-20 w-[500px] h-[500px] opacity-10 rotate-45" 
        strokeWidth={0.4}
        showInner={false}
      />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-xl mb-20"
        >
          <div className="space-y-4 mb-8">
            <div className="section-line" />
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
              Training Programs
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] leading-tight">
            Three Paths. One Purpose.
          </h2>
        </motion.div>
        
        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-px bg-border">
          {disciplines.map((discipline, index) => (
            <motion.article 
              key={discipline.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="group bg-background relative overflow-hidden"
            >
              {/* Image */}
              <div className="aspect-square overflow-hidden">
                <img 
                  src={discipline.image} 
                  alt={discipline.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                />
              </div>
              
              {/* Content */}
              <div className="p-8 border-t border-border">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-light tracking-[0.15em]">
                    {discipline.title}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {discipline.description}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Training;
