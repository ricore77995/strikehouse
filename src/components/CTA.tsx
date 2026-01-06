import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import OctagonFrame from "./OctagonFrame";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  message: z.string().trim().min(1, "Message is required").max(1000, "Message must be less than 1000 characters"),
});

type ContactForm = z.infer<typeof contactSchema>;

const CTA = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [formData, setFormData] = useState<ContactForm>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof ContactForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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
    
    // Simulate form submission - replace with actual API call when Cloud is enabled
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Request received",
      description: "We'll be in touch within 24 hours to schedule your visit.",
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
                "This place is different."
              </motion.p>
              <p className="text-muted-foreground text-sm tracking-wider">
                — What we want you to feel
              </p>
            </blockquote>
            
            <div className="section-line mb-12" />
            
            {/* CTA text */}
            <p className="text-muted-foreground font-light leading-relaxed max-w-md">
              Your first session is complimentary. Visit the space. 
              Meet the community. See if this fits your life.
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
                    placeholder="Name"
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
                    placeholder="Email"
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
                    placeholder="Phone (optional)"
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
                    placeholder="Tell us about your training goals..."
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
                {isSubmitting ? "Sending..." : "Request Your Visit"}
              </Button>
              
              <p className="text-xs text-muted-foreground/60 text-center">
                We respond within 24 hours
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
