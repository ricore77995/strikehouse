import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePricing } from '@/hooks/usePricing';
import { usePlans } from '@/hooks/usePlans';
import PlanSelector from '@/components/PlanSelector';
import type { Plan } from '@/types/pricing';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Tag,
  Percent,
  Dumbbell,
  Package,
  Settings,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const memberSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  telefone: z.string().trim().min(9, 'Telefone invalido').max(20, 'Telefone muito longo'),
  email: z.string().trim().email('Email invalido').max(255, 'Email muito longo').optional().or(z.literal('')),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface Member {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  qr_code: string;
  status: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
}

type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';

const Enrollment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { staffId } = useAuth();
  const queryClient = useQueryClient();

  // Pre-selected member from navigation state
  const preSelectedMember = location.state?.member as Member | undefined;

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [memberMode, setMemberMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(preSelectedMember || null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [enrollmentFeeOverride, setEnrollmentFeeOverride] = useState<string>('');
  const [autoRenew, setAutoRenew] = useState(false);

  // Pricing mode: plan (template) or custom (pricing engine)
  const [pricingMode, setPricingMode] = useState<'plan' | 'custom'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Fetch visible plans
  const { plans: visiblePlans, isLoading: isLoadingPlans } = usePlans();

  // Pricing engine hook
  const pricing = usePricing({
    memberStatus: selectedMember?.status || 'LEAD',
  });

  // Create member form
  const memberForm = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: { nome: '', telefone: '', email: '' },
  });

  // Search for LEAD and CANCELADO members
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['enrollment-members', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, nome, telefone, email, qr_code, status')
        .in('status', ['LEAD', 'CANCELADO'])
        .or(`nome.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Member[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Initialize enrollment fee when breakdown is ready
  useEffect(() => {
    if (pricing.breakdown && enrollmentFeeOverride === '') {
      setEnrollmentFeeOverride((pricing.breakdown.enrollment_fee_cents / 100).toFixed(2));
    }
  }, [pricing.breakdown, enrollmentFeeOverride]);

  // If member was pre-selected, start at step 2
  useEffect(() => {
    if (preSelectedMember) {
      setCurrentStep(2);
    }
  }, [preSelectedMember]);

  // Calculate final enrollment fee and price based on mode
  const enrollmentFeeCents = pricingMode === 'plan'
    ? selectedPlan?.enrollment_fee_cents ?? 0
    : Math.round(parseFloat(enrollmentFeeOverride || '0') * 100);

  const finalPriceCents = pricingMode === 'plan'
    ? selectedPlan?.preco_cents ?? 0
    : pricing.breakdown?.monthly_price_cents ?? 0;

  const totalCents = finalPriceCents + enrollmentFeeCents;

  // Create member mutation
  const createMemberMutation = useMutation({
    mutationFn: async (data: MemberFormData) => {
      // Check for existing member with same phone or email
      const orConditions = [`telefone.eq.${data.telefone}`];
      if (data.email) {
        orConditions.push(`email.eq.${data.email}`);
      }
      const { data: existing } = await supabase
        .from('members')
        .select('id, nome, telefone, email')
        .or(orConditions.join(','))
        .limit(1);

      if (existing && existing.length > 0) {
        const match = existing[0];
        const matchField = match.telefone === data.telefone ? 'telefone' : 'email';
        throw new Error(`Já existe membro com este ${matchField}: ${match.nome}`);
      }

      const { data: newMember, error } = await supabase
        .from('members')
        .insert({
          nome: data.nome,
          telefone: data.telefone,
          email: data.email || null,
          status: 'LEAD',
          qr_code: '',
        })
        .select('id, nome, telefone, email, qr_code, status')
        .single();
      if (error) throw error;
      return newMember as Member;
    },
    onSuccess: (newMember) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
      toast({ title: 'Membro criado!', description: `${newMember.nome} foi cadastrado como LEAD.` });
      setSelectedMember(newMember);
      memberForm.reset();
      setCurrentStep(2);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar membro',
        description: error instanceof Error ? error.message : 'Verifique os dados',
        variant: 'destructive',
      });
    },
  });

  // Enrollment mutation (instant payment)
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !paymentMethod || !staffId) {
        throw new Error('Missing required data');
      }

      // Build subscription data based on pricing mode
      let subscriptionData: {
        plan_id: string | null;
        modalities: string[];
        commitment_months: number;
        calculated_price_cents: number;
        commitment_discount_pct: number;
        promo_discount_pct: number;
        final_price_cents: number;
        commitment_discount_id: string | null;
        promo_discount_id: string | null;
        expires_at: string;
        description: string;
      };

      const today = new Date().toISOString().split('T')[0];

      if (pricingMode === 'plan') {
        if (!selectedPlan) throw new Error('No plan selected');

        const durationDays = selectedPlan.duracao_dias ?? 30;
        const expiresAt = addDays(new Date(), durationDays).toISOString().split('T')[0];

        subscriptionData = {
          plan_id: selectedPlan.id,
          modalities: selectedPlan.modalities || [],
          commitment_months: selectedPlan.commitment_months || 1,
          calculated_price_cents: selectedPlan.preco_cents,
          commitment_discount_pct: 0,
          promo_discount_pct: 0,
          final_price_cents: selectedPlan.preco_cents,
          commitment_discount_id: null,
          promo_discount_id: null,
          expires_at: expiresAt,
          description: `Plano: ${selectedPlan.nome}`,
        };
      } else {
        if (!pricing.breakdown) throw new Error('Invalid pricing data');

        const customData = pricing.getSubscriptionData();
        if (!customData) throw new Error('Invalid subscription data');

        subscriptionData = {
          plan_id: null,
          modalities: customData.modalities,
          commitment_months: customData.commitment_months,
          calculated_price_cents: customData.calculated_price_cents,
          commitment_discount_pct: customData.commitment_discount_pct,
          promo_discount_pct: customData.promo_discount_pct,
          final_price_cents: customData.final_price_cents,
          commitment_discount_id: customData.commitment_discount_id,
          promo_discount_id: customData.promo_discount_id,
          expires_at: customData.expires_at,
          description: `Subscricao: ${pricing.selectedModalities.length} modalidade(s), ${customData.commitment_months} mes(es)`,
        };
      }

      // 1. Create subscription record
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          member_id: selectedMember.id,
          plan_id: subscriptionData.plan_id,
          modalities: subscriptionData.modalities,
          commitment_months: subscriptionData.commitment_months,
          calculated_price_cents: subscriptionData.calculated_price_cents,
          commitment_discount_pct: subscriptionData.commitment_discount_pct,
          promo_discount_pct: subscriptionData.promo_discount_pct,
          final_price_cents: subscriptionData.final_price_cents,
          enrollment_fee_cents: enrollmentFeeCents,
          starts_at: today,
          expires_at: subscriptionData.expires_at,
          commitment_discount_id: subscriptionData.commitment_discount_id,
          promo_discount_id: subscriptionData.promo_discount_id,
          status: 'active',
          created_by: staffId,
          auto_renew: autoRenew,
        })
        .select()
        .single();

      if (subError) throw subError;

      // 2. Update member to ATIVO
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: subscriptionData.expires_at,
          current_subscription_id: subscription.id,
        })
        .eq('id', selectedMember.id);

      if (memberError) throw memberError;

      // 3. Increment promo code uses if applicable (custom mode only)
      if (pricingMode === 'custom' && subscriptionData.promo_discount_id) {
        await pricing.confirmPromoCode();
      }

      // 4. Create plan transaction
      const { error: planTxError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: subscriptionData.final_price_cents,
          payment_method: paymentMethod,
          member_id: selectedMember.id,
          description: subscriptionData.description,
          created_by: staffId,
        });

      if (planTxError) throw planTxError;

      // 5. Create enrollment fee transaction (if > 0)
      if (enrollmentFeeCents > 0) {
        const { error: feeTxError } = await supabase
          .from('transactions')
          .insert({
            type: 'RECEITA',
            category: 'TAXA_MATRICULA',
            amount_cents: enrollmentFeeCents,
            payment_method: paymentMethod,
            member_id: selectedMember.id,
            description: 'Taxa de Matricula',
            created_by: staffId,
          });
        if (feeTxError) throw feeTxError;
      }

      // 6. Update cash session if DINHEIRO
      if (paymentMethod === 'DINHEIRO') {
        const today = new Date().toISOString().split('T')[0];
        const { data: session } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('session_date', today)
          .eq('status', 'OPEN')
          .single();

        if (session) {
          await supabase
            .from('cash_sessions')
            .update({ total_cash_in_cents: session.total_cash_in_cents + totalCents })
            .eq('id', session.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsSuccess(true);
      toast({ title: 'Matricula concluida!', description: `${selectedMember?.nome} foi matriculado.` });
    },
    onError: (error) => {
      console.error('Enrollment error:', error);
      toast({ title: 'Erro na matricula', variant: 'destructive' });
    },
  });

  // Pending payment mutation (TRANSFERENCIA)
  const pendingPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !staffId) {
        throw new Error('Missing required data');
      }

      // Build metadata based on pricing mode
      let metadata: Record<string, unknown>;

      if (pricingMode === 'plan') {
        if (!selectedPlan) throw new Error('No plan selected');
        metadata = {
          pricing_mode: 'plan',
          plan_id: selectedPlan.id,
          plan_nome: selectedPlan.nome,
          enrollment_fee_cents: enrollmentFeeCents,
        };
      } else {
        if (!pricing.breakdown) throw new Error('Invalid pricing data');
        const subscriptionData = pricing.getSubscriptionData();
        if (!subscriptionData) throw new Error('Invalid subscription data');
        metadata = {
          pricing_mode: 'custom',
          subscription_data: subscriptionData,
          enrollment_fee_cents: enrollmentFeeCents,
        };
      }

      // Store subscription data in metadata for later activation
      const { error } = await supabase
        .from('pending_payments')
        .insert({
          member_id: selectedMember.id,
          amount_cents: totalCents,
          payment_method: 'TRANSFERENCIA',
          reference: selectedMember.status === 'LEAD' ? `ENR-${Date.now()}` : `REA-${Date.now()}`,
          expires_at: addDays(new Date(), 7).toISOString(),
          created_by: staffId,
          metadata,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({ title: 'Pagamento pendente criado' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar pagamento pendente', variant: 'destructive' });
    },
  });

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery('');
    setCurrentStep(2);
  };

  const handlePricingConfirm = () => {
    if (pricingMode === 'plan') {
      if (!selectedPlan) {
        toast({ title: 'Selecione um plano', variant: 'destructive' });
        return;
      }
    } else {
      if (pricing.selectedModalities.length === 0) {
        toast({ title: 'Selecione pelo menos uma modalidade', variant: 'destructive' });
        return;
      }
      if (!pricing.result.success) {
        toast({ title: pricing.result.error || 'Erro no calculo', variant: 'destructive' });
        return;
      }
    }
    setCurrentStep(3);
  };

  const handlePaymentConfirm = async () => {
    if (!paymentMethod) {
      toast({ title: 'Selecione um metodo de pagamento', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      if (paymentMethod === 'TRANSFERENCIA') {
        await pendingPaymentMutation.mutateAsync();
      } else {
        await enrollMutation.mutateAsync();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setMemberMode('search');
    setSelectedMember(null);
    setPaymentMethod('');
    setIsSuccess(false);
    setSearchQuery('');
    setEnrollmentFeeOverride('');
    setPricingMode('plan');
    setSelectedPlan(null);
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
    pricing.setPromoCode('');
    memberForm.reset();
  };

  // Get modality/plan names for display
  const getModalityNames = () => {
    if (pricingMode === 'plan' && selectedPlan) {
      return selectedPlan.nome;
    }
    return pricing.modalities
      .filter((m) => pricing.selectedModalities.includes(m.id))
      .map((m) => m.nome)
      .join(', ');
  };

  // Check if can proceed based on pricing mode
  const canProceed = pricingMode === 'plan'
    ? selectedPlan !== null
    : pricing.selectedModalities.length > 0 && pricing.result.success;

  if (isSuccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6 lg:p-8">
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Matricula Concluida!</CardTitle>
              <CardDescription>
                {paymentMethod === 'TRANSFERENCIA'
                  ? 'Pagamento pendente criado. O membro sera ativado apos confirmacao.'
                  : `${selectedMember?.nome} agora tem acesso ao ginasio.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Membro:</span>
                  <span className="font-semibold">{selectedMember?.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Modalidades:</span>
                  <span>{getModalityNames()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Compromisso:</span>
                  <span>{pricing.selectedCommitmentMonths} mes(es)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{pricing.formatPrice(totalCents)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => navigate('/staff/checkin')} className="flex-1">
                  Ir para Check-in
                </Button>
                <Button onClick={handleReset} className="flex-1 bg-accent hover:bg-accent/90">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nova Matricula
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl tracking-wider mb-1">MATRICULA</h1>
            <p className="text-muted-foreground text-sm">
              Matricular novo membro com selecao de modalidades
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${step === currentStep ? 'bg-accent text-white' : step < currentStep ? 'bg-green-600 text-white' : 'bg-secondary text-muted-foreground'}`}
              >
                {step < currentStep ? '✓' : step}
              </div>
              {step < 3 && (
                <div className={`h-0.5 w-16 ${step < currentStep ? 'bg-green-600' : 'bg-secondary'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select or Create Member */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Selecionar ou Criar Membro</CardTitle>
              <CardDescription>Busque um membro novo (LEAD) ou retornando (CANCELADO)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={memberMode} onValueChange={(v) => setMemberMode(v as 'search' | 'create')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Buscar Existente
                  </TabsTrigger>
                  <TabsTrigger value="create" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Criar Novo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Buscar por nome ou telefone</Label>
                    <Input
                      id="search"
                      placeholder="Digite pelo menos 2 caracteres..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus={memberMode === 'search'}
                    />
                  </div>

                  {isSearching && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {searchResults && searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => handleMemberSelect(member)}
                          className="p-4 border border-border rounded-lg hover:bg-accent/5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{member.nome}</p>
                              <p className="text-sm text-muted-foreground">{member.telefone}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${member.status === 'CANCELADO' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'}`}
                            >
                              {member.status === 'CANCELADO' ? 'Retornando' : 'Novo'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum membro LEAD encontrado</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="create" className="mt-4">
                  <Form {...memberForm}>
                    <form onSubmit={memberForm.handleSubmit((d) => createMemberMutation.mutate(d))} className="space-y-4">
                      <FormField
                        control={memberForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome completo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={memberForm.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone *</FormLabel>
                            <FormControl>
                              <Input placeholder="912345678" type="tel" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={memberForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (opcional)</FormLabel>
                            <FormControl>
                              <Input placeholder="email@exemplo.com" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={createMemberMutation.isPending}>
                        {createMemberMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                        Criar e Continuar
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Plan or Custom Pricing */}
        {currentStep === 2 && selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>2. Configurar Subscricao</CardTitle>
              <CardDescription>
                Membro: <strong>{selectedMember.nome}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing Mode Tabs */}
              <Tabs value={pricingMode} onValueChange={(v) => setPricingMode(v as 'plan' | 'custom')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="plan" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Planos
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Customizado
                  </TabsTrigger>
                </TabsList>

                {/* Plan Selection Tab */}
                <TabsContent value="plan" className="mt-4 space-y-4">
                  <PlanSelector
                    plans={visiblePlans}
                    selectedPlan={selectedPlan}
                    onSelect={setSelectedPlan}
                    isLoading={isLoadingPlans}
                  />

                  {/* Plan Summary */}
                  {selectedPlan && (
                    <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
                      <p className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                        Resumo
                      </p>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plano:</span>
                          <span>{selectedPlan.nome}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Mensal:</span>
                          <span>{pricing.formatPrice(selectedPlan.preco_cents)}</span>
                        </div>
                        {selectedPlan.enrollment_fee_cents > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxa Matricula:</span>
                            <span>{pricing.formatPrice(selectedPlan.enrollment_fee_cents)}</span>
                          </div>
                        )}
                        <Separator className="my-2" />
                        <div className="flex justify-between text-lg font-bold">
                          <span>TOTAL HOJE:</span>
                          <span className="text-accent">{pricing.formatPrice(totalCents)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Auto-Renewal for Plans */}
                  {selectedPlan && (
                    <div className="flex items-center space-x-3 p-3 border rounded-lg bg-secondary/30">
                      <Checkbox
                        id="autoRenewPlan"
                        checked={autoRenew}
                        onCheckedChange={(checked) => setAutoRenew(checked === true)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="autoRenewPlan" className="font-medium cursor-pointer">
                          Renovacao Automatica
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          A subscricao sera renovada automaticamente quando expirar
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Custom Pricing Tab */}
                <TabsContent value="custom" className="mt-4 space-y-6">
                  {pricing.isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Modalities Selection */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Dumbbell className="h-4 w-4" />
                          Modalidades
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {pricing.modalities.map((modality) => (
                            <div
                              key={modality.id}
                              onClick={() => pricing.toggleModality(modality.id)}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                pricing.selectedModalities.includes(modality.id)
                                  ? 'border-accent bg-accent/10'
                                  : 'border-border hover:border-accent/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox checked={pricing.selectedModalities.includes(modality.id)} />
                                <span className="text-sm font-medium">{modality.nome}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {pricing.selectedModalities.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {pricing.selectedModalities.length} modalidade(s) selecionada(s)
                          </p>
                        )}
                      </div>

                      {/* Commitment Period */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Periodo de Compromisso
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {pricing.commitmentPeriods.map((period) => (
                            <div
                              key={period.months}
                              onClick={() => pricing.setSelectedCommitmentMonths(period.months)}
                              className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                                pricing.selectedCommitmentMonths === period.months
                                  ? 'border-accent bg-accent/10'
                                  : 'border-border hover:border-accent/50'
                              }`}
                            >
                              <p className="font-semibold">{period.label}</p>
                              {pricing.commitmentDiscount.percentage > 0 && period.months === pricing.selectedCommitmentMonths && (
                                <Badge variant="secondary" className="text-xs mt-1 bg-green-500/20 text-green-600">
                                  -{pricing.commitmentDiscount.percentage}%
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Promo Code */}
                      <div className="space-y-2">
                        <Label htmlFor="promo" className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Codigo Promocional (opcional)
                        </Label>
                        <Input
                          id="promo"
                          placeholder="Ex: UNI15"
                          value={pricing.promoCode}
                          onChange={(e) => pricing.setPromoCode(e.target.value.toUpperCase())}
                          className="uppercase"
                        />
                        {pricing.promoCode && !pricing.result.success && pricing.result.error && (
                          <p className="text-xs text-red-500">{pricing.result.error}</p>
                        )}
                        {pricing.breakdown && pricing.breakdown.promo_discount_pct > 0 && (
                          <p className="text-xs text-green-600">
                            Desconto promocional aplicado: -{pricing.breakdown.promo_discount_pct}%
                          </p>
                        )}
                      </div>

                      {/* Enrollment Fee Override */}
                      <div className="space-y-2">
                        <Label htmlFor="enrollmentFee">Taxa de Matricula (EUR)</Label>
                        <Input
                          id="enrollmentFee"
                          type="number"
                          step="0.01"
                          min="0"
                          value={enrollmentFeeOverride}
                          onChange={(e) => setEnrollmentFeeOverride(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Valor padrao: {pricing.formatPrice(pricing.config.enrollment_fee_cents)}. Pode ajustar ou zerar.
                        </p>
                      </div>

                      {/* Auto-Renewal */}
                      <div className="flex items-center space-x-3 p-3 border rounded-lg bg-secondary/30">
                        <Checkbox
                          id="autoRenew"
                          checked={autoRenew}
                          onCheckedChange={(checked) => setAutoRenew(checked === true)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="autoRenew" className="font-medium cursor-pointer">
                            Renovacao Automatica
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            A subscricao sera renovada automaticamente quando expirar
                          </p>
                        </div>
                      </div>

                      {/* Price Breakdown */}
                      {pricing.breakdown && (
                        <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
                          <p className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                            Resumo de Precos
                          </p>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Base (1a modalidade):</span>
                              <span>{pricing.formatPrice(pricing.breakdown.base_price_cents)}</span>
                            </div>
                            {pricing.breakdown.extra_modalities_count > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  + {pricing.breakdown.extra_modalities_count} modalidade(s) extra:
                                </span>
                                <span>{pricing.formatPrice(pricing.breakdown.extra_modalities_cents)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal:</span>
                              <span>{pricing.formatPrice(pricing.breakdown.subtotal_cents)}</span>
                            </div>
                            {pricing.breakdown.commitment_discount_cents > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Desconto Compromisso (-{pricing.breakdown.commitment_discount_pct}%):</span>
                                <span>-{pricing.formatPrice(pricing.breakdown.commitment_discount_cents)}</span>
                              </div>
                            )}
                            {pricing.breakdown.promo_discount_cents > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Desconto Promo (-{pricing.breakdown.promo_discount_pct}%):</span>
                                <span>-{pricing.formatPrice(pricing.breakdown.promo_discount_cents)}</span>
                              </div>
                            )}
                            <Separator className="my-2" />
                            <div className="flex justify-between font-semibold">
                              <span>Mensal:</span>
                              <span>{pricing.formatPrice(pricing.breakdown.monthly_price_cents)}</span>
                            </div>
                            {enrollmentFeeCents > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Taxa Matricula:</span>
                                <span>{pricing.formatPrice(enrollmentFeeCents)}</span>
                              </div>
                            )}
                            <Separator className="my-2" />
                            <div className="flex justify-between text-lg font-bold">
                              <span>TOTAL HOJE:</span>
                              <span className="text-accent">{pricing.formatPrice(totalCents)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handlePricingConfirm}
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={!canProceed}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Method */}
        {currentStep === 3 && selectedMember && (pricingMode === 'plan' ? selectedPlan : pricing.breakdown) && (
          <Card>
            <CardHeader>
              <CardTitle>3. Metodo de Pagamento</CardTitle>
              <CardDescription>
                Total: <strong>{pricing.formatPrice(totalCents)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecione o metodo</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o metodo de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CARTAO">Cartao (TPA)</SelectItem>
                    <SelectItem value="MBWAY">MBWay</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia Bancaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'TRANSFERENCIA' && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-600 mb-1">Pagamento Pendente</p>
                      <p className="text-muted-foreground">
                        O membro sera ativado apenas apos o admin confirmar a transferencia.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
                <p className="font-semibold mb-2">Resumo da Matricula</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membro:</span>
                    <span>{selectedMember.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modalidades:</span>
                    <span className="text-right max-w-[60%]">{getModalityNames()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compromisso:</span>
                    <span>
                      {pricingMode === 'plan'
                        ? (selectedPlan?.commitment_months || 1)
                        : pricing.selectedCommitmentMonths} mes(es)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mensal:</span>
                    <span>{pricing.formatPrice(finalPriceCents)}</span>
                  </div>
                  {enrollmentFeeCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa Matricula:</span>
                      <span>{pricing.formatPrice(enrollmentFeeCents)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-accent">{pricing.formatPrice(totalCents)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1" disabled={isProcessing}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handlePaymentConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!paymentMethod || isProcessing}
                >
                  {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {paymentMethod === 'TRANSFERENCIA' ? 'Registrar Pendente' : 'Confirmar Matricula'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Enrollment;
