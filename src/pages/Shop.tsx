import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import logoSvg from "@/assets/strikershouse-logo-2.svg";

const Shop = () => {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // YOGO widget script parses the DOM for .yogo-products divs.
    // Since React mounts after the initial parse, we need to trigger
    // a re-parse. YOGO sets YOGO_PARSE_HTML_CONTINUOUSLY=true in index.html
    // which handles this automatically via MutationObserver.
    // If for some reason it doesn't render, force a re-parse:
    if (widgetRef.current && (window as any).YOGO_PARSE_HTML) {
      (window as any).YOGO_PARSE_HTML();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-16 pt-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShoppingBag className="h-8 w-8 text-accent" />
            <h1 className="text-3xl md:text-4xl font-light uppercase tracking-[0.15em]">
              Loja
            </h1>
          </div>
          <p className="text-muted-foreground text-sm tracking-wide">
            Seleciona o produto e paga com o teu telemovel
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-full max-w-2xl"
        >
          <div
            ref={widgetRef}
            className="yogo-products-wrapper"
          >
            <div className="yogo-products"></div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 flex items-center gap-2 text-muted-foreground/50 text-xs"
        >
          <img src={logoSvg} alt="Striker's House" className="h-5 opacity-50" />
          <span className="tracking-wide">Self-service</span>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
