import { Button } from "@/components/ui/button";
import OctagonFrame from "./OctagonFrame";

const CTA = () => {
  return (
    <section className="py-32 md:py-40 bg-charcoal relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-10" 
        strokeWidth={0.3}
      />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          {/* Quote */}
          <blockquote className="mb-12">
            <p className="text-2xl md:text-3xl lg:text-4xl font-light tracking-[0.1em] leading-relaxed mb-6">
              "This place is different."
            </p>
            <p className="text-muted-foreground text-sm tracking-wider">
              — What we want you to feel
            </p>
          </blockquote>
          
          <div className="section-line mx-auto mb-12" />
          
          {/* CTA text */}
          <p className="text-muted-foreground font-light leading-relaxed mb-10 max-w-md mx-auto">
            Your first session is complimentary. Visit the space. 
            Meet the community. See if this fits your life.
          </p>
          
          <Button variant="default" size="lg">
            Request Your Visit
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
