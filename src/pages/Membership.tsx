import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Loader2, ChevronDown, Zap, Shield, Users, Target, Clock, Award, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";
import heroImage from "@/assets/training-calm.jpg";
import { supabase } from "@/integrations/supabase/client";

interface PaymentLinkInfo {
  id: string;
  url: string;
  displayName: string;
  priceAmountCents: number | null;
  planPriceCents: number | null; // Price without enrollment
  currency: string;
  metadata: {
    weekly_limit?: string | null;
    modalities_count?: string | null;
    access_type?: string | null;
    commitment_months?: string | null;
    special?: string | null;
  };
  active: boolean;
}

interface SignupForm {
  // Page 1 - Personal Data
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  ageGroup: string;
  // Page 2 - Preferences
  previousExperience: string;
  experienceDuration: string;
  modalitiesInterest: string[];
  trainingType: string;
  mainGoal: string;
  availability: string;
  hasInjury: string;
}

const ENROLLMENT_FEE_CENTS = 1500; // €15

const Membership = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Payment links state
  const [links, setLinks] = useState<PaymentLinkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedLink, setSelectedLink] = useState<PaymentLinkInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTrialRequest, setIsTrialRequest] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [form, setForm] = useState<SignupForm>({
    firstName: "",
    lastName: "",
    gender: "",
    phone: "",
    email: "",
    ageGroup: "adult",
    previousExperience: "",
    experienceDuration: "",
    modalitiesInterest: [],
    trainingType: "",
    mainGoal: "",
    availability: "",
    hasInjury: "",
  });

  // Fetch payment links on mount
  useEffect(() => {
    async function fetchLinks() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from("stripe_payment_links")
          .select("*")
          .eq("ativo", true)
          .eq("includes_enrollment_fee", true)
          .eq("is_family_friends", false)
          .order("amount_cents", { ascending: true });

        if (queryError) throw new Error(queryError.message);

        if (data && data.length > 0) {
          const transformedLinks: PaymentLinkInfo[] = data.map((row) => {
            const commitmentMap: Record<string, string> = {
              mensal: "1", trimestral: "3", semestral: "6", anual: "12",
            };

            // Calculate plan price (total - enrollment fee)
            const planPriceCents = row.amount_cents - ENROLLMENT_FEE_CENTS;

            // Use weekly_limit from DB, fallback to frequencia mapping
            const weeklyLimit = row.weekly_limit != null
              ? row.weekly_limit.toString()
              : (row.frequencia === "unlimited" ? null : row.frequencia?.replace("x", "") || null);

            return {
              id: row.payment_link_id,
              url: row.payment_link_url,
              displayName: row.display_name || `Plano ${row.frequencia}`,
              priceAmountCents: row.amount_cents,
              planPriceCents: planPriceCents > 0 ? planPriceCents : row.amount_cents,
              currency: "eur",
              metadata: {
                weekly_limit: weeklyLimit,
                modalities_count: row.modalities_count?.toString() || null,
                access_type: "SUBSCRIPTION",
                commitment_months: commitmentMap[row.compromisso] || "1",
              },
              active: row.ativo,
            };
          });
          setLinks(transformedLinks);
        } else {
          setLinks([]);
        }
      } catch (err) {
        console.error("Error fetching payment links:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar planos");
      } finally {
        setLoading(false);
      }
    }
    fetchLinks();
  }, []);

  const formatPrice = (cents: number | null) => {
    if (cents === null) return "";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  const getWeeklyLimitLabel = (limit: string | null | undefined) => {
    if (!limit || limit === "99" || limit === "unlimited") return t("membership.page.unlimitedAccess");
    if (limit === "1") return t("membership.page.trainingsPerWeek", { count: 1 });
    return t("membership.page.trainingsPerWeek_plural", { count: parseInt(limit) });
  };

  const getPlanBenefit = (limit: string | null | undefined) => {
    if (!limit || limit === "99" || limit === "unlimited") return t("membership.page.trainEveryDay");
    if (limit === "1") return t("membership.page.idealStart");
    if (limit === "2") return t("membership.page.consistentProgress");
    if (limit === "3") return t("membership.page.acceleratedEvolution");
    return t("membership.page.trainEveryDay");
  };

  const handleSelectPlan = (link: PaymentLinkInfo) => {
    setSelectedLink(link);
    resetForm();
    setIsTrialRequest(false);
    setFormStep(1);
    setIsModalOpen(true);
  };

  const handleTrialRequest = () => {
    setSelectedLink(null);
    resetForm();
    setIsTrialRequest(true);
    setFormStep(1);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setForm({
      firstName: "", lastName: "", gender: "", phone: "", email: "", ageGroup: "adult",
      previousExperience: "", experienceDuration: "", modalitiesInterest: [],
      trainingType: "", mainGoal: "", availability: "", hasInjury: "",
    });
  };

  const validateStep1 = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.gender || !form.phone.trim() || !form.email.trim() || !form.ageGroup) {
      toast({ title: t("membership.page.form.requiredFields"), description: t("membership.page.form.fillAllFields"), variant: "destructive" });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast({ title: t("membership.page.form.invalidEmail"), description: t("membership.page.form.invalidEmailDesc"), variant: "destructive" });
      return false;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9) {
      toast({ title: t("membership.page.form.invalidPhone"), description: t("membership.page.form.invalidPhoneDesc"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.previousExperience || !form.trainingType || !form.mainGoal || !form.availability || !form.hasInjury || form.modalitiesInterest.length === 0) {
      toast({ title: t("membership.page.form.requiredFields"), description: t("membership.page.form.fillAllFields"), variant: "destructive" });
      return false;
    }
    if (form.previousExperience === "yes" && !form.experienceDuration) {
      toast({ title: t("membership.page.form.requiredFields"), description: t("membership.page.form.fillAllFields"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) setFormStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formStep === 1) {
      handleNextStep();
      return;
    }
    if (!validateStep2()) return;

    setIsSubmitting(true);
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;

    try {
      // For trial request, redirect to WhatsApp
      if (isTrialRequest) {
        const message = encodeURIComponent(
          `Olá! Gostaria de agendar uma aula experimental.\n\n` +
          `Nome: ${fullName}\n` +
          `Telefone: ${form.phone}\n` +
          `Email: ${form.email}\n` +
          `Faixa etária: ${form.ageGroup}\n` +
          `Sexo: ${form.gender}\n` +
          `Experiência anterior: ${form.previousExperience === "yes" ? `Sim (${form.experienceDuration})` : "Não"}\n` +
          `Modalidades: ${form.modalitiesInterest.join(", ")}\n` +
          `Tipo de treino: ${form.trainingType}\n` +
          `Objetivo: ${form.mainGoal}\n` +
          `Disponibilidade: ${form.availability}\n` +
          `Lesão/limitação: ${form.hasInjury}`
        );
        window.location.href = `https://wa.me/351913378459?text=${message}`;
        return;
      }

      if (!selectedLink) return;

      const { data: existingMember } = await supabase
        .from("members")
        .select("id, status, qr_code")
        .or(`email.eq.${form.email},telefone.eq.${form.phone}`)
        .maybeSingle();

      let memberId: string;

      if (existingMember) {
        memberId = existingMember.id;
        if (existingMember.status === "ATIVO") {
          toast({ title: t("membership.page.form.alreadyActive"), description: t("membership.page.form.alreadyActiveDesc"), variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
      } else {
        const { data: newMember, error: insertError } = await supabase
          .from("members")
          .insert({
            nome: fullName,
            telefone: form.phone.trim(),
            email: form.email.trim().toLowerCase(),
            status: "LEAD",
            sexo: form.gender,
            data_nascimento: null, // Could calculate from age group if needed
          })
          .select("id")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            toast({ title: t("membership.page.form.alreadyExists"), description: t("membership.page.form.alreadyExistsDesc"), variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
          throw insertError;
        }
        memberId = newMember.id;
      }

      localStorage.setItem("pending_member_id", memberId);
      const paymentUrl = `${selectedLink.url}?client_reference_id=${memberId}&prefilled_email=${encodeURIComponent(form.email.trim().toLowerCase())}`;
      window.location.href = paymentUrl;
    } catch (err) {
      console.error("Error:", err);
      toast({ title: t("membership.page.form.error"), description: t("membership.page.form.errorDesc"), variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  const toggleModality = (modality: string) => {
    setForm(prev => ({
      ...prev,
      modalitiesInterest: prev.modalitiesInterest.includes(modality)
        ? prev.modalitiesInterest.filter(m => m !== modality)
        : [...prev.modalitiesInterest, modality]
    }));
  };

  // Group and sort links
  const groupedLinks = links.reduce((acc, link) => {
    let category = "outros";
    const name = link.displayName.toLowerCase();
    if (name.includes("family") || name.includes("friends")) category = "special";
    else if (name.includes("1x")) category = "basico";
    else if (name.includes("2x")) category = "regular";
    else if (name.includes("3x")) category = "frequente";
    else if (name.includes("ilimitado")) category = "ilimitado";
    else if (name.includes("passe livre")) category = "premium";
    else if (name.includes("trimestral") || name.includes("semestral") || name.includes("anual")) category = "compromisso";
    if (!acc[category]) acc[category] = [];
    acc[category].push(link);
    return acc;
  }, {} as Record<string, PaymentLinkInfo[]>);

  Object.keys(groupedLinks).forEach((key) => {
    groupedLinks[key].sort((a, b) => (a.planPriceCents || 0) - (b.planPriceCents || 0));
  });

  const sortedLinks = [
    ...(groupedLinks.basico || []), ...(groupedLinks.regular || []), ...(groupedLinks.frequente || []),
    ...(groupedLinks.ilimitado || []), ...(groupedLinks.premium || []), ...(groupedLinks.compromisso || []),
    ...(groupedLinks.special || []), ...(groupedLinks.outros || []),
  ];

  const benefits = [
    { icon: Zap, key: "reflexes" }, { icon: Shield, key: "confidence" }, { icon: Target, key: "focus" },
    { icon: Users, key: "community" }, { icon: Clock, key: "consistency" }, { icon: Award, key: "growth" },
  ];

  const modalities = [
    { key: "boxing", name: t("membership.page.modalities.boxing.name"), description: t("membership.page.modalities.boxing.description") },
    { key: "muayThai", name: t("membership.page.modalities.muayThai.name"), description: t("membership.page.modalities.muayThai.description") },
    { key: "bjj", name: t("membership.page.modalities.bjj.name"), description: t("membership.page.modalities.bjj.description") },
    { key: "mma", name: t("membership.page.modalities.mma.name"), description: t("membership.page.modalities.mma.description") },
  ];

  const faqCategories = ["classes", "modalities", "enrollment", "facilities"];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-24">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
        <OctagonFrame className="absolute top-20 right-10 w-64 h-64 opacity-10 rotate-12" strokeWidth={0.5} />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.4em] text-accent uppercase mb-6">{t("membership.page.heroTagline")}</p>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-light tracking-[0.1em] mb-8 leading-tight">
              {t("membership.page.heroTitle1")}<br />
              <span className="text-accent">{t("membership.page.heroTitle2")}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed mb-10">
              {t("membership.page.heroDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8" onClick={handleTrialRequest}>{t("membership.page.trialCta")}</Button>
              <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}>
                {t("membership.page.viewPlans")}
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 bg-charcoal">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }} className="text-center">
                <benefit.icon className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="font-medium text-sm mb-1">{t(`membership.page.benefits.${benefit.key}`)}</h3>
                <p className="text-xs text-muted-foreground">{t(`membership.page.benefits.${benefit.key}Desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 bg-background relative overflow-hidden">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">
              {t("membership.page.videoTitle")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("membership.page.videoDescription")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative aspect-video bg-charcoal border border-border rounded-lg overflow-hidden group">
              {/* TODO: Replace with actual YouTube/Vimeo embed or video URL */}
              {/* Example YouTube embed:
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/VIDEO_ID"
                title="Striker's House"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              */}

              {/* Placeholder until video is provided */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${heroImage})` }}
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-colors group-hover:bg-black/40">
                <a
                  href="https://www.instagram.com/strikershouse/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-20 h-20 rounded-full bg-accent/90 flex items-center justify-center transition-transform group-hover:scale-110"
                >
                  <Play className="w-8 h-8 text-accent-foreground ml-1" />
                </a>
              </div>

              {/* Caption overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-sm text-white/90 font-light">
                  {t("membership.page.videoCta")}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modalities Section */}
      <section className="py-20 bg-background relative overflow-hidden">
        <OctagonFrame className="absolute -right-32 top-1/4 w-[400px] h-[400px] opacity-5 rotate-12" strokeWidth={0.4} showInner={false} />
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="text-center mb-16">
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">{t("membership.page.modalitiesTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("membership.page.modalitiesDescription")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modalities.map((mod, index) => (
              <motion.div key={mod.key} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }} className="p-6 border border-border bg-card hover:border-accent/50 transition-colors">
                <h3 className="text-xl font-light tracking-wider mb-3 text-accent">{mod.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Plans */}
      <section id="planos" className="py-20 bg-charcoal relative overflow-hidden">
        <OctagonFrame className="absolute -left-32 top-1/4 w-[400px] h-[400px] opacity-5 -rotate-12" strokeWidth={0.4} showInner={false} />
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="text-center mb-16">
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">{t("membership.page.plansTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("membership.page.plansDescription")}</p>
          </motion.div>

          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <span className="ml-3 text-muted-foreground">A carregar planos...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          )}

          {!loading && !error && sortedLinks.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedLinks.map((link, index) => {
                const isPopular = link.displayName.toLowerCase().includes("ilimitado") && !link.displayName.toLowerCase().includes("passe");
                const isPremium = link.displayName.toLowerCase().includes("passe livre");
                const isSpecial = link.metadata.special === "family_friends";

                // Clean display name - remove price and enrollment text
                const cleanName = link.displayName
                  .replace(/\s*\+\s*Matr[íi]cula/gi, "")
                  .replace(/\s*€\d+\/mês/gi, "")
                  .replace(/\s*€\d+/gi, "")
                  .trim();

                return (
                  <motion.div key={link.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.05 }}
                    className={`p-6 border relative flex flex-col ${isPopular ? "border-accent bg-accent/5 scale-105" : isPremium ? "border-yellow-500/50 bg-yellow-500/5" : isSpecial ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-card"}`}>
                    {isPopular && <div className="absolute -top-3 left-6 bg-accent text-accent-foreground px-3 py-1 text-xs tracking-wider uppercase">{t("membership.page.mostPopular")}</div>}
                    {isPremium && <div className="absolute -top-3 left-6 bg-yellow-500 text-black px-3 py-1 text-xs tracking-wider uppercase">{t("membership.page.premium")}</div>}
                    {isSpecial && <div className="absolute -top-3 left-6 bg-blue-500 text-white px-3 py-1 text-xs tracking-wider uppercase">{t("membership.page.special")}</div>}

                    <h3 className="text-lg font-light tracking-[0.05em] mb-2 mt-2">{cleanName}</h3>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-light text-accent">{formatPrice(link.planPriceCents)}</span>
                      <span className="text-sm text-muted-foreground">{t("membership.page.perMonth")}</span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4">{t("membership.page.enrollmentFee")}</p>

                    <ul className="space-y-2 mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{getWeeklyLimitLabel(link.metadata.weekly_limit)}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {link.metadata.modalities_count === "1"
                            ? t("membership.page.oneModality")
                            : t("membership.page.allModalities")}
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{getPlanBenefit(link.metadata.weekly_limit)}</span>
                      </li>
                    </ul>

                    <Button variant={isPopular ? "default" : "outline"} className="w-full mt-auto" onClick={() => handleSelectPlan(link)}>{t("membership.page.startNow")}</Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Trial CTA */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="text-center mt-16 p-8 border border-dashed border-accent/30 bg-accent/5">
            <h3 className="text-xl font-light tracking-wider mb-3">{t("membership.page.stillDoubtful")}</h3>
            <p className="text-muted-foreground mb-6">{t("membership.page.tryFreeClass")}</p>
            <Button variant="outline" onClick={handleTrialRequest}>{t("membership.page.bookTrial")}</Button>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="text-center mb-16">
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">{t("membership.page.faqTitle")}</h2>
            <p className="text-muted-foreground">{t("membership.page.faqDescription")}</p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            {faqCategories.map((cat, catIndex) => (
              <motion.div key={cat} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: catIndex * 0.1 }} className="mb-8">
                <h3 className="text-lg font-medium text-accent mb-4 tracking-wider">{t(`membership.page.faq.${cat}.title`)}</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {[1, 2, 3, 4].map((i) => {
                    const question = t(`membership.page.faq.${cat}.q${i}`, { defaultValue: "" });
                    const answer = t(`membership.page.faq.${cat}.a${i}`, { defaultValue: "" });
                    if (!question) return null;
                    return (
                      <AccordionItem key={i} value={`${cat}-${i}`} className="border border-border bg-card px-4">
                        <AccordionTrigger className="text-left text-sm hover:no-underline hover:text-accent">{question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-sm">{answer}</AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-charcoal">
        <div className="container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">{t("membership.page.finalCtaTitle")}</h2>
            <p className="text-muted-foreground font-light mb-8 text-lg">{t("membership.page.finalCtaDescription")}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8" onClick={handleTrialRequest}>{t("membership.page.freeClass")}</Button>
              <Button size="lg" variant="outline" className="px-8" asChild>
                <a href="https://wa.me/351913378459" target="_blank" rel="noopener noreferrer">{t("membership.page.whatsapp")}</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />

      {/* Multi-Step Signup Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isTrialRequest ? t("membership.page.form.trialTitle") : t("membership.page.form.signupTitle")}</DialogTitle>
            <DialogDescription>
              {isTrialRequest ? t("membership.page.form.trialDescription") : selectedLink && (
                <>
                  {t("membership.page.form.plan")}: <strong>{selectedLink.displayName.replace(/\s*\+\s*Matr[íi]cula/gi, "").replace(/\s*€\d+\/mês/gi, "").replace(/\s*€\d+/gi, "").trim()}</strong><br />
                  {t("membership.page.form.value")}: <strong>{formatPrice(selectedLink.planPriceCents)}{t("membership.page.perMonth")}</strong>
                  <span className="text-xs ml-1">{t("membership.page.form.includesEnrollment")}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 py-2">
            <div className={`h-1 flex-1 rounded ${formStep >= 1 ? "bg-accent" : "bg-border"}`} />
            <div className={`h-1 flex-1 rounded ${formStep >= 2 ? "bg-accent" : "bg-border"}`} />
          </div>
          <p className="text-xs text-muted-foreground text-center mb-4">
            {formStep === 1 ? t("membership.page.form.step1") : t("membership.page.form.step2")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formStep === 1 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-xs">{t("membership.page.form.firstName")} *</Label>
                    <Input id="firstName" placeholder={t("membership.page.form.firstNamePlaceholder")} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={isSubmitting} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-xs">{t("membership.page.form.lastName")} *</Label>
                    <Input id="lastName" placeholder={t("membership.page.form.lastNamePlaceholder")} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={isSubmitting} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.gender")} *</Label>
                  <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="male" id="male" /><Label htmlFor="male" className="text-sm font-normal">{t("membership.page.form.genderMale")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="female" id="female" /><Label htmlFor="female" className="text-sm font-normal">{t("membership.page.form.genderFemale")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="other" /><Label htmlFor="other" className="text-sm font-normal">{t("membership.page.form.genderOther")}</Label></div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs">{t("membership.page.form.phone")} *</Label>
                    <Input id="phone" type="tel" placeholder={t("membership.page.form.phonePlaceholder")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={isSubmitting} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs">{t("membership.page.form.email")} *</Label>
                    <Input id="email" type="email" placeholder={t("membership.page.form.emailPlaceholder")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={isSubmitting} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.ageGroup")} *</Label>
                  <RadioGroup value={form.ageGroup} onValueChange={(v) => setForm({ ...form, ageGroup: v })} className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="adult" id="adult" /><Label htmlFor="adult" className="text-sm font-normal">{t("membership.page.form.ageAdult")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="teen" id="teen" /><Label htmlFor="teen" className="text-sm font-normal">{t("membership.page.form.ageTeen")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="kids" id="kids" /><Label htmlFor="kids" className="text-sm font-normal">{t("membership.page.form.ageKids")}</Label></div>
                  </RadioGroup>
                </div>
              </>
            )}

            {formStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.previousExperience")} *</Label>
                  <RadioGroup value={form.previousExperience} onValueChange={(v) => setForm({ ...form, previousExperience: v, experienceDuration: v === "no" ? "" : form.experienceDuration })} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="exp-yes" /><Label htmlFor="exp-yes" className="text-sm font-normal">{t("membership.page.form.yes")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="exp-no" /><Label htmlFor="exp-no" className="text-sm font-normal">{t("membership.page.form.no")}</Label></div>
                  </RadioGroup>
                </div>

                {form.previousExperience === "yes" && (
                  <div className="space-y-2 pl-4 border-l-2 border-accent/30">
                    <Label className="text-xs">{t("membership.page.form.experienceDuration")}</Label>
                    <RadioGroup value={form.experienceDuration} onValueChange={(v) => setForm({ ...form, experienceDuration: v })} className="grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="6mo" id="dur-6mo" /><Label htmlFor="dur-6mo" className="text-xs font-normal">{t("membership.page.form.duration6mo")}</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="1yr" id="dur-1yr" /><Label htmlFor="dur-1yr" className="text-xs font-normal">{t("membership.page.form.duration1yr")}</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="3yr" id="dur-3yr" /><Label htmlFor="dur-3yr" className="text-xs font-normal">{t("membership.page.form.duration3yr")}</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="3yr+" id="dur-3yr+" /><Label htmlFor="dur-3yr+" className="text-xs font-normal">{t("membership.page.form.duration3yrPlus")}</Label></div>
                    </RadioGroup>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.modalitiesInterest")} *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Muay Thai", "Boxe", "Jiu-Jitsu (BJJ)", "MMA"].map((mod) => (
                      <div key={mod} className="flex items-center space-x-2">
                        <Checkbox id={mod} checked={form.modalitiesInterest.includes(mod)} onCheckedChange={() => toggleModality(mod)} />
                        <Label htmlFor={mod} className="text-sm font-normal">{mod}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.trainingType")} *</Label>
                  <RadioGroup value={form.trainingType} onValueChange={(v) => setForm({ ...form, trainingType: v })} className="space-y-1">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="group" id="tt-group" /><Label htmlFor="tt-group" className="text-sm font-normal">{t("membership.page.form.trainingGroup")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="personal" id="tt-personal" /><Label htmlFor="tt-personal" className="text-sm font-normal">{t("membership.page.form.trainingPersonal")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="discuss" id="tt-discuss" /><Label htmlFor="tt-discuss" className="text-sm font-normal">{t("membership.page.form.trainingDiscuss")}</Label></div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.mainGoal")} *</Label>
                  <RadioGroup value={form.mainGoal} onValueChange={(v) => setForm({ ...form, mainGoal: v })} className="space-y-1">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="fitness" id="goal-fitness" /><Label htmlFor="goal-fitness" className="text-sm font-normal">{t("membership.page.form.goalFitness")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="selfdefense" id="goal-selfdefense" /><Label htmlFor="goal-selfdefense" className="text-sm font-normal">{t("membership.page.form.goalSelfDefense")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="competition" id="goal-competition" /><Label htmlFor="goal-competition" className="text-sm font-normal">{t("membership.page.form.goalCompetition")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="weightloss" id="goal-weightloss" /><Label htmlFor="goal-weightloss" className="text-sm font-normal">{t("membership.page.form.goalWeightLoss")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="discipline" id="goal-discipline" /><Label htmlFor="goal-discipline" className="text-sm font-normal">{t("membership.page.form.goalDiscipline")}</Label></div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.availability")} *</Label>
                  <RadioGroup value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })} className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="morning" id="avail-morning" /><Label htmlFor="avail-morning" className="text-sm font-normal">{t("membership.page.form.availMorning")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="afternoon" id="avail-afternoon" /><Label htmlFor="avail-afternoon" className="text-sm font-normal">{t("membership.page.form.availAfternoon")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="evening" id="avail-evening" /><Label htmlFor="avail-evening" className="text-sm font-normal">{t("membership.page.form.availEvening")}</Label></div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.hasInjury")} *</Label>
                  <RadioGroup value={form.hasInjury} onValueChange={(v) => setForm({ ...form, hasInjury: v })} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="injury-no" /><Label htmlFor="injury-no" className="text-sm font-normal">{t("membership.page.form.no")}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="injury-yes" /><Label htmlFor="injury-yes" className="text-sm font-normal">{t("membership.page.form.yes")}</Label></div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {formStep === 1 ? (
                <>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>{t("membership.page.form.cancel")}</Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>{t("membership.page.form.next")}</Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setFormStep(1)} disabled={isSubmitting}>{t("membership.page.form.back")}</Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("membership.page.form.processing")}</>) : isTrialRequest ? t("membership.page.form.bookClass") : t("membership.page.form.continuePayment")}
                  </Button>
                </>
              )}
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isTrialRequest ? t("membership.page.form.trialConfirmation") : t("membership.page.form.paymentConfirmation")}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Membership;
