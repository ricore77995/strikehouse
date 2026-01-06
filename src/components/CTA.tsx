import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-24 md:py-32 bg-charcoal relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="octagon" patternUnits="userSpaceOnUse" width="50" height="50">
            <polygon 
              points="25,0 50,15 50,35 25,50 0,35 0,15" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="0.5"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#octagon)" />
        </svg>
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <p className="text-primary uppercase tracking-[0.3em] text-sm">
            Ready to Begin?
          </p>
          
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-display tracking-wide leading-tight">
            YOUR FIRST CLASS
            <span className="block text-primary">IS ON US</span>
          </h2>
          
          <p className="text-muted-foreground text-lg font-serif max-w-xl mx-auto">
            Experience the Striker's House difference. Book your complimentary trial session 
            and discover why we're Cascais' premier MMA training destination.
          </p>
          
          <div className="pt-4">
            <Button variant="gold" size="xl">
              Book Free Trial
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
