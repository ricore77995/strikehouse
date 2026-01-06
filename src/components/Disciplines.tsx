import kickboxingImg from "@/assets/kickboxing.jpg";
import bjjImg from "@/assets/bjj.jpg";
import mmaImg from "@/assets/mma.jpg";

const disciplines = [
  {
    title: "Kickboxing",
    subtitle: "Strike with precision",
    description: "Master the art of striking with our comprehensive kickboxing program. From basics to advanced combinations.",
    image: kickboxingImg,
  },
  {
    title: "Brazilian Jiu-Jitsu",
    subtitle: "The gentle art",
    description: "Learn ground fighting techniques from our black belt instructors. Suitable for all skill levels.",
    image: bjjImg,
  },
  {
    title: "Mixed Martial Arts",
    subtitle: "Complete warrior",
    description: "Combine all disciplines into one cohesive fighting system. Train like the pros in our octagon.",
    image: mmaImg,
  },
];

const Disciplines = () => {
  return (
    <section id="disciplines" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <p className="text-primary uppercase tracking-[0.3em] text-sm">
            Training Programs
          </p>
          <h2 className="text-4xl md:text-6xl font-display tracking-wide">
            OUR DISCIPLINES
          </h2>
          <div className="section-divider" />
        </div>
        
        {/* Disciplines Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {disciplines.map((discipline, index) => (
            <article 
              key={discipline.title}
              className="group relative overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-500"
            >
              {/* Image */}
              <div className="aspect-[3/4] overflow-hidden">
                <img 
                  src={discipline.image} 
                  alt={discipline.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              
              {/* Content Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-90 group-hover:opacity-95 transition-opacity" />
              
              {/* Text Content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                <p className="text-primary text-sm uppercase tracking-wider font-serif italic">
                  {discipline.subtitle}
                </p>
                <h3 className="text-2xl md:text-3xl font-display tracking-wide">
                  {discipline.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {discipline.description}
                </p>
              </div>
              
              {/* Number */}
              <div className="absolute top-4 right-4 text-6xl font-display text-primary/20">
                0{index + 1}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Disciplines;
