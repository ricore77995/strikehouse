import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import OctagonFrame from "./OctagonFrame";
import { z } from "zod";

type ContactForm = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

const CTA = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [formData, setFormData] = useState<ContactForm>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const getContactSchema = () => z.object({
    name: z.string().trim().min(1, t('cta.validation.nameRequired')).max(100, t('cta.validation.nameMax')),
    email: z.string().trim().email(t('cta.validation.emailInvalid')).max(255, t('cta.validation.emailMax')),
    phone: z.string().trim().max(20, t('cta.validation.phoneMax')).optional(),
    message: z.string().trim().min(1, t('cta.validation.messageRequired')).max(1000, t('cta.validation.messageMax')),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof ContactForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const contactSchema = getContactSchema();
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactForm, string>> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof ContactForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: t('cta.successTitle'),
      description: t('cta.successDescription'),
    });

    setFormData({ name: "", email: "", phone: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <section id="contact" className="py-32 md:py-40 bg-charcoal relative overflow-hidden">
      {/* Decorative octagon */}
      <OctagonFrame 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-10" 
        strokeWidth={0.3}
      />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left - Quote & Text */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Quote */}
            <blockquote className="mb-12">
              <motion.p 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-2xl md:text-3xl lg:text-4xl font-light tracking-[0.1em] leading-relaxed mb-6"
              >
                {t('cta.quote')}
              </motion.p>
              <p className="text-muted-foreground text-sm tracking-wider">
                {t('cta.quoteAttribution')}
              </p>
            </blockquote>
            
            <div className="section-line mb-12" />
            
            {/* CTA text */}
            <p className="text-muted-foreground font-light leading-relaxed max-w-md">
              {t('cta.description')}
            </p>
          </motion.div>

          {/* Right - Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Input
                    name="name"
                    placeholder={t('cta.namePlaceholder')}
                    value={formData.name}
                    onChange={handleChange}
                    className="bg-background/50 border-border/50 focus:border-accent h-12 placeholder:text-muted-foreground/50"
                  />
                  {errors.name && (
                    <p className="text-accent text-xs mt-1">{errors.name}</p>
                  )}
                </div>
                
                <div>
                  <Input
                    name="email"
                    type="email"
                    placeholder={t('cta.emailPlaceholder')}
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-background/50 border-border/50 focus:border-accent h-12 placeholder:text-muted-foreground/50"
                  />
                  {errors.email && (
                    <p className="text-accent text-xs mt-1">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <Input
                    name="phone"
                    type="tel"
                    placeholder={t('cta.phonePlaceholder')}
                    value={formData.phone}
                    onChange={handleChange}
                    className="bg-background/50 border-border/50 focus:border-accent h-12 placeholder:text-muted-foreground/50"
                  />
                  {errors.phone && (
                    <p className="text-accent text-xs mt-1">{errors.phone}</p>
                  )}
                </div>
                
                <div>
                  <Textarea
                    name="message"
                    placeholder={t('cta.messagePlaceholder')}
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    className="bg-background/50 border-border/50 focus:border-accent resize-none placeholder:text-muted-foreground/50"
                  />
                  {errors.message && (
                    <p className="text-accent text-xs mt-1">{errors.message}</p>
                  )}
                </div>
              </div>
              
              <Button 
                type="submit" 
                variant="default" 
                size="lg" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('cta.submitting') : t('cta.submit')}
              </Button>
              
              <p className="text-xs text-muted-foreground/60 text-center">
                {t('cta.responseTime')}
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
