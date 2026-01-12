import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import WhyDifferent from "@/components/WhyDifferent";
import Training from "@/components/Training";
import Kids from "@/components/Kids";
// import Gallery from "@/components/Gallery"; // Hidden - O Espaço
// import Testimonials from "@/components/Testimonials"; // Hidden - A Comunidade
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Philosophy />
        <WhyDifferent />
        <Training />
        <Kids />
        {/* <Gallery /> */}
        {/* <Testimonials /> */}
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
