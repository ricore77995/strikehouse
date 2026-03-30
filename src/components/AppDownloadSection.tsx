import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

const IOS_URL = "https://apps.apple.com/dk/app/strikers-house/id6760544356";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=pt.yogobooking.strikershouse";

export default function AppDownloadSection() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#c9a84c] via-[#b8943f] to-[#a07e30]">
      <div className="container mx-auto px-6 py-20">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left — Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex-1 max-w-xl"
          >
            <h2 className="text-3xl md:text-4xl text-gray-900 leading-tight mb-4 font-light">
              {t("app.title")}{" "}
              <span className="font-bold">Striker's House.</span>
            </h2>
            <p className="text-gray-800/80 text-lg mb-8 leading-relaxed">
              {t("app.description")}
            </p>

            {/* Store badges */}
            <div className="flex flex-wrap gap-4">
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
            </div>
          </motion.div>

          {/* Right — Phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <div className="relative w-[260px] h-[540px] bg-black rounded-[3rem] p-3 shadow-2xl border border-black/20">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20" />

              {/* Screen */}
              <div className="w-full h-full rounded-[2.4rem] overflow-hidden bg-white">
                {/* Status bar */}
                <div className="bg-gray-100 px-6 pt-10 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-800">Schedule</span>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded bg-gray-300" />
                      <div className="w-3 h-3 rounded bg-gray-300" />
                    </div>
                  </div>
                </div>

                {/* Day header */}
                <div className="bg-gray-700 px-4 py-2">
                  <span className="text-[10px] font-semibold text-white">Monday, 30 Mar</span>
                </div>

                {/* Class items */}
                {[
                  { name: "GIRL POWER", time: "08:30", coach: "Head Coach (Marcelo)", tags: "Muay Thai \u2022 Kick Boxing \u2022 Fitness", accent: "bg-pink-500" },
                  { name: "STRIKING", time: "19:00", coach: "Head Coach (Marcelo)", tags: "Muay Thai \u2022 Kick Boxing \u2022 MMA", accent: "bg-gray-800" },
                  { name: "STRIKING", time: "20:00", coach: "Head Coach (Marcelo)", tags: "Muay Thai \u2022 Kick Boxing \u2022 MMA", accent: "bg-gray-800" },
                ].map((cls, i) => (
                  <div key={i} className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Carcavelos</span>
                    </div>
                    <div className="text-[8px] text-gray-400 mb-0.5">{cls.coach}</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-gray-900">{cls.name}</div>
                        <div className="text-[7px] text-gray-400">{cls.tags}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-gray-600">{cls.time}</span>
                        <div className={`w-1 h-6 rounded-full ${cls.accent}`} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Tuesday */}
                <div className="bg-gray-700 px-4 py-2">
                  <span className="text-[10px] font-semibold text-white">Tuesday, 31 Mar</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Carcavelos</span>
                  </div>
                  <div className="text-[8px] text-gray-400 mb-0.5">Head Coach (Marcelo)</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-gray-900">STRIKING</div>
                      <div className="text-[7px] text-gray-400">Muay Thai &#8226; Kick Boxing &#8226; MMA</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-gray-600">08:00</span>
                      <div className="w-1 h-6 rounded-full bg-gray-800" />
                    </div>
                  </div>
                </div>

                {/* Bottom nav */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-white border-t border-gray-200 rounded-b-[2.4rem] flex justify-around py-2 px-2">
                    {[
                      { label: "Schedule", active: true },
                      { label: "Events", active: false },
                      { label: "Prices", active: false },
                      { label: "Profile", active: false },
                    ].map((tab) => (
                      <div key={tab.label} className="flex flex-col items-center gap-0.5">
                        <div className={`w-4 h-4 rounded ${tab.active ? "bg-red-500" : "bg-gray-300"}`} />
                        <span className={`text-[7px] ${tab.active ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                          {tab.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
