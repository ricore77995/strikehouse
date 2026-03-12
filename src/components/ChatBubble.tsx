import { motion } from "framer-motion";

interface ChatBubbleProps {
  message: string;
  sender: "user" | "striker";
  index: number;
  variant?: "light" | "dark";
}

const variantStyles = {
  light: {
    user: "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm",
    striker: "bg-red-600 text-white rounded-2xl rounded-br-sm",
  },
  dark: {
    user: "bg-card text-foreground rounded-2xl rounded-bl-sm",
    striker: "bg-accent/90 text-white rounded-2xl rounded-br-sm",
  },
};

export default function ChatBubble({ message, sender, index, variant = "light" }: ChatBubbleProps) {
  const isUser = sender === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: isUser ? -20 : 20 }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: isUser ? 0 : 0.15 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"} mb-3`}
    >
      <div className={`max-w-[85%] md:max-w-[70%] px-5 py-4 ${variantStyles[variant][sender]}`}>
        {message.split("\n").map((line, i) => (
          <p
            key={i}
            className={`text-sm font-light leading-relaxed ${line === "" ? "h-2" : ""}`}
          >
            {line}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
