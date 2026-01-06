import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Disciplines from "@/components/Disciplines";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <About />
        <Disciplines />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
