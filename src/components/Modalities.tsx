import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useYogoClassTypes, type ClassType } from "@/hooks/useYogoClassTypes";
import { isTrialClass } from "@/hooks/useYogoClasses";
import strikingImg from "@/assets/gallery/WhatsApp Image 2026-04-02 at 19.41.12.jpeg";
import boxingImg from "@/assets/gallery/WhatsApp Image 2026-03-30 at 00.39.37 (1).jpeg";
import girlPowerImg from "@/assets/gallery/WhatsApp Image 2026-04-02 at 22.36.26.jpeg";
import kidsImg from "@/assets/gallery/WhatsApp Image 2026-03-12 at 22.14.27 (2).jpeg";
import personalFighterImg from "@/assets/gallery/ALP07923.jpg";
import fallbackImg from "@/assets/gallery/WhatsApp Image 2026-03-30 at 00.41.11.jpeg";

/**
 * Photography stays local — YOGO class types carry no image. These are the gym's own
 * photos of each class, not stock: a gym selling authenticity should not illustrate
 * "Striking" with an iStock picture. All are already bundled for the gallery carousel,
 * so using them here adds no weight. Keyed on the class name YOGO publishes, which is
 * also what visitors read in the weekly grid.
 */
const IMAGES: Record<string, string> = {
  striking: strikingImg,
  boxing: boxingImg,
  "girl power": girlPowerImg,
  kids: kidsImg,
  "personal fighter": personalFighterImg,
};

function imageFor(name: string): string {
  return IMAGES[name.trim().toLowerCase()] ?? fallbackImg;
}

/**
 * The classes on offer, described by the gym in YOGO. Replaces three hardcoded cards
 * (Boxe / Muay Thai / MMA) that did not match the names on the timetable — a visitor
 * reading "GIRL POWER 08:30" in the grid had no way to find out what that was.
 */
export default function Modalities() {
  const { data, isLoading, error } = useYogoClassTypes();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Every class the gym runs, described or not. Requiring a description hid GIRL POWER,
  // whose YOGO text is only the shared arrival notice — and hiding a real class is worse
  // than a card carrying just its name. The trial shadow is never a modality of its own.
  const modalities = (data ?? []).filter(
    (type: ClassType) => !isTrialClass(type.name, type.id)
  );

  if (error || !modalities.length) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {modalities.map((modality, index) => (
        <motion.div
          key={modality.id}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="aspect-square overflow-hidden">
            <img
              // YOGO first, local photo only where the panel has none. Upload a better
              // shot in YOGO and this card follows without a code change.
              src={modality.imageUrl ?? imageFor(modality.name)}
              alt={modality.name}
              className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
            />
          </div>
          <div className="flex flex-1 flex-col border-t border-gray-200 p-6">
            <h3 className="mb-2 text-lg font-light uppercase tracking-wider text-accent">
              {modality.name}
            </h3>
            <ul className="space-y-1">
              {modality.lines.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-gray-600">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
