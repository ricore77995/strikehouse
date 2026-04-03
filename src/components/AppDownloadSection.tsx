import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import step1Img from "@/assets/WhatsApp Image 2026-03-30 at 14.53.04.jpeg";
import step2Img from "@/assets/WhatsApp Image 2026-03-30 at 14.58.41.jpeg";
import step3Img from "@/assets/WhatsApp Image 2026-03-30 at 14.44.51.jpeg";
import step4Img from "@/assets/WhatsApp Image 2026-03-30 at 14.54.56.jpeg";

const IOS_URL = "https://apps.apple.com/dk/app/strikers-house/id6760544356";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=pt.yogobooking.strikershouse";

const steps = [
  { img: step2Img, key: "profile" },
  { img: step3Img, key: "plan" },
  { img: step4Img, key: "pay" },
];

function PhoneMockup({ img, alt }: { img: string; alt: string }) {
  return (
    <div className="relative w-[220px] h-[440px] bg-black rounded-[2.5rem] p-2.5 shadow-xl border border-black/20 mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />
      <div className="w-full h-full rounded-[2rem] overflow-hidden">
        <img src={img} alt={alt} className="w-full h-full object-cover bg-black" />
      </div>
    </div>
  );
}

export default function AppDownloadSection() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#c9a84c] via-[#8a6d2f] to-[#0a0a0a]">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl text-gray-900 leading-tight mb-4 font-light">
            {t("app.title")}{" "}
            <span className="font-bold">Striker's House.</span>
          </h2>
          <p className="text-white mx-auto" style={{ fontSize: "1.7rem", lineHeight: "1.70rem", maxWidth: "43rem" }}>
            {t("app.description")}
          </p>
        </motion.div>

        {/* 4 Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold mb-4">
                {i + 1}
              </div>
              <PhoneMockup img={step.img} alt={t(`app.steps.${step.key}`)} />
              <p className="mt-4 text-sm font-semibold text-white">
                {t(`app.steps.${step.key}`)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Store badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <a
            href={ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
              alt="Get it on Google Play"
              className="h-12"
            />
          </a>
          <a
            href={IOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105"
          >
            <img
              src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
              alt="Download on the App Store"
              className="h-12"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
