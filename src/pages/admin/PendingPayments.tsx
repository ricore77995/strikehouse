import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  AlertTriangle,
  Building2,
  Phone,
  Calculator,
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';

interface SubscriptionConfig {
  modalities: string[];
  commitment_months: number;
  calculated_price_cents: number;
  commitment_discount_pct: number;
  promo_discount_pct: number;
  final_price_cents: number;
  commitment_discount_id: string | null;
  promo_discount_id: string | null;
  expires_at: string;
  enrollment_fee_cents?: number;
}

interface PendingPayment {
  id: string;
  member_id: string;
  plan_id: string | null;
  amount_cents: number;
  payment_method: string;
  reference: string;
  status: string;
  expires_at: string;
  created_at: string;
  notes: string | null;
  member: {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
    status: string;
    access_type: string | null;
    access_expires_at: string | null;
    credits_remaining: number | null;
  };
  plan: {
    id: string;
    nome: string;
    tipo: string;
    duracao_dias: number | null;
    creditos: number | null;
    preco_cents: number;
  } | null;
}

interface MemberIban {
  id: string;
  iban: string;
  label: string | null;
  is_primary: boolean;
}

const PendingPayments = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchIban, setSearchIban] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [matchedMember, setMatchedMember] = useState<{ member: PendingPayment['member']; iban: string } | null>(null);
  const [newIbanToSave, setNewIbanToSave] = useState('');
  const [saveNewIban, setSaveNewIban] = useState(false);

  // Fetch pending payments
  const { data: pendingPayments, isLoading } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_payments')
        .select(`
          *,
          member:members!pending_payments_member_id_fkey(id, nome, telefone, email, status, access_type, access_expires_at, credits_remaining),
          plan:plans!pending_payments_plan_id_fkey(id, nome, tipo, duracao_dias, creditos, preco_cents)
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingPayment[];
    },
  });

  // Search IBAN to find member
  const searchMemberByIban = async (iban: string) => {
    const normalizedIban = iban.replace(/\s/g, '').toUpperCase();

    const { data, error } = await supabase
      .from('member_ibans')
      .select(`
        iban,
        member:members!member_ibans_member_id_fkey(id, nome, telefone, email, status, access_type, access_expires_at, credits_remaining)
      `)
      .eq('iban', normalizedIban)
      .maybeSingle();

    if (error || !data) {
      setMatchedMember(null);
      toast({ title: 'IBAN não encontrado', description: 'Este IBAN não está cadastrado.', variant: 'destructive' });
      return;
    }

    setMatchedMember({
      member: data.member as PendingPayment['member'],
      iban: data.iban,
    });
    setNewIbanToSave(normalizedIban);
  };

  // Parse subscription config from notes
  const parseSubscriptionConfig = (notes: string | null): SubscriptionConfig | null => {
    if (!notes) return null;
    try {
      const parsed = JSON.parse(notes);
      return parsed.subscription_config || null;
    } catch {
      return null;
    }
  };

  // Confirm payment mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, memberId, planId }: { paymentId: string; memberId: string; planId: string | null }) => {
      if (!staffId) throw new Error('Staff ID not found');

      // Get the payment and plan details
      const { data: payment, error: paymentError } = await supabase
        .from('pending_payments')
        .select('*, plan:plans!pending_payments_plan_id_fkey(*)')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) throw new Error('Payment not found');

      const plan = payment.plan;
      const isEnrollment = payment.reference.startsWith('ENR-');
      const isReactivation = payment.reference.startsWith('REA-');
      const isRenewal = payment.reference.startsWith('PAY-');
      const hasEnrollmentFee = isEnrollment || isReactivation;

      // Parse subscription config from notes (for pricing engine payments)
      const subscriptionConfig = parseSubscriptionConfig(payment.notes);

      // Determine if this is a pricing engine payment (has subscription_config)
      const isPricingEnginePayment = !!subscriptionConfig;

      let subscriptionId: string | null = null;
      let transactionId: string;
      let newAccessExpiresAt: string;

      if (isPricingEnginePayment && subscriptionConfig) {
        // NEW: Pricing engine payment - create subscription

        // Get member's current access to extend if still valid
        const { data: member } = await supabase
          .from('members')
          .select('access_expires_at')
          .eq('id', memberId)
          .single();

        // Calculate expires_at
        let expiresAt = subscriptionConfig.expires_at;
        if (member?.access_expires_at && new Date(member.access_expires_at) > new Date()) {
          // Extend from current expiration
          const currentExpires = new Date(member.access_expires_at);
          const daysToAdd = subscriptionConfig.commitment_months * 30;
          const newExpires = addDays(currentExpires, daysToAdd);
          expiresAt = newExpires.toISOString().split('T')[0];
        }
        newAccessExpiresAt = expiresAt;

        // 1. Create subscription
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            member_id: memberId,
            modalities: subscriptionConfig.modalities,
            commitment_months: subscriptionConfig.commitment_months,
            calculated_price_cents: subscriptionConfig.calculated_price_cents,
            commitment_discount_pct: subscriptionConfig.commitment_discount_pct,
            promo_discount_pct: subscriptionConfig.promo_discount_pct,
            final_price_cents: subscriptionConfig.final_price_cents,
            enrollment_fee_cents: subscriptionConfig.enrollment_fee_cents || 0,
            starts_at: new Date().toISOString().split('T')[0],
            expires_at: expiresAt,
            commitment_discount_id: subscriptionConfig.commitment_discount_id,
            promo_discount_id: subscriptionConfig.promo_discount_id,
            status: 'active',
            created_by: staffId,
          })
          .select()
          .single();

        if (subError) throw subError;
        subscriptionId = subscription.id;

        // 2. Create transaction(s)
        if (hasEnrollmentFee && subscriptionConfig.enrollment_fee_cents && subscriptionConfig.enrollment_fee_cents > 0) {
          // Enrollment with fee: 2 transactions
          const planAmount = subscriptionConfig.final_price_cents;
          const enrollmentFee = subscriptionConfig.enrollment_fee_cents;

          // Transaction 1: Plan/Subscription payment
          const { data: planTx, error: planTxError } = await supabase
            .from('transactions')
            .insert({
              type: 'RECEITA',
              category: 'SUBSCRIPTION',
              amount_cents: planAmount,
              payment_method: 'TRANSFERENCIA',
              member_id: memberId,
              description: isEnrollment
                ? `Subscrição: ${subscriptionConfig.commitment_months} mês(es), ${subscriptionConfig.modalities.length} modalidade(s) (Matrícula)`
                : `Subscrição: ${subscriptionConfig.commitment_months} mês(es), ${subscriptionConfig.modalities.length} modalidade(s) (Reativação)`,
              created_by: staffId,
            })
            .select()
            .single();

          if (planTxError) throw planTxError;
          transactionId = planTx.id;

          // Transaction 2: Enrollment fee
          const { error: feeTxError } = await supabase
            .from('transactions')
            .insert({
              type: 'RECEITA',
              category: 'TAXA_MATRICULA',
              amount_cents: enrollmentFee,
              payment_method: 'TRANSFERENCIA',
              member_id: memberId,
              description: isEnrollment
                ? 'Taxa de Matrícula'
                : 'Taxa de Matrícula (Reativação)',
              created_by: staffId,
            });

          if (feeTxError) throw feeTxError;
        } else {
          // Renewal or enrollment without fee: 1 transaction
          const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
              type: 'RECEITA',
              category: 'SUBSCRIPTION',
              amount_cents: subscriptionConfig.final_price_cents,
              payment_method: 'TRANSFERENCIA',
              member_id: memberId,
              description: `Subscrição: ${subscriptionConfig.commitment_months} mês(es), ${subscriptionConfig.modalities.length} modalidade(s)`,
              created_by: staffId,
            })
            .select()
            .single();

          if (txError) throw txError;
          transactionId = transaction.id;
        }

        // 3. Update member
        const { error: memberError } = await supabase
          .from('members')
          .update({
            status: 'ATIVO',
            access_type: 'SUBSCRIPTION',
            access_expires_at: expiresAt,
            current_subscription_id: subscriptionId,
          })
          .eq('id', memberId);

        if (memberError) throw memberError;

        // 4. Increment promo code uses if applicable
        if (subscriptionConfig.promo_discount_id) {
          await supabase.rpc('increment_discount_uses', {
            discount_id: subscriptionConfig.promo_discount_id,
          }).catch(() => {
            // Silently fail - not critical
          });
        }
      } else {
        // LEGACY: Old-style payment without pricing engine (backwards compatibility)

        // Calculate new access based on plan
        let updateData: Record<string, unknown> = { status: 'ATIVO' };

        if (plan) {
          updateData.current_plan_id = plan.id;

          if (plan.tipo === 'SUBSCRIPTION' || plan.tipo === 'DAILY_PASS') {
            const { data: member } = await supabase
              .from('members')
              .select('access_expires_at')
              .eq('id', memberId)
              .single();

            const baseDate = member?.access_expires_at && new Date(member.access_expires_at) > new Date()
              ? new Date(member.access_expires_at)
              : new Date();

            newAccessExpiresAt = addDays(baseDate, plan.duracao_dias || 30).toISOString();
            updateData.access_type = plan.tipo;
            updateData.access_expires_at = newAccessExpiresAt;
          } else if (plan.tipo === 'CREDITS') {
            const { data: member } = await supabase
              .from('members')
              .select('credits_remaining')
              .eq('id', memberId)
              .single();

            updateData.access_type = 'CREDITS';
            updateData.credits_remaining = (member?.credits_remaining || 0) + (plan.creditos || 0);
            newAccessExpiresAt = addDays(new Date(), 90).toISOString(); // Credits valid for 90 days
          }
        } else {
          newAccessExpiresAt = addDays(new Date(), 30).toISOString();
        }

        // Update member
        const { error: memberError } = await supabase
          .from('members')
          .update(updateData)
          .eq('id', memberId);

        if (memberError) throw memberError;

        // Create transaction(s)
        if (hasEnrollmentFee && plan) {
          // Enrollment/Reactivation: Create 2 separate transactions
          const enrollmentFeeCents = payment.amount_cents - plan.preco_cents;

          // Transaction 1: Plan payment
          const { data: planTx, error: planTxError } = await supabase
            .from('transactions')
            .insert({
              type: 'RECEITA',
              category: plan.tipo,
              amount_cents: plan.preco_cents,
              payment_method: 'TRANSFERENCIA',
              member_id: memberId,
              description: isEnrollment
                ? `Plano: ${plan.nome} (Matrícula)`
                : `Plano: ${plan.nome} (Reativação)`,
              created_by: staffId,
            })
            .select()
            .single();

          if (planTxError) throw planTxError;
          transactionId = planTx.id;

          // Transaction 2: Enrollment fee (if > 0)
          if (enrollmentFeeCents > 0) {
            const { error: feeTxError } = await supabase
              .from('transactions')
              .insert({
                type: 'RECEITA',
                category: 'TAXA_MATRICULA',
                amount_cents: enrollmentFeeCents,
                payment_method: 'TRANSFERENCIA',
                member_id: memberId,
                description: isEnrollment
                  ? `Taxa de Matrícula - ${plan.nome}`
                  : `Taxa de Matrícula (Reativação) - ${plan.nome}`,
                created_by: staffId,
              });

            if (feeTxError) throw feeTxError;
          }
        } else {
          // Regular payment: 1 transaction
          const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
              type: 'RECEITA',
              category: plan?.tipo || 'SUBSCRIPTION',
              amount_cents: payment.amount_cents,
              payment_method: 'TRANSFERENCIA',
              member_id: memberId,
              description: `Confirmação: ${payment.reference}`,
              created_by: staffId,
            })
            .select()
            .single();

          if (txError) throw txError;
          transactionId = transaction.id;
        }
      }

      // Update pending payment status
      const { error: updateError } = await supabase
        .from('pending_payments')
        .update({
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString(),
          confirmed_by: staffId,
          transaction_id: transactionId!,
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Save new IBAN if requested
      if (saveNewIban && newIbanToSave) {
        await supabase.from('member_ibans').insert({
          member_id: memberId,
          iban: newIbanToSave,
          is_primary: false,
        });
      }

      // Send email notification (non-blocking)
      const { data: memberData } = await supabase
        .from('members')
        .select('nome, email, access_expires_at')
        .eq('id', memberId)
        .single();

      if (memberData?.email) {
        supabase.functions.invoke('send-notification', {
          body: {
            type: 'PAYMENT_CONFIRMED',
            recipientEmail: memberData.email,
            recipientName: memberData.nome,
            data: {
              amount_cents: payment.amount_cents,
              plan_name: plan?.nome || (subscriptionConfig ? 'Subscrição Personalizada' : 'N/A'),
              access_expires_at: memberData.access_expires_at
                ? format(new Date(memberData.access_expires_at), 'dd/MM/yyyy')
                : 'N/A',
            },
          },
        }).catch(console.error); // Fire and forget
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Pagamento confirmado! Membro ativado.' });
      setSelectedPayment(null);
      setMatchedMember(null);
      setSaveNewIban(false);
      setNewIbanToSave('');
    },
    onError: (error) => {
      console.error('Confirm error:', error);
      toast({ title: 'Erro ao confirmar pagamento', variant: 'destructive' });
    },
  });

  // Cancel payment mutation
  const cancelMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('pending_payments')
        .update({ status: 'CANCELLED' })
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      toast({ title: 'Pagamento cancelado' });
      setSelectedPayment(null);
    },
    onError: () => {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const getDaysRemaining = (expiresAt: string) => {
    const days = differenceInDays(new Date(expiresAt), new Date());
    if (days < 0) return { label: 'Expirado', variant: 'destructive' as const };
    if (days === 0) return { label: 'Expira hoje', variant: 'destructive' as const };
    if (days <= 2) return { label: `${days} dias`, variant: 'secondary' as const };
    return { label: `${days} dias`, variant: 'outline' as const };
  };

  const getPaymentTypeLabel = (reference: string) => {
    if (reference.startsWith('ENR-')) return { label: 'Matrícula', variant: 'default' as const };
    if (reference.startsWith('REA-')) return { label: 'Reativação', variant: 'secondary' as const };
    if (reference.startsWith('PAY-')) return { label: 'Renovação', variant: 'outline' as const };
    return { label: 'Pagamento', variant: 'outline' as const };
  };

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Get subscription summary from notes
  const getSubscriptionSummary = (payment: PendingPayment) => {
    const config = parseSubscriptionConfig(payment.notes);
    if (!config) return null;
    return {
      modalities: config.modalities.length,
      months: config.commitment_months,
      discounts: (config.commitment_discount_pct || 0) + (config.promo_discount_pct || 0),
      enrollmentFee: config.enrollment_fee_cents || 0,
    };
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">VERIFICAR PAGAMENTOS</h1>
          <p className="text-muted-foreground text-sm">
            Confirmar transferências bancárias pendentes
          </p>
        </div>

        {/* IBAN Search */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar por IBAN
            </CardTitle>
            <CardDescription>
              Cole o IBAN do extrato para encontrar o membro automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="PT50 0000 0000 0000 0000 0000 0"
                value={searchIban}
                onChange={(e) => setSearchIban(e.target.value)}
                className="bg-secondary border-border font-mono"
              />
              <Button
                onClick={() => searchMemberByIban(searchIban)}
                disabled={!searchIban.trim()}
              >
                Buscar
              </Button>
            </div>

            {matchedMember && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">IBAN encontrado!</span>
                </div>
                <p className="font-medium">{matchedMember.member.nome}</p>
                <p className="text-sm text-muted-foreground">{matchedMember.member.telefone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Payments List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pagamentos Pendentes
              {pendingPayments && pendingPayments.length > 0 && (
                <Badge variant="secondary">{pendingPayments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingPayments && pendingPayments.length > 0 ? (
              <div className="space-y-3">
                {pendingPayments.map((payment) => {
                  const daysInfo = getDaysRemaining(payment.expires_at);
                  const typeInfo = getPaymentTypeLabel(payment.reference);
                  const subscriptionSummary = getSubscriptionSummary(payment);

                  return (
                    <div
                      key={payment.id}
                      className="p-4 bg-secondary rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{payment.member.nome}</p>
                            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                            <Badge variant={daysInfo.variant}>{daysInfo.label}</Badge>
                          </div>

                          {subscriptionSummary ? (
                            <p className="text-sm text-muted-foreground">
                              {subscriptionSummary.modalities} modalidade(s) • {subscriptionSummary.months} mês(es)
                              {subscriptionSummary.discounts > 0 && ` • -${subscriptionSummary.discounts}%`}
                              {subscriptionSummary.enrollmentFee > 0 && ` + Taxa: ${formatPrice(subscriptionSummary.enrollmentFee)}`}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {payment.plan?.nome || 'Plano não especificado'} • {payment.reference}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold text-accent">
                            {formatPrice(payment.amount_cents)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openWhatsApp(
                                payment.member.telefone,
                                `Olá ${payment.member.nome.split(' ')[0]}! Aguardamos a confirmação da sua transferência de ${formatPrice(payment.amount_cents)}. Ref: ${payment.reference}`
                              )}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              Verificar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pagamento pendente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm Payment Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Confirmar Pagamento</DialogTitle>
              <DialogDescription>
                Verifique os dados e confirme o recebimento
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="font-medium text-lg">{selectedPayment.member.nome}</p>
                  <p className="text-sm text-muted-foreground">{selectedPayment.member.telefone}</p>

                  {/* Subscription details if pricing engine payment */}
                  {(() => {
                    const config = parseSubscriptionConfig(selectedPayment.notes);
                    if (config) {
                      return (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Calculator className="h-4 w-4 text-accent" />
                            <span className="text-sm font-medium">Detalhes da Subscrição</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Modalidades</span>
                              <span>{config.modalities.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Período</span>
                              <span>{config.commitment_months} mês(es)</span>
                            </div>
                            {config.commitment_discount_pct > 0 && (
                              <div className="flex justify-between text-green-500">
                                <span>Desconto Compromisso</span>
                                <span>-{config.commitment_discount_pct}%</span>
                              </div>
                            )}
                            {config.promo_discount_pct > 0 && (
                              <div className="flex justify-between text-green-500">
                                <span>Desconto Promo</span>
                                <span>-{config.promo_discount_pct}%</span>
                              </div>
                            )}
                            {config.enrollment_fee_cents && config.enrollment_fee_cents > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Taxa de Matrícula</span>
                                <span>{formatPrice(config.enrollment_fee_cents)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">Plano</p>
                        <p className="font-medium">{selectedPayment.plan?.nome || 'N/A'}</p>
                      </div>
                    );
                  })()}

                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-xl font-bold text-accent">
                      {formatPrice(selectedPayment.amount_cents)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Referência</p>
                    <code className="text-sm">{selectedPayment.reference}</code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>IBAN do pagador (opcional)</Label>
                  <Input
                    placeholder="Para salvar no cadastro do membro"
                    value={newIbanToSave}
                    onChange={(e) => setNewIbanToSave(e.target.value)}
                    className="bg-secondary border-border font-mono"
                  />
                  {newIbanToSave && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="save-iban"
                        checked={saveNewIban}
                        onCheckedChange={(checked) => setSaveNewIban(!!checked)}
                      />
                      <Label htmlFor="save-iban" className="text-sm">
                        Salvar este IBAN no cadastro do membro
                      </Label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => cancelMutation.mutate(selectedPayment.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => confirmMutation.mutate({
                      paymentId: selectedPayment.id,
                      memberId: selectedPayment.member.id,
                      planId: selectedPayment.plan_id,
                    })}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PendingPayments;
