import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import trainingImg from "@/assets/training-calm.jpg";
import coachImg from "@/assets/WhatsApp Image 2026-03-30 at 14.20.16.jpeg";

const TRIAL_URL = "https://strikershouse.yogobooking.pt/frontend/index.html?itemType=class_pass_type&itemId=14172#/login-with-cart";

export default function TryNowSection() {
  const { t } = useTranslation();

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#0a0a14] min-h-[500px] flex flex-col justify-center">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img src={trainingImg} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a14] via-[#0a0a14]/80 to-[#0a0a14]/60" />
      </div>

      <div className="relative z-10 p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left — Text + button */}
        <div>
          <h2 className="text-3xl md:text-4xl font-light text-white leading-tight mb-4">
            {t("tryNow.heroTitle")}{" "}
            <span className="font-bold text-red-500">{t("tryNow.heroPrice")}</span>
            <br />
            <span className="font-bold text-white">{t("tryNow.heroUrgency")}</span>
          </h2>
          <p className="text-white/60 leading-relaxed mb-6">
            {t("tryNow.heroDescription")}
          </p>
          <a
            href={TRIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-yogo-parsed="true"
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-red-700 transition-colors"
          >
            {t("tryNow.cta")}
          </a>
        </div>

        {/* Right — Phone mockup */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute -inset-6 bg-red-600/10 rounded-full blur-3xl" />
            <div className="relative w-[220px] h-[440px] bg-black rounded-[2.5rem] p-2.5 shadow-2xl border border-white/10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />
              <div className="w-full h-full rounded-[2rem] overflow-hidden">
                <img src={coachImg} alt="Coach" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
