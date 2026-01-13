import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, UserPlus, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const memberSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  telefone: z.string().trim().min(9, 'Telefone inválido').max(20, 'Telefone muito longo'),
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo').optional().or(z.literal('')),
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

interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  preco_cents: number;
  enrollment_fee_cents: number;
  duracao_dias: number | null;
  creditos: number | null;
  ativo: boolean;
}

type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
};

const getTipoLabel = (tipo: string) => {
  switch (tipo) {
    case 'SUBSCRIPTION': return 'Mensalidade';
    case 'CREDITS': return 'Créditos';
    case 'DAILY_PASS': return 'Diária';
    default: return tipo;
  }
};

const Enrollment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { staffId } = useAuth();
  const queryClient = useQueryClient();

  // Pre-selected member from navigation state (e.g., from Payment page alert)
  const preSelectedMember = location.state?.member as Member | undefined;

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [memberMode, setMemberMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(preSelectedMember || null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [enrollmentFeeInput, setEnrollmentFeeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Create member form
  const memberForm = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      email: '',
    },
  });

  // Search for LEAD and CANCELADO members (enrollment or reactivation)
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['enrollment-members', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];

      const { data, error } = await supabase
        .from('members')
        .select('id, nome, telefone, email, qr_code, status')
        .in('status', ['LEAD', 'CANCELADO']) // Accept LEAD (new) and CANCELADO (returning)
        .or(`nome.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data as Member[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch active plans
  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['active-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('ativo', true)
        .order('preco_cents', { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });

  // Auto-populate enrollment fee when plan is selected
  useEffect(() => {
    if (selectedPlan) {
      setEnrollmentFeeInput((selectedPlan.enrollment_fee_cents / 100).toFixed(2));
    }
  }, [selectedPlan]);

  // If member was pre-selected, start at step 2
  useEffect(() => {
    if (preSelectedMember) {
      setCurrentStep(2);
    }
  }, [preSelectedMember]);

  // Calculate totals
  const enrollmentFeeCents = Math.round(parseFloat(enrollmentFeeInput || '0') * 100);
  const totalCents = selectedPlan ? selectedPlan.preco_cents + enrollmentFeeCents : 0;

  // Create member mutation
  const createMemberMutation = useMutation({
    mutationFn: async (data: MemberFormData) => {
      const { data: newMember, error } = await supabase
        .from('members')
        .insert({
          nome: data.nome,
          telefone: data.telefone,
          email: data.email || null,
          status: 'LEAD',
          qr_code: '', // Will be auto-generated by trigger
        })
        .select('id, nome, telefone, email, qr_code, status')
        .single();

      if (error) throw error;
      return newMember as Member;
    },
    onSuccess: (newMember) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
      toast({
        title: 'Membro criado!',
        description: `${newMember.nome} foi cadastrado como LEAD.`,
      });
      // Auto-select the new member and move to step 2
      setSelectedMember(newMember);
      memberForm.reset();
      setCurrentStep(2);
    },
    onError: (error) => {
      console.error('Create member error:', error);
      toast({
        title: 'Erro ao criar membro',
        description: 'Não foi possível cadastrar o membro. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Calculate expiration date
  const calculateExpirationDate = (plan: Plan) => {
    if (plan.tipo === 'DAILY_PASS') {
      // Daily pass expires at end of day
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return today.toISOString();
    } else if (plan.tipo === 'SUBSCRIPTION' && plan.duracao_dias) {
      return addDays(new Date(), plan.duracao_dias).toISOString();
    } else if (plan.tipo === 'CREDITS' && plan.duracao_dias) {
      // Credits expire after duracao_dias
      return addDays(new Date(), plan.duracao_dias).toISOString();
    }
    return null;
  };

  // Enrollment mutation (instant payment)
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedPlan || !paymentMethod || !staffId) {
        throw new Error('Missing required data');
      }

      const expirationDate = calculateExpirationDate(selectedPlan);

      // 1. Update member to ATIVO
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: selectedPlan.tipo,
          access_expires_at: expirationDate,
          credits_remaining: selectedPlan.tipo === 'CREDITS' ? selectedPlan.creditos : null,
          current_plan_id: selectedPlan.id,
        })
        .eq('id', selectedMember.id);

      if (memberError) throw memberError;

      // 2. Create plan transaction
      const { error: planTxError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: selectedPlan.tipo,
          amount_cents: selectedPlan.preco_cents,
          payment_method: paymentMethod,
          member_id: selectedMember.id,
          description: `Plano: ${selectedPlan.nome}`,
          created_by: staffId,
        });

      if (planTxError) throw planTxError;

      // 3. Create enrollment fee transaction (if > 0)
      if (enrollmentFeeCents > 0) {
        const { error: feeTxError } = await supabase
          .from('transactions')
          .insert({
            type: 'RECEITA',
            category: 'TAXA_MATRICULA',
            amount_cents: enrollmentFeeCents,
            payment_method: paymentMethod,
            member_id: selectedMember.id,
            description: `Taxa de Matrícula - ${selectedPlan.nome}`,
            created_by: staffId,
          });

        if (feeTxError) throw feeTxError;
      }

      // 4. Update cash session if DINHEIRO
      if (paymentMethod === 'DINHEIRO') {
        const today = new Date().toISOString().split('T')[0];

        const { data: session, error: sessionFetchError } = await supabase
          .from('cash_sessions')
          .select('*')
          .eq('session_date', today)
          .eq('status', 'OPEN')
          .single();

        if (sessionFetchError && sessionFetchError.code !== 'PGRST116') {
          throw sessionFetchError;
        }

        if (session) {
          const { error: sessionUpdateError } = await supabase
            .from('cash_sessions')
            .update({
              total_cash_in_cents: session.total_cash_in_cents + totalCents,
            })
            .eq('id', session.id);

          if (sessionUpdateError) throw sessionUpdateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsSuccess(true);
      toast({
        title: 'Matrícula concluída!',
        description: `${selectedMember?.nome} foi matriculado com sucesso.`,
      });
    },
    onError: (error) => {
      console.error('Enrollment error:', error);
      toast({
        title: 'Erro na matrícula',
        description: 'Não foi possível completar a matrícula. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Pending payment mutation (TRANSFERENCIA)
  const pendingPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedPlan || !staffId) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase
        .from('pending_payments')
        .insert({
          member_id: selectedMember.id,
          plan_id: selectedPlan.id,
          amount_cents: totalCents,
          payment_method: 'TRANSFERENCIA',
          reference: selectedMember.status === 'LEAD'
            ? `ENR-${Date.now()}` // ENR = Enrollment (first-time)
            : `REA-${Date.now()}`, // REA = Reactivation (returning CANCELADO)
          expires_at: addDays(new Date(), 7).toISOString(),
          created_by: staffId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: 'Pagamento pendente criado',
        description: 'Instruções de transferência foram geradas.',
      });
    },
    onError: (error) => {
      console.error('Pending payment error:', error);
      toast({
        title: 'Erro ao criar pagamento pendente',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery('');
    setCurrentStep(2);
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setCurrentStep(3);
  };

  const handleEnrollmentFeeConfirm = () => {
    setCurrentStep(4);
  };

  const handlePaymentConfirm = async () => {
    if (!paymentMethod) {
      toast({
        title: 'Selecione um método de pagamento',
        variant: 'destructive',
      });
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
    setSelectedPlan(null);
    setEnrollmentFeeInput('');
    setPaymentMethod('');
    setIsSuccess(false);
    setSearchQuery('');
    memberForm.reset();
  };

  const handleCreateMember = (data: MemberFormData) => {
    createMemberMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6 lg:p-8">
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Matrícula Concluída!</CardTitle>
              <CardDescription>
                {paymentMethod === 'TRANSFERENCIA'
                  ? 'Pagamento pendente criado. O membro será ativado após confirmação da transferência.'
                  : `${selectedMember?.nome} agora tem acesso ao ginásio.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethod === 'TRANSFERENCIA' ? (
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Total:</span>
                    <span className="font-semibold">{formatCurrency(totalCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Referência:</span>
                    <span className="font-mono text-xs">
                      {selectedMember?.status === 'LEAD' ? 'ENR' : 'REA'}-{Date.now()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Validade:</span>
                    <span>{format(addDays(new Date(), 7), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Aguarde a confirmação da transferência pelo administrador.
                  </p>
                </div>
              ) : (
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Membro:</span>
                    <span className="font-semibold">{selectedMember?.nome}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plano:</span>
                    <span>{selectedPlan?.nome}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Pago:</span>
                    <span className="font-semibold">{formatCurrency(totalCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Método:</span>
                    <span>{paymentMethod}</span>
                  </div>
                  {selectedPlan?.tipo === 'SUBSCRIPTION' && selectedPlan.duracao_dias && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Válido até:</span>
                      <span>
                        {format(addDays(new Date(), selectedPlan.duracao_dias), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/staff/checkin')}
                  className="flex-1"
                >
                  Ir para Check-in
                </Button>
                <Button
                  onClick={handleReset}
                  className="flex-1 bg-accent hover:bg-accent/90"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nova Matrícula
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
            <h1 className="text-2xl tracking-wider mb-1">MATRÍCULA</h1>
            <p className="text-muted-foreground text-sm">
              Matricular novo membro (primeira assinatura)
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${
                    step === currentStep
                      ? 'bg-accent text-white'
                      : step < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-secondary text-muted-foreground'
                  }`}
              >
                {step < currentStep ? '✓' : step}
              </div>
              {step < 4 && (
                <div
                  className={`h-0.5 w-12 ${
                    step < currentStep ? 'bg-green-600' : 'bg-secondary'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select or Create Member */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Selecionar ou Criar Membro</CardTitle>
              <CardDescription>
                Busque um membro novo (LEAD) ou retornando (CANCELADO), ou crie um novo cadastro
              </CardDescription>
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

                {/* Search Tab */}
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
                            {member.status === 'CANCELADO' && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                Retornando
                              </Badge>
                            )}
                            {member.status === 'LEAD' && (
                              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                                Novo
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum membro LEAD encontrado</p>
                      <p className="text-sm">
                        Apenas membros que nunca foram ativados aparecem aqui
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Create Tab */}
                <TabsContent value="create" className="mt-4">
                  <Form {...memberForm}>
                    <form onSubmit={memberForm.handleSubmit(handleCreateMember)} className="space-y-4">
                      <FormField
                        control={memberForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nome completo"
                                autoFocus={memberMode === 'create'}
                                {...field}
                              />
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
                              <Input
                                placeholder="912345678"
                                type="tel"
                                {...field}
                              />
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
                              <Input
                                placeholder="email@exemplo.com"
                                type="email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-accent hover:bg-accent/90"
                        disabled={createMemberMutation.isPending}
                      >
                        {createMemberMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Criar e Continuar
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Plan */}
        {currentStep === 2 && selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>2. Selecionar Plano</CardTitle>
              <CardDescription>
                Membro: <strong>{selectedMember.nome}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPlans && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {plans?.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan)}
                    className="p-4 border border-border rounded-lg hover:bg-accent/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{plan.nome}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {getTipoLabel(plan.tipo)}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(plan.preco_cents)}</p>
                        {plan.enrollment_fee_cents > 0 && (
                          <p className="text-sm text-muted-foreground">
                            + {formatCurrency(plan.enrollment_fee_cents)} taxa
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {plan.duracao_dias && <p>{plan.duracao_dias} dias de acesso</p>}
                      {plan.creditos && <p>{plan.creditos} créditos</p>}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Adjust Enrollment Fee */}
        {currentStep === 3 && selectedPlan && selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>3. Ajustar Taxa de Matrícula</CardTitle>
              <CardDescription>
                {selectedMember?.status === 'LEAD'
                  ? 'Ajuste a taxa de matrícula (cobrada na primeira matrícula)'
                  : 'Ajuste a taxa de matrícula (opcional para membros retornando)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano ({selectedPlan.nome})</span>
                  <span className="font-semibold">{formatCurrency(selectedPlan.preco_cents)}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="enrollment_fee">
                    Taxa de Matrícula (€)
                  </Label>
                  <Input
                    id="enrollment_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={enrollmentFeeInput}
                    onChange={(e) => setEnrollmentFeeInput(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  <p className="text-xs text-muted-foreground">
                    Valor padrão: {formatCurrency(selectedPlan.enrollment_fee_cents)}. Você pode
                    ajustar (inclusive zerar para isenção).
                  </p>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL A PAGAR</span>
                  <span className="text-accent">{formatCurrency(totalCents)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleEnrollmentFeeConfirm}
                  className="flex-1 bg-accent hover:bg-accent/90"
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Payment Method */}
        {currentStep === 4 && selectedPlan && selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>4. Método de Pagamento</CardTitle>
              <CardDescription>
                Total: <strong>{formatCurrency(totalCents)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Selecione o método</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o método de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CARTAO">Cartão (TPA)</SelectItem>
                    <SelectItem value="MBWAY">MBWay</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
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
                        Será criado um pagamento pendente. O membro será ativado apenas após o
                        administrador confirmar a transferência.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
                <p className="font-semibold mb-2">Resumo da Matrícula</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membro:</span>
                    <span>{selectedMember.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plano:</span>
                    <span>{selectedPlan.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor do Plano:</span>
                    <span>{formatCurrency(selectedPlan.preco_cents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de Matrícula:</span>
                    <span>{formatCurrency(enrollmentFeeCents)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-accent">{formatCurrency(totalCents)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handlePaymentConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!paymentMethod || isProcessing}
                >
                  {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {paymentMethod === 'TRANSFERENCIA' ? 'Registrar Pendente' : 'Confirmar Matrícula'}
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
