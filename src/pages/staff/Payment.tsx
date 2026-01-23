import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePricing } from '@/hooks/usePricing';
import { usePlans } from '@/hooks/usePlans';
import PlanSelector from '@/components/PlanSelector';
import { handleSupabaseError } from '@/lib/supabase-utils';
import type { Plan } from '@/types/pricing';
import { createCheckoutSession, mapCommitmentMonthsToPeriod } from '@/api/stripe';
import type { CreateCheckoutSessionInput } from '@/api/stripe';
import {
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle,
  Loader2,
  AlertCircle,
  QrCode,
  Tag,
  Receipt,
  Calculator,
  X,
  ArrowRight,
  Calendar,
  UserPlus,
  Package,
  Settings,
  Info,
} from 'lucide-react';
import QuickMemberModal from '@/components/QuickMemberModal';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

interface Member {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
  credits_remaining: number | null;
  current_subscription_id: string | null;
  qr_code: string | null;
}

interface CurrentSubscription {
  id: string;
  modalities: string[];
  commitment_months: number;
  final_price_cents: number;
  expires_at: string | null;
}

type PaymentMethod = 'DINHEIRO' | 'STRIPE';

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode; instant: boolean }[] = [
  { value: 'DINHEIRO', label: '💵 Dinheiro (Pagamento Imediato)', icon: <Banknote className="h-5 w-5" />, instant: true },
  { value: 'STRIPE', label: '💳 Cartão (Stripe Checkout)', icon: <CreditCard className="h-5 w-5" />, instant: false },
];

