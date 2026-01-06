import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import Training from "@/components/Training";
import Coaches from "@/components/Coaches";
import Testimonials from "@/components/Testimonials";
import Schedule from "@/components/Schedule";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Philosophy />
        <Training />
        <Coaches />
        <Testimonials />
        <Schedule />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
