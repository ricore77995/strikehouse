import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";

interface ChatBubbleProps {
  message: string;
  sender: "user" | "striker";
  index: number;
}

const ChatBubble = ({ message, sender, index }: ChatBubbleProps) => {
  const isUser = sender === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: isUser ? -20 : 20 }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.15 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"} mb-4`}
    >
      <div
        className={`max-w-[85%] md:max-w-[70%] px-5 py-4 ${
          isUser
            ? "bg-card text-foreground rounded-2xl rounded-bl-sm"
            : "bg-accent/90 text-white rounded-2xl rounded-br-sm"
        }`}
      >
        {message.split("\n").map((line, i) => (
          <p key={i} className={`text-sm font-light leading-relaxed ${line === "" ? "h-2" : ""}`}>
            {line}
          </p>
        ))}
      </div>
    </motion.div>
  );
};

const PrimeiraVez = () => {
  const { t } = useTranslation();

  const conversations = [
    { q: t("firstTime.q1"), a: t("firstTime.a1") },
    { q: t("firstTime.q2"), a: t("firstTime.a2") },
    { q: t("firstTime.q3"), a: t("firstTime.a3") },
    { q: t("firstTime.q4"), a: t("firstTime.a4") },
    { q: t("firstTime.q5"), a: t("firstTime.a5") },
    { q: t("firstTime.q6"), a: t("firstTime.a6") },
    { q: t("firstTime.q7"), a: t("firstTime.a7") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-charcoal relative overflow-hidden">
        <OctagonFrame
          className="absolute -right-32 top-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-5 rotate-12"
          strokeWidth={0.4}
          showInner={false}
        />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="section-line mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-[0.1em] mb-4">
              {t("firstTime.heroTitle")}
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("firstTime.heroDescription")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Chat Section */}
      <section className="py-16 md:py-24 bg-background relative overflow-hidden">
        <OctagonFrame
          className="absolute -right-24 top-16 w-[320px] h-[320px] opacity-20 rotate-12"
          strokeWidth={0.4}
          showInner={true}
          strokeColor="#c9a84c"
          innerStrokeColor="#d4a843"
        />
        <OctagonFrame
          className="absolute -left-20 bottom-24 w-[260px] h-[260px] opacity-20 -rotate-[15deg]"
          strokeWidth={0.35}
          showInner={false}
          strokeColor="#c9a84c"
        />
        <OctagonFrame
          className="absolute right-10 bottom-1/3 w-[150px] h-[150px] opacity-20 rotate-45"
          strokeWidth={0.25}
          showInner={true}
          strokeColor="#d4a843"
          innerStrokeColor="#c9a84c"
        />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto">
            {/* Sender labels */}
            <div className="flex justify-between mb-10 px-2">
              <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                {t("firstTime.senderYou")}
              </span>
              <span className="text-xs tracking-[0.2em] uppercase text-accent">
                {t("firstTime.senderStriker")}
              </span>
            </div>

            {/* Conversation bubbles */}
            {conversations.map((conv, i) => (
              <div key={i} className="mb-10">
                <ChatBubble message={conv.q} sender="user" index={i * 2} />
                <ChatBubble message={conv.a} sender="striker" index={i * 2 + 1} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-charcoal text-center">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] mb-8">
              {t("firstTime.ctaTitle")}
            </h2>
            <Link
              to="/#try-now"
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white text-sm uppercase tracking-[0.15em] hover:bg-accent/90 transition-colors rounded-full"
            >
              {t("firstTime.ctaButton")}
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrimeiraVez;
