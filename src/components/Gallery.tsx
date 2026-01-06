import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import OctagonFrame from "./OctagonFrame";

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&h=600&fit=crop",
    alt: "Training floor with heavy bags",
    span: "col-span-2 row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&h=400&fit=crop",
    alt: "Boxing ring under dramatic lighting",
    span: "col-span-1 row-span-1",
  },
  {
    src: "https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=600&h=400&fit=crop",
    alt: "Fighters sparring session",
    span: "col-span-1 row-span-1",
  },
  {
    src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=800&fit=crop",
    alt: "Athlete preparing for training",
    span: "col-span-1 row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1517438322307-e67f1cb49e6a?w=600&h=400&fit=crop",
    alt: "Close-up of boxing gloves",
    span: "col-span-1 row-span-1",
  },
  {
    src: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=600&h=400&fit=crop",
    alt: "Group training session",
    span: "col-span-1 row-span-1",
  },
];

const Gallery = () => {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <section className="py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute -right-32 top-20 w-[500px] h-[500px] opacity-10 -rotate-12" 
        strokeWidth={0.4}
        showInner={false}
      />
      <div className="container mx-auto px-6 md:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 md:mb-20"
        >
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 block">
            {t('gallery.subtitle')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight">
            {t('gallery.title')}
          </h2>
        </motion.div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[150px] md:auto-rows-[200px]">
          {galleryImages.map((image, index) => (
            <motion.button
              key={image.src}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.6, 
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1] 
              }}
              viewport={{ once: true, margin: "-50px" }}
              className={`${image.span} relative overflow-hidden group cursor-pointer`}
              onClick={() => setSelectedImage(image.src)}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-background/40 group-hover:bg-transparent transition-colors duration-500" />
              {/* Red accent on hover */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button
              className="absolute top-6 right-6 text-foreground/60 hover:text-foreground transition-colors"
              onClick={() => setSelectedImage(null)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <X className="w-8 h-8" />
            </motion.button>
            
            <motion.img
              src={selectedImage.replace(/w=\d+&h=\d+/, "w=1400&h=900")}
              alt="Gallery image enlarged"
              className="max-w-full max-h-[85vh] object-contain"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Gallery;
