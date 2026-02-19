import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  Loader2,
  ChevronDown,
  Play,
  HelpCircle,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OctagonFrame from "@/components/OctagonFrame";
import WhyDifferent from "@/components/WhyDifferent";
import Kids from "@/components/Kids";
import heroImage from "@/assets/hero-editorial.jpg";
import trainingImg from "@/assets/training-calm.jpg";
import glovesImg from "@/assets/gloves-detail.jpg";
import mmaImg from "@/assets/mma.jpg";
import { supabase } from "@/integrations/supabase/client";

interface PaymentLinkInfo {
  id: string;
  url: string;
  displayName: string;
  priceAmountCents: number | null;
  planPriceCents: number | null;
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
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  ageGroup: string;
  previousExperience: string;
  experienceDuration: string;
  modalitiesInterest: string[];
  trainingType: string;
  mainGoal: string;
  availability: string;
  hasInjury: string;
}

const ENROLLMENT_FEE_CENTS = 1500;

const Index = () => {
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

  // Fetch payment links
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
              mensal: "1",
              trimestral: "3",
              semestral: "6",
              anual: "12",
            };

            const planPriceCents = row.amount_cents - ENROLLMENT_FEE_CENTS;
            const weeklyLimit =
              row.weekly_limit != null
                ? row.weekly_limit.toString()
                : row.frequencia === "unlimited"
                  ? null
                  : row.frequencia?.replace("x", "") || null;

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
    if (!limit || limit === "99" || limit === "unlimited")
      return t("membership.page.unlimitedAccess");
    if (limit === "1") return t("membership.page.trainingsPerWeek", { count: 1 });
    return t("membership.page.trainingsPerWeek_plural", { count: parseInt(limit) });
  };

  const getPlanBenefit = (limit: string | null | undefined) => {
    if (!limit || limit === "99" || limit === "unlimited")
      return t("membership.page.trainEveryDay");
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
  };

  const validateStep1 = () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.gender ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.ageGroup
    ) {
      toast({
        title: t("membership.page.form.requiredFields"),
        description: t("membership.page.form.fillAllFields"),
        variant: "destructive",
      });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast({
        title: t("membership.page.form.invalidEmail"),
        description: t("membership.page.form.invalidEmailDesc"),
        variant: "destructive",
      });
      return false;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9) {
      toast({
        title: t("membership.page.form.invalidPhone"),
        description: t("membership.page.form.invalidPhoneDesc"),
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (
      !form.previousExperience ||
      !form.trainingType ||
      !form.mainGoal ||
      !form.availability ||
      !form.hasInjury ||
      form.modalitiesInterest.length === 0
    ) {
      toast({
        title: t("membership.page.form.requiredFields"),
        description: t("membership.page.form.fillAllFields"),
        variant: "destructive",
      });
      return false;
    }
    if (form.previousExperience === "yes" && !form.experienceDuration) {
      toast({
        title: t("membership.page.form.requiredFields"),
        description: t("membership.page.form.fillAllFields"),
        variant: "destructive",
      });
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
          toast({
            title: t("membership.page.form.alreadyActive"),
            description: t("membership.page.form.alreadyActiveDesc"),
            variant: "destructive",
          });
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
            data_nascimento: null,
          })
          .select("id")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            toast({
              title: t("membership.page.form.alreadyExists"),
              description: t("membership.page.form.alreadyExistsDesc"),
              variant: "destructive",
            });
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
      toast({
        title: t("membership.page.form.error"),
        description: t("membership.page.form.errorDesc"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const toggleModality = (modality: string) => {
    setForm((prev) => ({
      ...prev,
      modalitiesInterest: prev.modalitiesInterest.includes(modality)
        ? prev.modalitiesInterest.filter((m) => m !== modality)
        : [...prev.modalitiesInterest, modality],
    }));
  };

  // Group and sort links - show only main 4 plans
  const mainPlans = links
    .filter((link) => {
      const name = link.displayName.toLowerCase();
      return (
        name.includes("1x") ||
        name.includes("2x") ||
        name.includes("3x") ||
        name.includes("ilimitado")
      );
    })
    .slice(0, 4);

  // Modalities for display
  const modalities = [
    {
      key: "boxing",
      name: t("membership.page.modalities.boxing.name"),
      description: t("membership.page.modalities.boxing.description"),
      image: glovesImg,
    },
    {
      key: "muayThai",
      name: t("membership.page.modalities.muayThai.name"),
      description: t("membership.page.modalities.muayThai.description"),
      image: trainingImg,
    },
    {
      key: "bjj",
      name: t("membership.page.modalities.bjj.name"),
      description: t("membership.page.modalities.bjj.description"),
      image: mmaImg,
    },
    {
      key: "mma",
      name: t("membership.page.modalities.mma.name"),
      description: t("membership.page.modalities.mma.description"),
      image: mmaImg,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-24">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <OctagonFrame
          className="absolute top-20 right-10 w-64 h-64 opacity-10 rotate-12"
          strokeWidth={0.5}
        />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <p className="text-xs tracking-[0.4em] text-accent uppercase mb-6">
              {t("membership.page.heroTagline")}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-light tracking-[0.1em] mb-8 leading-tight">
              {t("membership.page.heroTitle1")}
              <br />
              <span className="text-accent">{t("membership.page.heroTitle2")}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed mb-10">
              {t("membership.page.heroDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8" onClick={handleTrialRequest}>
                {t("membership.page.trialCta")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8"
                onClick={() =>
                  document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {t("membership.page.viewPlans")}
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      {/* Video Section */}
      <section className="py-20 bg-charcoal relative overflow-hidden">
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
            className="flex justify-center"
          >
            <div className="w-full max-w-[400px] aspect-[9/16] bg-background border border-border rounded-lg overflow-hidden">
              <iframe
                src="https://www.instagram.com/reel/DTgLl6ZCn6G/embed/"
                className="w-full h-full"
                frameBorder="0"
                scrolling="no"
                allowTransparency={true}
                allowFullScreen={true}
                title="Striker's House - Instagram Reel"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modalities Section */}
      <section className="py-20 bg-background relative overflow-hidden">
        <OctagonFrame
          className="absolute -right-32 top-1/4 w-[400px] h-[400px] opacity-5 rotate-12"
          strokeWidth={0.4}
          showInner={false}
        />
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">
              {t("membership.page.modalitiesTitle")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("membership.page.modalitiesDescription")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modalities.map((mod, index) => (
              <motion.div
                key={mod.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group relative overflow-hidden border border-border bg-card"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={mod.image}
                    alt={mod.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 border-t border-border">
                  <h3 className="text-lg font-light tracking-wider mb-2 text-accent">
                    {mod.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section id="planos" className="py-20 bg-charcoal relative overflow-hidden">
        <OctagonFrame
          className="absolute -left-32 top-1/4 w-[400px] h-[400px] opacity-5 -rotate-12"
          strokeWidth={0.4}
          showInner={false}
        />
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="section-line mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-4">
              {t("membership.page.plansTitle")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("membership.page.plansDescription")}
            </p>
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
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && mainPlans.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mainPlans.map((link, index) => {
                const isPopular =
                  link.displayName.toLowerCase().includes("ilimitado") &&
                  !link.displayName.toLowerCase().includes("passe");

                const cleanName = link.displayName
                  .replace(/\s*\+\s*Matr[íi]cula/gi, "")
                  .replace(/\s*€\d+\/mês/gi, "")
                  .replace(/\s*€\d+/gi, "")
                  .trim();

                return (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className={`p-6 border relative flex flex-col ${
                      isPopular
                        ? "border-accent bg-accent/5 scale-105"
                        : "border-border bg-card"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-6 bg-accent text-accent-foreground px-3 py-1 text-xs tracking-wider uppercase">
                        {t("membership.page.mostPopular")}
                      </div>
                    )}

                    <h3 className="text-lg font-light tracking-[0.05em] mb-2 mt-2">{cleanName}</h3>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-light text-accent">
                        {formatPrice(link.planPriceCents)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("membership.page.perMonth")}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4">
                      {t("membership.page.enrollmentFee")}
                    </p>

                    <ul className="space-y-2 mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {getWeeklyLimitLabel(link.metadata.weekly_limit)}
                        </span>
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
                        <span className="text-muted-foreground">
                          {getPlanBenefit(link.metadata.weekly_limit)}
                        </span>
                      </li>
                    </ul>

                    <Button
                      variant={isPopular ? "default" : "outline"}
                      className="w-full mt-auto"
                      onClick={() => handleSelectPlan(link)}
                    >
                      {t("membership.page.startNow")}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Trial CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mt-16 p-8 border border-dashed border-accent/30 bg-accent/5"
          >
            <h3 className="text-xl font-light tracking-wider mb-3">
              {t("membership.page.stillDoubtful")}
            </h3>
            <p className="text-muted-foreground mb-6">{t("membership.page.tryFreeClass")}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" onClick={handleTrialRequest}>
                {t("membership.page.bookTrial")}
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/faq" className="gap-2">
                  <HelpCircle className="w-4 h-4" />
                  {t("membership.page.faqTitle")}
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Different */}
      <WhyDifferent />

      {/* Kids */}
      <Kids />

      {/* Final CTA */}
      <section className="py-20 bg-charcoal">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] mb-6">
              {t("membership.page.finalCtaTitle")}
            </h2>
            <p className="text-muted-foreground font-light mb-8 text-lg">
              {t("membership.page.finalCtaDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8" onClick={handleTrialRequest}>
                {t("membership.page.freeClass")}
              </Button>
              <Button size="lg" variant="outline" className="px-8" asChild>
                <a
                  href="https://wa.me/351913378459"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("membership.page.whatsapp")}
                </a>
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
            <DialogTitle>
              {isTrialRequest
                ? t("membership.page.form.trialTitle")
                : t("membership.page.form.signupTitle")}
            </DialogTitle>
            <DialogDescription>
              {isTrialRequest
                ? t("membership.page.form.trialDescription")
                : selectedLink && (
                    <>
                      {t("membership.page.form.plan")}:{" "}
                      <strong>
                        {selectedLink.displayName
                          .replace(/\s*\+\s*Matr[íi]cula/gi, "")
                          .replace(/\s*€\d+\/mês/gi, "")
                          .replace(/\s*€\d+/gi, "")
                          .trim()}
                      </strong>
                      <br />
                      {t("membership.page.form.value")}:{" "}
                      <strong>
                        {formatPrice(selectedLink.planPriceCents)}
                        {t("membership.page.perMonth")}
                      </strong>
                      <span className="text-xs ml-1">
                        {t("membership.page.form.includesEnrollment")}
                      </span>
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
                    <Label htmlFor="firstName" className="text-xs">
                      {t("membership.page.form.firstName")} *
                    </Label>
                    <Input
                      id="firstName"
                      placeholder={t("membership.page.form.firstNamePlaceholder")}
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-xs">
                      {t("membership.page.form.lastName")} *
                    </Label>
                    <Input
                      id="lastName"
                      placeholder={t("membership.page.form.lastNamePlaceholder")}
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.gender")} *</Label>
                  <RadioGroup
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="text-sm font-normal">
                        {t("membership.page.form.genderMale")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="text-sm font-normal">
                        {t("membership.page.form.genderFemale")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="text-sm font-normal">
                        {t("membership.page.form.genderOther")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs">
                      {t("membership.page.form.phone")} *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={t("membership.page.form.phonePlaceholder")}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs">
                      {t("membership.page.form.email")} *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("membership.page.form.emailPlaceholder")}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.ageGroup")} *</Label>
                  <RadioGroup
                    value={form.ageGroup}
                    onValueChange={(v) => setForm({ ...form, ageGroup: v })}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="adult" id="adult" />
                      <Label htmlFor="adult" className="text-sm font-normal">
                        {t("membership.page.form.ageAdult")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="teen" id="teen" />
                      <Label htmlFor="teen" className="text-sm font-normal">
                        {t("membership.page.form.ageTeen")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="kids" id="kids" />
                      <Label htmlFor="kids" className="text-sm font-normal">
                        {t("membership.page.form.ageKids")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {formStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">
                    {t("membership.page.form.previousExperience")} *
                  </Label>
                  <RadioGroup
                    value={form.previousExperience}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        previousExperience: v,
                        experienceDuration: v === "no" ? "" : form.experienceDuration,
                      })
                    }
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="exp-yes" />
                      <Label htmlFor="exp-yes" className="text-sm font-normal">
                        {t("membership.page.form.yes")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="exp-no" />
                      <Label htmlFor="exp-no" className="text-sm font-normal">
                        {t("membership.page.form.no")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {form.previousExperience === "yes" && (
                  <div className="space-y-2 pl-4 border-l-2 border-accent/30">
                    <Label className="text-xs">
                      {t("membership.page.form.experienceDuration")}
                    </Label>
                    <RadioGroup
                      value={form.experienceDuration}
                      onValueChange={(v) => setForm({ ...form, experienceDuration: v })}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="6mo" id="dur-6mo" />
                        <Label htmlFor="dur-6mo" className="text-xs font-normal">
                          {t("membership.page.form.duration6mo")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1yr" id="dur-1yr" />
                        <Label htmlFor="dur-1yr" className="text-xs font-normal">
                          {t("membership.page.form.duration1yr")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="3yr" id="dur-3yr" />
                        <Label htmlFor="dur-3yr" className="text-xs font-normal">
                          {t("membership.page.form.duration3yr")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="3yr+" id="dur-3yr+" />
                        <Label htmlFor="dur-3yr+" className="text-xs font-normal">
                          {t("membership.page.form.duration3yrPlus")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">
                    {t("membership.page.form.modalitiesInterest")} *
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Muay Thai", "Boxe", "Jiu-Jitsu (BJJ)", "MMA"].map((mod) => (
                      <div key={mod} className="flex items-center space-x-2">
                        <Checkbox
                          id={mod}
                          checked={form.modalitiesInterest.includes(mod)}
                          onCheckedChange={() => toggleModality(mod)}
                        />
                        <Label htmlFor={mod} className="text-sm font-normal">
                          {mod}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.trainingType")} *</Label>
                  <RadioGroup
                    value={form.trainingType}
                    onValueChange={(v) => setForm({ ...form, trainingType: v })}
                    className="space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="group" id="tt-group" />
                      <Label htmlFor="tt-group" className="text-sm font-normal">
                        {t("membership.page.form.trainingGroup")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="personal" id="tt-personal" />
                      <Label htmlFor="tt-personal" className="text-sm font-normal">
                        {t("membership.page.form.trainingPersonal")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="discuss" id="tt-discuss" />
                      <Label htmlFor="tt-discuss" className="text-sm font-normal">
                        {t("membership.page.form.trainingDiscuss")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.mainGoal")} *</Label>
                  <RadioGroup
                    value={form.mainGoal}
                    onValueChange={(v) => setForm({ ...form, mainGoal: v })}
                    className="space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fitness" id="goal-fitness" />
                      <Label htmlFor="goal-fitness" className="text-sm font-normal">
                        {t("membership.page.form.goalFitness")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="selfdefense" id="goal-selfdefense" />
                      <Label htmlFor="goal-selfdefense" className="text-sm font-normal">
                        {t("membership.page.form.goalSelfDefense")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="competition" id="goal-competition" />
                      <Label htmlFor="goal-competition" className="text-sm font-normal">
                        {t("membership.page.form.goalCompetition")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weightloss" id="goal-weightloss" />
                      <Label htmlFor="goal-weightloss" className="text-sm font-normal">
                        {t("membership.page.form.goalWeightLoss")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="discipline" id="goal-discipline" />
                      <Label htmlFor="goal-discipline" className="text-sm font-normal">
                        {t("membership.page.form.goalDiscipline")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.availability")} *</Label>
                  <RadioGroup
                    value={form.availability}
                    onValueChange={(v) => setForm({ ...form, availability: v })}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="morning" id="avail-morning" />
                      <Label htmlFor="avail-morning" className="text-sm font-normal">
                        {t("membership.page.form.availMorning")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="afternoon" id="avail-afternoon" />
                      <Label htmlFor="avail-afternoon" className="text-sm font-normal">
                        {t("membership.page.form.availAfternoon")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="evening" id="avail-evening" />
                      <Label htmlFor="avail-evening" className="text-sm font-normal">
                        {t("membership.page.form.availEvening")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("membership.page.form.hasInjury")} *</Label>
                  <RadioGroup
                    value={form.hasInjury}
                    onValueChange={(v) => setForm({ ...form, hasInjury: v })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="injury-no" />
                      <Label htmlFor="injury-no" className="text-sm font-normal">
                        {t("membership.page.form.no")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="injury-yes" />
                      <Label htmlFor="injury-yes" className="text-sm font-normal">
                        {t("membership.page.form.yes")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {formStep === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t("membership.page.form.cancel")}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {t("membership.page.form.next")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setFormStep(1)}
                    disabled={isSubmitting}
                  >
                    {t("membership.page.form.back")}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("membership.page.form.processing")}
                      </>
                    ) : isTrialRequest ? (
                      t("membership.page.form.bookClass")
                    ) : (
                      t("membership.page.form.continuePayment")
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isTrialRequest
              ? t("membership.page.form.trialConfirmation")
              : t("membership.page.form.paymentConfirmation")}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
