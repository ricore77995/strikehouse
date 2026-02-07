import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Loader2,
  CreditCard,
  Mail,
  Calendar,
  DollarSign,
  User,
  Search,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

interface StripePayment {
  id: string;
  stripe_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  customer_email: string;
  customer_name: string | null;
  amount_total: number;
  currency: string;
  payment_status: string;
  payment_method: string | null;
  product_type: string | null;
  is_new_member: boolean;
  matched_member_id: string | null;
  auto_matched: boolean;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  metadata: Record<string, any>;
  event_type: string;
  created_at: string;
}

interface Member {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  status: string;
}

const StripePayments = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPayment, setSelectedPayment] = useState<StripePayment | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Fetch unconfirmed Stripe payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ['stripe-payments-unconfirmed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payment_ledger')
        .select('*')
        .eq('confirmed', false)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StripePayment[];
    },
  });

  // Search members for manual matching
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['member-search', memberSearchQuery],
    queryFn: async () => {
      if (!memberSearchQuery || memberSearchQuery.length < 2) return [];

      const { data, error } = await supabase
        .from('members')
        .select('id, nome, email, telefone, status')
        .or(`nome.ilike.%${memberSearchQuery}%,email.ilike.%${memberSearchQuery}%,telefone.ilike.%${memberSearchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data as Member[];
    },
    enabled: memberSearchQuery.length >= 2,
  });

  // Fetch matched member details
  const { data: matchedMember } = useQuery({
    queryKey: ['member', selectedPayment?.matched_member_id],
    queryFn: async () => {
      if (!selectedPayment?.matched_member_id) return null;

      const { data, error } = await supabase
        .from('members')
        .select('id, nome, email, telefone, status')
        .eq('id', selectedPayment.matched_member_id)
        .single();

      if (error) throw error;
      return data as Member;
    },
    enabled: !!selectedPayment?.matched_member_id,
  });

  // Confirm payment mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, memberId }: { paymentId: string; memberId: string }) => {
      if (!staffId) throw new Error('Staff ID not found');

      const payment = payments?.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');

      // Parse enrollment fee from metadata
      const enrollmentFeeCents = parseInt(payment.metadata?.enrollment_fee_cents || '0', 10);
      const planPriceCents = payment.amount_total - enrollmentFeeCents;

      // Calculate new access expiration (1 month from now)
      const newExpiresAt = addMonths(new Date(), 1).toISOString().split('T')[0];

      // 1. Create transaction for plan/subscription
      const { error: planTxError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: planPriceCents,
          payment_method: 'STRIPE',
          member_id: memberId,
          description: `Stripe: ${payment.customer_name || payment.customer_email}`,
          created_by: staffId,
        });

      if (planTxError) throw planTxError;

      // 2. Create transaction for enrollment fee (if > 0)
      if (enrollmentFeeCents > 0) {
        const { error: feeTxError } = await supabase
          .from('transactions')
          .insert({
            type: 'RECEITA',
            category: 'TAXA_MATRICULA',
            amount_cents: enrollmentFeeCents,
            payment_method: 'STRIPE',
            member_id: memberId,
            description: 'Taxa de Matrícula (Stripe)',
            created_by: staffId,
          });

        if (feeTxError) throw feeTxError;
      }

      // 3. Update member status
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: newExpiresAt,
        })
        .eq('id', memberId);

      if (memberError) throw memberError;

      // 4. Mark payment as confirmed in ledger
      const { error: ledgerError } = await supabase
        .from('stripe_payment_ledger')
        .update({
          matched_member_id: memberId,
          confirmed: true,
          confirmed_by: staffId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (ledgerError) throw ledgerError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-payments-unconfirmed'] });
      setConfirmDialogOpen(false);
      setSelectedPayment(null);
      setSelectedMemberId('');
      setMemberSearchQuery('');
      toast({
        title: 'Pagamento confirmado!',
        description: 'Membro ativado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenConfirmDialog = (payment: StripePayment) => {
    setSelectedPayment(payment);
    setSelectedMemberId(payment.matched_member_id || '');
    setMemberSearchQuery('');
    setConfirmDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPayment || !selectedMemberId) {
      toast({
        title: 'Selecione um membro',
        description: 'É necessário associar o pagamento a um membro.',
        variant: 'destructive',
      });
      return;
    }

    confirmMutation.mutate({
      paymentId: selectedPayment.id,
      memberId: selectedMemberId,
    });
  };

  const formatCurrency = (cents: number, currency = 'EUR') => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Pago</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">Não Pago</Badge>;
      case 'no_payment_required':
        return <Badge variant="secondary">Sem Pagamento</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos Stripe</h1>
          <p className="text-muted-foreground">
            Confirme pagamentos online recebidos via Stripe
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagamentos Pendentes</CardTitle>
            <CardDescription>
              {payments?.length || 0} pagamento(s) aguardando confirmação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <Card key={payment.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <h3 className="font-semibold text-lg">
                                {payment.customer_name || 'Nome não fornecido'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {payment.customer_email}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-2xl font-bold">
                              {formatCurrency(payment.amount_total, payment.currency)}
                            </div>
                            {getPaymentStatusBadge(payment.payment_status)}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Data</div>
                              <div className="font-medium">
                                {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Método</div>
                              <div className="font-medium">{payment.payment_method || 'card'}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Tipo</div>
                              <div className="font-medium">{payment.product_type || 'subscription'}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Sessão</div>
                              <div className="font-mono text-xs">
                                {payment.stripe_session_id.substring(0, 20)}...
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex gap-2">
                          {payment.is_new_member && (
                            <Badge variant="secondary" className="text-xs">
                              Novo Membro
                            </Badge>
                          )}
                          {payment.metadata?.enrollment_fee_cents && parseInt(payment.metadata.enrollment_fee_cents) > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Com Taxa de Matrícula
                            </Badge>
                          )}
                        </div>

                        {/* Auto-match Status */}
                        {payment.auto_matched && payment.matched_member_id && (
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <div className="font-medium text-green-700">Auto-matched</div>
                              <div className="text-sm text-green-600">
                                Membro identificado automaticamente por email
                              </div>
                            </div>
                          </div>
                        )}

                        {!payment.matched_member_id && (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div>
                              <div className="font-medium text-yellow-700">Requer associação manual</div>
                              <div className="text-sm text-yellow-600">
                                Nenhum membro encontrado com este email
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Confirm Button */}
                        <Button
                          className="w-full"
                          onClick={() => handleOpenConfirmDialog(payment)}
                          disabled={confirmMutation.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirmar Pagamento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum pagamento pendente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento Stripe</DialogTitle>
            <DialogDescription>
              Revise os detalhes e associe o pagamento ao membro correto
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cliente:</span>
                  <span className="font-medium">
                    {selectedPayment.customer_name || selectedPayment.customer_email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Total:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(selectedPayment.amount_total, selectedPayment.currency)}
                  </span>
                </div>
                {selectedPayment.metadata?.enrollment_fee_cents && parseInt(selectedPayment.metadata.enrollment_fee_cents) > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plano:</span>
                      <span>
                        {formatCurrency(
                          selectedPayment.amount_total - parseInt(selectedPayment.metadata.enrollment_fee_cents),
                          selectedPayment.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de Matrícula:</span>
                      <span>
                        {formatCurrency(parseInt(selectedPayment.metadata.enrollment_fee_cents), selectedPayment.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Member Selection */}
              <div className="space-y-3">
                <Label>Membro Associado</Label>

                {/* Show matched member if exists */}
                {matchedMember && selectedMemberId === matchedMember.id && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {selectedPayment.auto_matched && (
                        <Badge variant="default" className="bg-green-500 text-xs">Auto</Badge>
                      )}
                      <span className="font-medium">{matchedMember.nome}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {matchedMember.email} • {matchedMember.telefone}
                    </div>
                  </div>
                )}

                {/* Manual search */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ou pesquise outro membro:</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nome, email ou telefone..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Search Results */}
                  {memberSearchQuery.length >= 2 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : searchResults && searchResults.length > 0 ? (
                        <div className="divide-y">
                          {searchResults.map((member) => (
                            <button
                              key={member.id}
                              className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                                selectedMemberId === member.id ? 'bg-primary/10' : ''
                              }`}
                              onClick={() => {
                                setSelectedMemberId(member.id);
                                setMemberSearchQuery('');
                              }}
                            >
                              <div className="font-medium">{member.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                {member.email || 'Sem email'} • {member.telefone}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Nenhum membro encontrado
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                setSelectedPayment(null);
                setSelectedMemberId('');
                setMemberSearchQuery('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedMemberId || confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar e Ativar Membro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StripePayments;
