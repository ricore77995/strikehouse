import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import img1 from "@/assets/gallery/ALP07923.jpg";
import img3 from "@/assets/gallery/WhatsApp Image 2026-03-12 at 22.14.16 (1).jpeg";
import img4 from "@/assets/gallery/WhatsApp Image 2026-03-12 at 22.14.24.jpeg";
import img5 from "@/assets/gallery/WhatsApp Image 2026-03-12 at 22.14.27 (2).jpeg";
import img6 from "@/assets/gallery/WhatsApp Image 2026-03-30 at 00.39.37 (1).jpeg";
import img7 from "@/assets/gallery/WhatsApp Image 2026-03-30 at 00.41.11.jpeg";
import img8 from "@/assets/gallery/WhatsApp Image 2026-03-30 at 00.41.15.jpeg";
import img9 from "@/assets/gallery/WhatsApp Image 2026-04-02 at 19.41.12.jpeg";
import img10 from "@/assets/gallery/WhatsApp Image 2026-04-02 at 22.34.38.jpeg";
import img11 from "@/assets/gallery/WhatsApp Image 2026-04-02 at 22.34.56.jpeg";
import img12 from "@/assets/gallery/WhatsApp Image 2026-04-02 at 22.36.26.jpeg";

const images = [img1, img3, img4, img5, img6, img7, img8, img9, img10, img11, img12];

export default function GalleryCarousel() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  const getIndex = (offset: number) => (current + offset + images.length) % images.length;

  return (
    <section className="py-12 bg-background overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center text-3xl md:text-4xl font-light tracking-[0.1em] text-foreground mb-10"
        >
          {t("gallery.title")}
        </motion.h2>
        <div className="relative">
          <div className="flex gap-4 items-center justify-center">
            <div className="hidden md:block w-1/4 flex-shrink-0 opacity-40">
              <div className="aspect-[3/2] rounded-xl overflow-hidden">
                <img src={images[getIndex(-1)]} alt="" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="w-full md:w-1/2 flex-shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="aspect-[3/2] rounded-xl overflow-hidden shadow-2xl"
                >
                  <img src={images[current]} alt="" className="w-full h-full object-cover" />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="hidden md:block w-1/4 flex-shrink-0 opacity-40">
              <div className="aspect-[3/2] rounded-xl overflow-hidden">
                <img src={images[getIndex(1)]} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex justify-center gap-2 mt-6">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "bg-red-600 w-6" : "bg-white/20 w-1.5"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
