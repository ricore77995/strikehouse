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
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePricing } from '@/hooks/usePricing';
import { handleSupabaseError } from '@/lib/supabase-utils';
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

type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode; instant: boolean }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro', icon: <Banknote className="h-5 w-5" />, instant: true },
  { value: 'CARTAO', label: 'Cartão', icon: <CreditCard className="h-5 w-5" />, instant: true },
  { value: 'MBWAY', label: 'MBway', icon: <Smartphone className="h-5 w-5" />, instant: true },
  { value: 'TRANSFERENCIA', label: 'Transferência', icon: <Building2 className="h-5 w-5" />, instant: false },
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

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedMethod || !staffId) {
        throw new Error('Dados incompletos');
      }

      const subscriptionData = pricing.getSubscriptionData();
      if (!subscriptionData) {
        throw new Error('Erro ao calcular preço');
      }

      const isInstant = paymentMethods.find(m => m.value === selectedMethod)?.instant;
      const finalPrice = subscriptionData.final_price_cents;

      // Calculate expires_at based on current expiration if still valid
      let expiresAt = subscriptionData.expires_at;
      if (selectedMember.access_expires_at && new Date(selectedMember.access_expires_at) > new Date()) {
        // Extend from current expiration
        const currentExpires = new Date(selectedMember.access_expires_at);
        const daysToAdd = subscriptionData.commitment_months * 30;
        const newExpires = addDays(currentExpires, daysToAdd);
        expiresAt = newExpires.toISOString().split('T')[0];
      }

      if (isInstant) {
        // Direct payment - activate immediately

        // 1. Create subscription
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            member_id: selectedMember.id,
            modalities: subscriptionData.modalities,
            commitment_months: subscriptionData.commitment_months,
            calculated_price_cents: subscriptionData.calculated_price_cents,
            commitment_discount_pct: subscriptionData.commitment_discount_pct,
            promo_discount_pct: subscriptionData.promo_discount_pct,
            final_price_cents: subscriptionData.final_price_cents,
            enrollment_fee_cents: 0, // No enrollment fee for renewals
            starts_at: subscriptionData.starts_at,
            expires_at: expiresAt,
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
            access_expires_at: expiresAt,
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
            amount_cents: finalPrice,
            payment_method: selectedMethod,
            member_id: selectedMember.id,
            description: `Renovação: ${subscriptionData.commitment_months} mês(es), ${subscriptionData.modalities.length} modalidade(s)`,
            created_by: staffId,
          });

        if (txError) throw txError;

        // 4. Increment promo code uses if applicable
        await pricing.confirmPromoCode();

        return { type: 'instant' as const, finalPrice };
      } else {
        // Transfer - create pending payment
        const expiresAtPending = addDays(new Date(), 7);

        // Store subscription data in metadata for later creation
        const { error: pendingError } = await supabase
          .from('pending_payments')
          .insert({
            member_id: selectedMember.id,
            amount_cents: finalPrice,
            payment_method: selectedMethod,
            reference: `PAY-${Date.now()}`,
            expires_at: expiresAtPending.toISOString(),
            created_by: staffId,
            // Store subscription config in notes for pending payment confirmation
            notes: JSON.stringify({
              subscription_config: {
                modalities: subscriptionData.modalities,
                commitment_months: subscriptionData.commitment_months,
                calculated_price_cents: subscriptionData.calculated_price_cents,
                commitment_discount_pct: subscriptionData.commitment_discount_pct,
                promo_discount_pct: subscriptionData.promo_discount_pct,
                final_price_cents: subscriptionData.final_price_cents,
                commitment_discount_id: subscriptionData.commitment_discount_id,
                promo_discount_id: subscriptionData.promo_discount_id,
                expires_at: expiresAt,
              },
            }),
          });

        if (pendingError) throw pendingError;

        return { type: 'pending' as const, finalPrice };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });

      if (result.type === 'instant') {
        setPaymentSuccess({ member: selectedMember!, finalPrice: result.finalPrice });
        toast({ title: 'Pagamento confirmado! Membro ativado.' });
      } else {
        toast({
          title: 'Pagamento pendente criado',
          description: 'Aguardando confirmação da transferência.',
        });
        resetForm();
      }
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
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
    pricing.setPromoCode('');
  };

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery('');
    // Reset pricing selections
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
    pricing.setPromoCode('');
  };

  const handlePayment = () => {
    if (!selectedMember || !selectedMethod) {
      toast({ title: 'Selecione todos os campos', variant: 'destructive' });
      return;
    }
    if (pricing.selectedModalities.length === 0) {
      toast({ title: 'Selecione pelo menos uma modalidade', variant: 'destructive' });
      return;
    }
    paymentMutation.mutate();
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
                Configurar Subscrição
              </CardTitle>
              <CardDescription>Selecione modalidades, período e código promocional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {pricing.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Current subscription info */}
                  {currentSubscription && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Subscrição atual:</p>
                      <p className="text-sm">
                        {currentSubscription.modalities.length} modalidade(s) • {currentSubscription.commitment_months} mês(es) • {pricing.formatPrice(currentSubscription.final_price_cents)}/mês
                      </p>
                    </div>
                  )}

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
                    <label className="text-sm font-medium mb-3 block">Período de Compromisso</label>
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
                      Código Promocional
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o código promo..."
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
                        Código válido! -{pricing.breakdown.promo_discount_pct}% aplicado
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
                        <span className="text-sm font-medium">Cálculo do Preço</span>
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
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Method */}
        {selectedMember && ['ATIVO', 'BLOQUEADO'].includes(selectedMember.status) && pricing.selectedModalities.length > 0 && pricing.result.success && (
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
