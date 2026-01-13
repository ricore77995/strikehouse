import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/lib/supabase-utils';
import {
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle,
  Loader2,
  UserPlus,
  QrCode,
  AlertCircle
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
}

interface Plan {
  id: string;
  nome: string;
  tipo: string;
  preco_cents: number;
  duracao_dias: number | null;
  creditos: number | null;
  ativo: boolean;
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
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showQuickMember, setShowQuickMember] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ member: Member; plan: Plan } | null>(null);

  // Search members
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['member-search', searchQuery],
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

  // Fetch active plans
  const { data: plans } = useQuery({
    queryKey: ['active-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('ativo', true)
        .order('preco_cents');
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedPlan || !selectedMethod || !staffId) {
        throw new Error('Dados incompletos');
      }

      const isInstant = paymentMethods.find(m => m.value === selectedMethod)?.instant;

      // Calculate new access
      let newAccessType = selectedPlan.tipo as 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
      let newAccessExpires: string | null = null;
      let newCredits: number | null = null;

      if (selectedPlan.tipo === 'SUBSCRIPTION' || selectedPlan.tipo === 'DAILY_PASS') {
        const baseDate = selectedMember.access_expires_at && new Date(selectedMember.access_expires_at) > new Date()
          ? new Date(selectedMember.access_expires_at)
          : new Date();
        newAccessExpires = addDays(baseDate, selectedPlan.duracao_dias || 30).toISOString();
      } else if (selectedPlan.tipo === 'CREDITS') {
        newCredits = (selectedMember.credits_remaining || 0) + (selectedPlan.creditos || 0);
      }

      if (isInstant) {
        // Direct payment - activate immediately
        // 1. Update member
        const { error: memberError } = await supabase
          .from('members')
          .update({
            status: 'ATIVO',
            access_type: newAccessType,
            access_expires_at: newAccessExpires,
            credits_remaining: newCredits,
            current_plan_id: selectedPlan.id,
          })
          .eq('id', selectedMember.id);

        if (memberError) throw memberError;

        // 2. Create transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            type: 'RECEITA',
            category: selectedPlan.tipo,
            amount_cents: selectedPlan.preco_cents,
            payment_method: selectedMethod,
            member_id: selectedMember.id,
            description: `Pagamento: ${selectedPlan.nome}`,
            created_by: staffId,
          });

        if (txError) throw txError;

        return { type: 'instant' as const };
      } else {
        // Transfer - create pending payment
        const expiresAt = addDays(new Date(), 7); // 7 days to confirm
        
        const { error: pendingError } = await supabase
          .from('pending_payments')
          .insert({
            member_id: selectedMember.id,
            plan_id: selectedPlan.id,
            amount_cents: selectedPlan.preco_cents,
            payment_method: selectedMethod,
            reference: `PAY-${Date.now()}`,
            expires_at: expiresAt.toISOString(),
            created_by: staffId,
          });

        if (pendingError) throw pendingError;

        return { type: 'pending' as const };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      if (result.type === 'instant') {
        setPaymentSuccess({ member: selectedMember!, plan: selectedPlan! });
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
    setSelectedPlan(null);
    setSelectedMethod(null);
    setSearchQuery('');
    setPaymentSuccess(null);
  };

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery('');
  };

  const handlePayment = () => {
    if (!selectedMember || !selectedPlan || !selectedMethod) {
      toast({ title: 'Selecione todos os campos', variant: 'destructive' });
      return;
    }
    paymentMutation.mutate();
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
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
              <p className="text-muted-foreground mb-4">{paymentSuccess.plan.nome}</p>
              <p className="text-2xl font-bold text-green-500 mb-6">
                {formatPrice(paymentSuccess.plan.preco_cents)}
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`/m/${paymentSuccess.member.id}`, '_blank')}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Ver QR
                </Button>
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
            <h1 className="text-2xl tracking-wider mb-1">PAGAMENTO</h1>
            <p className="text-muted-foreground text-sm">
              Registrar pagamento de plano
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowQuickMember(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Membro
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Step 1: Select Member */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs">1</span>
                Membro
              </CardTitle>
              <CardDescription>Selecione o membro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedMember ? (
                <>
                  <div className="p-4 bg-secondary rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedMember.nome}</p>
                        <p className="text-sm text-muted-foreground">{selectedMember.telefone}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                        Alterar
                      </Button>
                    </div>
                  </div>

                  {selectedMember.status === 'LEAD' && (
                    <Alert className="mt-3 border-yellow-500/50 bg-yellow-500/10">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <AlertTitle className="text-sm font-medium">Novo Membro</AlertTitle>
                      <AlertDescription className="text-xs">
                        Este membro nunca foi ativado. Deseja matriculá-lo?
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

                  {selectedMember.status === 'CANCELADO' && (
                    <Alert className="mt-3 border-blue-500/50 bg-blue-500/10">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                      <AlertTitle className="text-sm font-medium">Membro Cancelado</AlertTitle>
                      <AlertDescription className="text-xs space-y-3">
                        <p>Este membro já teve acesso cancelado. Deseja cobrar taxa de matrícula novamente?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-accent text-accent hover:bg-accent/10"
                            onClick={() => navigate('/staff/enrollment', { state: { member: selectedMember } })}
                          >
                            Sim - Com Taxa de Matrícula
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {/* Continue normal flow - user can proceed with plan selection */}}
                          >
                            Não - Apenas Plano
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
                          <p className="font-medium">{member.nome}</p>
                          <p className="text-sm text-muted-foreground">{member.telefone}</p>
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

          {/* Step 2: Select Plan */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs">2</span>
                Plano
              </CardTitle>
              <CardDescription>Selecione o plano</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {plans?.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      'p-4 rounded-lg text-left transition-colors border',
                      selectedPlan?.id === plan.id
                        ? 'bg-accent/20 border-accent'
                        : 'bg-secondary border-transparent hover:bg-secondary/80'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{plan.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.tipo === 'CREDITS' 
                            ? `${plan.creditos} créditos`
                            : plan.duracao_dias 
                              ? `${plan.duracao_dias} dias`
                              : 'Mensal'}
                        </p>
                      </div>
                      <p className="font-bold text-accent">{formatPrice(plan.preco_cents)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Payment Method */}
          <Card className="bg-card border-border lg:col-span-2">
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
        </div>

        {/* Summary & Confirm */}
        {selectedMember && selectedPlan && selectedMethod && (
          <Card className="bg-card border-accent">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Resumo</p>
                  <p className="font-medium">{selectedMember.nome} — {selectedPlan.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentMethods.find(m => m.value === selectedMethod)?.label}
                    {selectedMethod === 'TRANSFER' && ' (pendente de confirmação)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent mb-2">
                    {formatPrice(selectedPlan.preco_cents)}
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
            });
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default StaffPayment;