const StaffPayment = () => {
  const navigate = useNavigate();
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showQuickMember, setShowQuickMember] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ member: Member; finalPrice: number } | null>(null);

  // Pricing mode: plan (template) or custom (pricing engine)
  const [pricingMode, setPricingMode] = useState<'plan' | 'custom'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Fetch visible plans
  const { plans: visiblePlans, isLoading: isLoadingPlans } = usePlans();

  // Pricing engine hook
  const pricing = usePricing({
    memberStatus: (selectedMember?.status as 'ATIVO' | 'BLOQUEADO' | 'CANCELADO') || 'ATIVO',
  });

  // Search members - only ATIVO and BLOQUEADO for renewals
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['member-search-renewals', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .or(`nome.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Member[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch member's current subscription if they have one
  const { data: currentSubscription } = useQuery({
    queryKey: ['current-subscription', selectedMember?.current_subscription_id],
    queryFn: async () => {
      if (!selectedMember?.current_subscription_id) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, modalities, commitment_months, final_price_cents, expires_at')
        .eq('id', selectedMember.current_subscription_id)
        .single();
      if (error) return null;
      return data as CurrentSubscription;
    },
    enabled: !!selectedMember?.current_subscription_id,
  });

  // Pre-populate from current subscription when loaded
  useEffect(() => {
    if (currentSubscription && selectedMember) {
      pricing.setSelectedModalities(currentSubscription.modalities);
      pricing.setSelectedCommitmentMonths(currentSubscription.commitment_months);
    }
  }, [currentSubscription, selectedMember]);

  // Calculate final price based on pricing mode
  const finalPriceCents = pricingMode === 'plan'
    ? selectedPlan?.preco_cents ?? 0
    : pricing.breakdown?.monthly_price_cents ?? 0;

  // Check if can proceed based on pricing mode
  const canProceed = pricingMode === 'plan'
    ? selectedPlan !== null
    : pricing.selectedModalities.length > 0 && pricing.result.success;

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedMethod || !staffId) {
        throw new Error('Dados incompletos');
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
        let expiresAt = addDays(new Date(), durationDays).toISOString().split('T')[0];

        // Extend from current expiration if still valid
        if (selectedMember.access_expires_at && new Date(selectedMember.access_expires_at) > new Date()) {
          const currentExpires = new Date(selectedMember.access_expires_at);
          expiresAt = addDays(currentExpires, durationDays).toISOString().split('T')[0];
        }

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
          description: `Renovacao: ${selectedPlan.nome}`,
        };
      } else {
        const customData = pricing.getSubscriptionData();
        if (!customData) throw new Error('Erro ao calcular preco');

        let expiresAt = customData.expires_at;
        // Extend from current expiration if still valid
        if (selectedMember.access_expires_at && new Date(selectedMember.access_expires_at) > new Date()) {
          const currentExpires = new Date(selectedMember.access_expires_at);
          const daysToAdd = customData.commitment_months * 30;
          expiresAt = addDays(currentExpires, daysToAdd).toISOString().split('T')[0];
        }

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
          expires_at: expiresAt,
          description: `Renovacao: ${customData.commitment_months} mes(es), ${customData.modalities.length} modalidade(s)`,
        };
      }

      // Only DINHEIRO uses this mutation now
      // STRIPE goes through handleStripeCheckout → webhook

      // 1. Create subscription
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
          enrollment_fee_cents: 0, // No enrollment fee for renewals
          starts_at: today,
          expires_at: subscriptionData.expires_at,
          commitment_discount_id: subscriptionData.commitment_discount_id,
          promo_discount_id: subscriptionData.promo_discount_id,
          status: 'active',
          created_by: staffId,
        })
        .select()
        .single();

      if (subError) throw subError;

      // 2. Update member
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

      // 3. Create transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: subscriptionData.final_price_cents,
          payment_method: selectedMethod,
          member_id: selectedMember.id,
          description: subscriptionData.description,
          created_by: staffId,
        });

      if (txError) throw txError;

      // 4. Increment promo code uses if applicable (custom mode only)
      if (pricingMode === 'custom' && subscriptionData.promo_discount_id) {
        await pricing.confirmPromoCode();
      }

      return { finalPrice: subscriptionData.final_price_cents };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });

      setPaymentSuccess({ member: selectedMember!, finalPrice: result.finalPrice });
      toast({ title: 'Pagamento confirmado! Membro ativado.' });
    },
    onError: (error) => {
      const message = handleSupabaseError(error, 'processar pagamento');
      toast({ title: message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSelectedMember(null);
    setSelectedMethod(null);
    setSearchQuery('');
    setPaymentSuccess(null);
    setPricingMode('plan');
    setSelectedPlan(null);
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
    pricing.setPromoCode('');
  };

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery('');
    // Reset pricing selections
    setPricingMode('plan');
    setSelectedPlan(null);
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
    pricing.setPromoCode('');
  };

  const handleStripeCheckout = async () => {
    if (!selectedMember || !staffId) {
      toast({ title: 'Dados inválidos', variant: 'destructive' });
      return;
    }

    let planId: string;
    let modalityIds: string[];
    let commitmentMonths: number;

    if (pricingMode === 'plan') {
      if (!selectedPlan) {
        toast({ title: 'Selecione um plano', variant: 'destructive' });
        return;
      }
      planId = selectedPlan.id;
      modalityIds = selectedPlan.modalities || [];
      commitmentMonths = selectedPlan.commitment_months || 1;
    } else {
      // Custom mode
      const subscriptionData = pricing.getSubscriptionData();
      if (!subscriptionData) {
        toast({ title: 'Dados de pricing inválidos', variant: 'destructive' });
        return;
      }
      // For custom mode, we need a plan_id (use null and let backend handle)
      toast({ title: 'Modo custom não suportado com Stripe ainda', variant: 'destructive' });
      return;
    }

    const commitmentPeriod = mapCommitmentMonthsToPeriod(commitmentMonths);

    // Get promo code ID if applied
    let promoCodeId: string | undefined;
    if (pricing.promoCode && pricing.result.success) {
      const { data: promoData } = await supabase
        .from('promo_codes')
        .select('id')
        .ilike('code', pricing.promoCode)
        .single();
      if (promoData) {
        promoCodeId = promoData.id;
      }
    }

    const input: CreateCheckoutSessionInput = {
      memberId: selectedMember.id,
      memberEmail: selectedMember.email || `${selectedMember.telefone}@noemail.com`,
      memberName: selectedMember.nome,
      memberStatus: selectedMember.status as 'LEAD' | 'BLOQUEADO' | 'CANCELADO',
      planId,
      modalityIds,
      commitmentPeriod,
      promoCodeId,
      chargeEnrollmentFee: false, // No enrollment fee for renewals
      staffId,
    };

    console.log('Creating Stripe checkout session for renewal:', input);

    const result = await createCheckoutSession(input);

    if (result.success) {
      console.log('Redirecting to Stripe:', result.checkoutUrl);
      window.location.href = result.checkoutUrl;
    } else {
      console.error('Failed to create checkout session:', result);
      toast({
        title: 'Erro ao criar checkout',
        description: result.message || result.error,
        variant: 'destructive',
      });
    }
  };

  const handlePayment = async () => {
    if (!selectedMember || !selectedMethod) {
      toast({ title: 'Selecione todos os campos', variant: 'destructive' });
      return;
    }
    if (!canProceed) {
      toast({
        title: pricingMode === 'plan' ? 'Selecione um plano' : 'Selecione pelo menos uma modalidade',
        variant: 'destructive',
      });
      return;
    }

    // If STRIPE, redirect to Stripe Checkout
    if (selectedMethod === 'STRIPE') {
      await handleStripeCheckout();
    } else {
      // DINHEIRO - instant activation
      paymentMutation.mutate();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Ativo</Badge>;
      case 'BLOQUEADO':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Bloqueado</Badge>;
      case 'LEAD':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Novo</Badge>;
      case 'CANCELADO':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Success screen
  if (paymentSuccess) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full bg-green-500/10 border-green-500/30">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl uppercase tracking-wider mb-2">Pagamento Confirmado</h2>
              <p className="text-lg font-medium mb-1">{paymentSuccess.member.nome}</p>
              <p className="text-muted-foreground mb-4">Renovação de subscrição</p>
              <p className="text-2xl font-bold text-green-500 mb-6">
                {pricing.formatPrice(paymentSuccess.finalPrice)}
              </p>

              <div className="flex gap-2">
                {paymentSuccess.member.qr_code && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`/m/${paymentSuccess.member.qr_code}`, '_blank')}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Ver QR
                  </Button>
                )}
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={resetForm}
                >
                  Novo Pagamento
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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">PAGAMENTO / RENOVAÇÃO</h1>
            <p className="text-muted-foreground text-sm">
              Renovar subscrição de membro existente
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowQuickMember(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Membro
          </Button>
        </div>

        {/* Step 1: Select Member */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs">1</span>
              Selecionar Membro
            </CardTitle>
            <CardDescription>Busque o membro para renovação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedMember ? (
              <>
                <div className="p-4 bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{selectedMember.nome}</p>
                        <p className="text-sm text-muted-foreground">{selectedMember.telefone}</p>
                      </div>
                      {getStatusBadge(selectedMember.status)}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Current access info */}
                  {selectedMember.access_expires_at && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Acesso até: {format(new Date(selectedMember.access_expires_at), 'dd/MM/yyyy')}
                        </span>
                        {new Date(selectedMember.access_expires_at) < new Date() && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                            Expirado
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* LEAD redirect alert */}
                {selectedMember.status === 'LEAD' && (
                  <Alert className="mt-3 border-yellow-500/50 bg-yellow-500/10">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertTitle className="text-sm font-medium">Novo Membro</AlertTitle>
                    <AlertDescription className="text-xs">
                      Este membro nunca foi ativado. Use a página de Matrícula.
                      <Button
                        variant="link"
                        className="h-auto p-0 ml-2 text-accent"
                        onClick={() => navigate('/staff/enrollment', { state: { member: selectedMember } })}
                      >
                        Ir para Matrícula →
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* CANCELADO decision alert */}
                {selectedMember.status === 'CANCELADO' && (
                  <Alert className="mt-3 border-blue-500/50 bg-blue-500/10">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <AlertTitle className="text-sm font-medium">Membro Cancelado</AlertTitle>
                    <AlertDescription className="text-xs space-y-3">
                      <p>Este membro já teve acesso cancelado. Deseja cobrar taxa de matrícula?</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-accent text-accent hover:bg-accent/10"
                          onClick={() => navigate('/staff/enrollment', { state: { member: selectedMember } })}
                        >
                          Sim - Com Taxa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled
                        >
                          Não - Continuar aqui
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-secondary border-border"
                  />
                  <Button variant="outline" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {isSearching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleMemberSelect(member)}
                        className="w-full p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.nome}</p>
                            <p className="text-sm text-muted-foreground">{member.telefone}</p>
                          </div>
                          {getStatusBadge(member.status)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum membro encontrado
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Configure Subscription - Only show if member is ATIVO or BLOQUEADO */}
        {selectedMember && ['ATIVO', 'BLOQUEADO'].includes(selectedMember.status) && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs">2</span>
                Configurar Subscricao
              </CardTitle>
              <CardDescription>Selecione um plano ou configure manualmente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current subscription info */}
              {currentSubscription && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Subscricao atual:</p>
                  <p className="text-sm">
                    {currentSubscription.modalities.length} modalidade(s) • {currentSubscription.commitment_months} mes(es) • {pricing.formatPrice(currentSubscription.final_price_cents)}/mes
                  </p>
                </div>
              )}

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
                    <div className="p-4 bg-secondary rounded-lg space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">Resumo</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Plano:</span>
                        <span>{selectedPlan.nome}</span>
                      </div>
                      <div className="border-t border-border pt-2 mt-2">
                        <div className="flex justify-between font-medium text-base">
                          <span>Total Mensal</span>
                          <span className="text-accent">{pricing.formatPrice(selectedPlan.preco_cents)}</span>
                        </div>
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
                      {/* Modality Selection */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Modalidades</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {pricing.modalities.map((modality) => (
                            <label
                              key={modality.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                pricing.selectedModalities.includes(modality.id)
                                  ? 'bg-accent/20 border-accent'
                                  : 'bg-secondary border-transparent hover:bg-secondary/80'
                              )}
                            >
                              <Checkbox
                                checked={pricing.selectedModalities.includes(modality.id)}
                                onCheckedChange={() => pricing.toggleModality(modality.id)}
                              />
                              <span className="text-sm font-medium">{modality.nome}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Commitment Period Selection */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Periodo de Compromisso</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {pricing.commitmentPeriods.map((period) => (
                            <button
                              key={period.months}
                              onClick={() => pricing.setSelectedCommitmentMonths(period.months)}
                              className={cn(
                                'p-3 rounded-lg text-center transition-colors border',
                                pricing.selectedCommitmentMonths === period.months
                                  ? 'bg-accent/20 border-accent'
                                  : 'bg-secondary border-transparent hover:bg-secondary/80'
                              )}
                            >
                              <p className="font-medium text-sm">{period.label}</p>
                              {period.discount > 0 && (
                                <Badge className="mt-1 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                  -{period.discount}%
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Promo Code */}
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Codigo Promocional
                        </label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite o codigo promo..."
                            value={pricing.promoCode}
                            onChange={(e) => pricing.setPromoCode(e.target.value.toUpperCase())}
                            className="bg-secondary border-border font-mono uppercase"
                          />
                          {pricing.promoCode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => pricing.setPromoCode('')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {pricing.promoCode && pricing.result.success && pricing.breakdown?.promo_discount_pct && pricing.breakdown.promo_discount_pct > 0 && (
                          <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Codigo valido! -{pricing.breakdown.promo_discount_pct}% aplicado
                          </p>
                        )}
                        {pricing.promoCode && !pricing.result.success && pricing.result.error?.includes('promo') && (
                          <p className="text-xs text-red-500 mt-1">{pricing.result.error}</p>
                        )}
                      </div>

                      {/* Price Breakdown */}
                      {pricing.breakdown && pricing.result.success && (
                        <div className="p-4 bg-secondary rounded-lg space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="h-4 w-4 text-accent" />
                            <span className="text-sm font-medium">Calculo do Preco</span>
                          </div>

                          {/* Formula visualization */}
                          <div className="text-xs text-muted-foreground mb-3 p-2 bg-background/50 rounded font-mono">
                            P = (Base + (M-1) × Extra) × (1 - Compromisso) × (1 - Promo)
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Base ({pricing.selectedModalities.length} modalidade{pricing.selectedModalities.length > 1 ? 's' : ''})</span>
                              <span>{pricing.formatPrice(pricing.breakdown.subtotal_cents)}</span>
                            </div>

                            {pricing.breakdown.commitment_discount_pct > 0 && (
                              <div className="flex justify-between text-green-500">
                                <span>Desconto Compromisso ({pricing.commitmentDiscount.code})</span>
                                <span>-{pricing.breakdown.commitment_discount_pct}%</span>
                              </div>
                            )}

                            {pricing.breakdown.promo_discount_pct > 0 && (
                              <div className="flex justify-between text-green-500">
                                <span>Desconto Promo ({pricing.promoCode})</span>
                                <span>-{pricing.breakdown.promo_discount_pct}%</span>
                              </div>
                            )}

                            <div className="border-t border-border pt-2 mt-2">
                              <div className="flex justify-between font-medium text-base">
                                <span>Total Mensal</span>
                                <span className="text-accent">{pricing.formatPrice(pricing.breakdown.monthly_price_cents)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!pricing.result.success && pricing.selectedModalities.length > 0 && (
                        <Alert className="border-yellow-500/50 bg-yellow-500/10">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <AlertDescription className="text-sm">{pricing.result.error}</AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Method */}
        {selectedMember && ['ATIVO', 'BLOQUEADO'].includes(selectedMember.status) && canProceed && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs">3</span>
                Método de Pagamento
              </CardTitle>
              <CardDescription>Selecione como o pagamento será realizado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.value}
                    onClick={() => setSelectedMethod(method.value)}
                    className={cn(
                      'p-4 rounded-lg text-center transition-colors border flex flex-col items-center gap-2',
                      selectedMethod === method.value
                        ? 'bg-accent/20 border-accent'
                        : 'bg-secondary border-transparent hover:bg-secondary/80'
                    )}
                  >
                    {method.icon}
                    <span className="text-sm font-medium">{method.label}</span>
                    {!method.instant && (
                      <span className="text-xs text-yellow-500">Pendente</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary & Confirm */}
        {selectedMember && ['ATIVO', 'BLOQUEADO'].includes(selectedMember.status) && selectedMethod && pricing.result.success && pricing.breakdown && (
          <Card className="bg-card border-accent">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Resumo</p>
                  <p className="font-medium">{selectedMember.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {pricing.selectedModalities.length} modalidade(s) • {pricing.selectedCommitmentMonths} mês(es) • {paymentMethods.find(m => m.value === selectedMethod)?.label}
                    {selectedMethod === 'TRANSFERENCIA' && ' (pendente de confirmação)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent mb-2">
                    {pricing.formatPrice(pricing.breakdown.monthly_price_cents)}
                  </p>
                  <Button
                    onClick={handlePayment}
                    disabled={paymentMutation.isPending}
                    className="bg-accent hover:bg-accent/90 uppercase tracking-wider"
                  >
                    {paymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Member Modal */}
        <QuickMemberModal
          open={showQuickMember}
          onOpenChange={setShowQuickMember}
          onSuccess={(member) => {
            setSelectedMember({
              ...member,
              email: null,
              status: 'LEAD',
              access_type: null,
              access_expires_at: null,
              credits_remaining: null,
              current_subscription_id: null,
              qr_code: null,
            });
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default StaffPayment;
