import { motion } from "framer-motion";

interface SectionHeaderProps {
  title: string;
  description?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  description,
  titleClassName = "",
  descriptionClassName = "text-muted-foreground",
  className = "mb-16",
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className={`text-center ${className}`}
    >
      <div className="section-line mx-auto mb-4" />
      <h2
        className={`text-3xl md:text-4xl font-light tracking-[0.1em] mb-4 ${titleClassName}`}
      >
        {title}
      </h2>
      {description && (
        <p className={`max-w-xl mx-auto ${descriptionClassName}`}>
          {description}
        </p>
      )}
    </motion.div>
  );
}
