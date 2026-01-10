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
  Phone
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';

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
  member: {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
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
          member:members!pending_payments_member_id_fkey(id, nome, telefone, email, access_type, access_expires_at, credits_remaining),
          plan:plans!pending_payments_plan_id_fkey(id, nome, tipo, duracao_dias, creditos)
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
        member:members!member_ibans_member_id_fkey(id, nome, telefone, email, access_type, access_expires_at, credits_remaining)
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
      iban: data.iban 
    });
    setNewIbanToSave(normalizedIban);
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

      // Calculate new access
      let updateData: Record<string, unknown> = { status: 'ATIVO' };

      if (plan) {
        if (plan.tipo === 'SUBSCRIPTION' || plan.tipo === 'DAILY_PASS') {
          const { data: member } = await supabase
            .from('members')
            .select('access_expires_at')
            .eq('id', memberId)
            .single();

          const baseDate = member?.access_expires_at && new Date(member.access_expires_at) > new Date()
            ? new Date(member.access_expires_at)
            : new Date();
          
          updateData.access_type = plan.tipo;
          updateData.access_expires_at = addDays(baseDate, plan.duracao_dias || 30).toISOString();
        } else if (plan.tipo === 'CREDITS') {
          const { data: member } = await supabase
            .from('members')
            .select('credits_remaining')
            .eq('id', memberId)
            .single();

          updateData.access_type = 'CREDITS';
          updateData.credits_remaining = (member?.credits_remaining || 0) + (plan.creditos || 0);
        }
      }

      // Update member
      const { error: memberError } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', memberId);

      if (memberError) throw memberError;

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'MENSALIDADE',
          amount_cents: payment.amount_cents,
          payment_method: 'TRANSFERENCIA',
          member_id: memberId,
          description: `Confirmação: ${payment.reference}`,
          created_by: staffId,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update pending payment
      const { error: updateError } = await supabase
        .from('pending_payments')
        .update({
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString(),
          confirmed_by: staffId,
          transaction_id: transaction.id,
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
              plan_name: plan?.nome || 'N/A',
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

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
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
                  
                  return (
                    <div
                      key={payment.id}
                      className="p-4 bg-secondary rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{payment.member.nome}</p>
                            <Badge variant={daysInfo.variant}>{daysInfo.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payment.plan?.nome || 'Plano não especificado'} • {payment.reference}
                          </p>
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
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Plano</p>
                    <p className="font-medium">{selectedPayment.plan?.nome || 'N/A'}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Valor</p>
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
