import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useModalities } from '@/hooks/useModalities';
import { useMemberModalities, useSetMemberModalities } from '@/hooks/useMemberModalities';
import { useMemberClasses, useClasses, useSetMemberClasses } from '@/hooks/useMemberClasses';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Phone,
  CreditCard,
  Banknote,
  Dumbbell,
  Clock,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
// date-fns not needed - date calculation done in edge function

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

interface PaymentLink {
  id: string;
  frequencia: string;
  compromisso: string;
  tags: string[] | null;
  includes_enrollment_fee: boolean; // Deprecated, use tags
  is_family_friends: boolean; // Deprecated, use tags
  payment_link_id: string;
  payment_link_url: string;
  price_id: string;
  amount_cents: number;
  display_name: string;
  ativo: boolean;
}

// Helper to check if link has enrollment fee (tags or boolean)
const linkHasEnrollmentFee = (link: PaymentLink): boolean => {
  if (link.tags && link.tags.length > 0) {
    return link.tags.includes('matricula');
  }
  return link.includes_enrollment_fee;
};

type PaymentMethod = 'DINHEIRO' | 'STRIPE';

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
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Stripe checkout state
  const [showStripeDialog, setShowStripeDialog] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState('');

  // Step 2.5: Modalities and classes selection
  const [selectedModalityIds, setSelectedModalityIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

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
        .in('status', ['LEAD', 'ATIVO', 'BLOQUEADO', 'CANCELADO'])
        .or(`nome.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Member[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch payment links based on member status
  // Fetch all active payment links, filter client-side by enrollment status
  const { data: allPaymentLinks, isLoading: isLoadingLinks } = useQuery({
    queryKey: ['payment-links-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payment_links')
        .select('*')
        .eq('ativo', true)
        .order('amount_cents', { ascending: true });

      if (error) throw error;
      return data as PaymentLink[];
    },
    enabled: !!selectedMember,
  });

  // Filter links based on member status
  // LEAD = needs enrollment fee (new member) - show links WITH matricula tag
  // ATIVO/BLOQUEADO/CANCELADO = renewal - show links WITHOUT matricula tag
  const needsEnrollment = selectedMember?.status === 'LEAD';

  // Intelligent filtering with fallback
  const filteredLinks = allPaymentLinks?.filter(link =>
    linkHasEnrollmentFee(link) === needsEnrollment
  );

  // Fallback: if no filtered links, show ALL links with warning
  const hasFilteredLinks = filteredLinks && filteredLinks.length > 0;
  const isFallbackMode = !hasFilteredLinks && allPaymentLinks && allPaymentLinks.length > 0;
  const paymentLinks = hasFilteredLinks ? filteredLinks : allPaymentLinks;

  // Badge helper for visual feedback
  const getLinkBadge = (link: PaymentLink) => {
    const hasMatricula = linkHasEnrollmentFee(link);

    if (needsEnrollment) {
      // LEAD member - SHOULD have matricula
      if (hasMatricula) {
        return { text: 'COM MATRÍCULA', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: 'check' };
      } else {
        return { text: 'SEM MATRÍCULA', color: 'bg-red-500/20 text-red-500 border-red-500/30', icon: 'warning' };
      }
    } else {
      // Returning member - should NOT have matricula
      if (hasMatricula) {
        return { text: 'INCLUI MATRÍCULA', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30', icon: 'warning' };
      } else {
        return { text: 'RENOVAÇÃO', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: 'check' };
      }
    }
  };

  // Fetch modalities and classes for Step 2.5
  const { modalities, isLoading: isLoadingModalities } = useModalities();
  const { data: allClasses, isLoading: isLoadingClasses } = useClasses();
  const setMemberModalities = useSetMemberModalities();
  const setMemberClasses = useSetMemberClasses();

  // Fetch existing member modalities and classes
  const { data: existingModalities } = useMemberModalities(selectedMember?.id);
  const { data: existingClasses } = useMemberClasses(selectedMember?.id);

  // Pre-populate selections when member data loads
  useEffect(() => {
    if (existingModalities && existingModalities.length > 0) {
      setSelectedModalityIds(existingModalities.map((m) => m.modality_id));
    }
  }, [existingModalities]);

  useEffect(() => {
    if (existingClasses && existingClasses.length > 0) {
      setSelectedClassIds(existingClasses.map((c) => c.class_id));
    }
  }, [existingClasses]);

  // Filter classes by selected modalities (using modality_id FK)
  const filteredClasses = allClasses?.filter((cls) =>
    selectedModalityIds.some((modId) => {
      // Use modality_id FK if available, fallback to string match
      if (cls.modality_id) {
        return cls.modality_id === modId;
      }
      // Fallback: match by modalidade string vs modality.code
      const mod = modalities?.find((m) => m.id === modId);
      return mod && (
        cls.modalidade.toLowerCase() === mod.nome.toLowerCase() ||
        cls.modalidade.toLowerCase().replace(/\s+/g, '_') === mod.code.toLowerCase()
      );
    })
  ) || [];

  // Days of week in Portuguese
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // If member was pre-selected, start at step 2
  useEffect(() => {
    if (preSelectedMember) {
      setCurrentStep(2);
    }
  }, [preSelectedMember]);

  // Format currency helper
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

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

  // Cash enrollment mutation (instant payment with DINHEIRO)
  // Uses create-offline-invoice edge function to:
  // 1. Create Stripe Customer + Invoice (for tracking)
  // 2. Mark invoice as paid (out_of_band)
  // 3. Activate member locally
  // 4. Create transaction
  // 5. Update cash session
  const cashEnrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedLink || !staffId) {
        throw new Error('Missing required data');
      }

      // Calculate days based on compromisso
      let durationDays = 30;
      if (selectedLink.compromisso === 'trimestral') durationDays = 90;
      else if (selectedLink.compromisso === 'semestral') durationDays = 180;
      else if (selectedLink.compromisso === 'anual') durationDays = 365;

      // Calculate weekly_limit from frequencia
      let weeklyLimit: number | null = null;
      if (selectedLink.frequencia === '1x') weeklyLimit = 1;
      else if (selectedLink.frequencia === '2x') weeklyLimit = 2;
      else if (selectedLink.frequencia === '3x') weeklyLimit = 3;
      // 'unlimited' = null (no limit)

      // Call edge function to create Stripe invoice + activate member
      // Use amountCents instead of priceId because Stripe recurring prices can't be added to invoices directly
      const { data, error } = await supabase.functions.invoke('create-offline-invoice', {
        body: {
          memberId: selectedMember.id,
          items: [{ amountCents: selectedLink.amount_cents, quantity: 1, description: selectedLink.display_name }],
          paymentMethod: 'DINHEIRO',
          staffId: staffId,
          accessMetadata: {
            daysAccess: durationDays,
            weeklyLimit: weeklyLimit,
            modalitiesCount: 1, // TODO: from payment link metadata
            accessType: 'SUBSCRIPTION',
            frequencia: selectedLink.frequencia,
            compromisso: selectedLink.compromisso,
            displayName: selectedLink.display_name,
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to process payment');

      console.log('Offline invoice created:', data);

      // Save modalities and classes (local operation)
      if (selectedModalityIds.length > 0) {
        await setMemberModalities.mutateAsync({
          memberId: selectedMember.id,
          modalityIds: selectedModalityIds,
        });
      }

      if (selectedClassIds.length > 0) {
        await setMemberClasses.mutateAsync({
          memberId: selectedMember.id,
          classIds: selectedClassIds,
          staffId: staffId,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsSuccess(true);
      toast({ title: 'Matrícula concluída!', description: `${selectedMember?.nome} foi matriculado. Invoice Stripe criada.` });
    },
    onError: (error) => {
      console.error('Enrollment error:', error);
      toast({ title: 'Erro na matrícula', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    },
  });

  // Stripe checkout mutation
  const stripeCheckoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedLink) {
        throw new Error('Missing required data');
      }

      // Save modalities and classes NOW (before payment)
      // When webhook activates the member, these will already be in place
      if (selectedModalityIds.length > 0) {
        await setMemberModalities.mutateAsync({
          memberId: selectedMember.id,
          modalityIds: selectedModalityIds,
        });
      }

      if (selectedClassIds.length > 0) {
        await setMemberClasses.mutateAsync({
          memberId: selectedMember.id,
          classIds: selectedClassIds,
          staffId: staffId,
        });
      }

      // Append client_reference_id for member tracking
      const urlWithMember = `${selectedLink.payment_link_url}?client_reference_id=${selectedMember.id}`;

      return {
        checkoutUrl: urlWithMember,
        displayName: selectedLink.display_name,
      };
    },
    onSuccess: (data) => {
      setStripeCheckoutUrl(data.checkoutUrl);
      setShowStripeDialog(true);
      toast({
        title: 'Link de Pagamento Pronto',
        description: data.displayName || 'Envie o link ao membro via WhatsApp',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao gerar link',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleMemberSelect = (member: Member) => {
    // Reset selections only if switching to a DIFFERENT member
    if (selectedMember?.id !== member.id) {
      setSelectedModalityIds([]);
      setSelectedClassIds([]);
    }
    setSelectedMember(member);
    setSelectedLink(null); // Reset link when member changes
    setSearchQuery('');
    setCurrentStep(2);
  };

  const handleLinkConfirm = () => {
    if (!selectedLink) {
      toast({ title: 'Selecione um plano', variant: 'destructive' });
      return;
    }
    // Don't reset modality/class - they will be loaded from member data via useEffect
    setCurrentStep(3); // Go to modality/class selection
  };

  const handleModalitiesConfirm = () => {
    if (selectedModalityIds.length === 0) {
      toast({ title: 'Selecione pelo menos uma modalidade', variant: 'destructive' });
      return;
    }
    setCurrentStep(4); // Go to payment
  };

  // Toggle modality selection
  const toggleModality = (modalityId: string) => {
    setSelectedModalityIds((prev) => {
      if (prev.includes(modalityId)) {
        // Remove modality and its classes
        const mod = modalities?.find((m) => m.id === modalityId);
        if (mod) {
          // Remove classes of this modality
          setSelectedClassIds((classIds) =>
            classIds.filter((cid) => {
              const cls = allClasses?.find((c) => c.id === cid);
              return cls && !cls.modalidade.toLowerCase().includes(mod.code.toLowerCase());
            })
          );
        }
        return prev.filter((id) => id !== modalityId);
      } else {
        return [...prev, modalityId];
      }
    });
  };

  // Toggle class selection
  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handlePaymentConfirm = async () => {
    // Prevent double-click
    if (isProcessing) return;

    if (!paymentMethod) {
      toast({ title: 'Selecione um método de pagamento', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      if (paymentMethod === 'DINHEIRO') {
        await cashEnrollMutation.mutateAsync();
      } else if (paymentMethod === 'STRIPE') {
        await stripeCheckoutMutation.mutateAsync();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setMemberMode('search');
    setSelectedMember(null);
    setSelectedLink(null);
    setSelectedModalityIds([]);
    setSelectedClassIds([]);
    setPaymentMethod('');
    setIsSuccess(false);
    setSearchQuery('');
    memberForm.reset();
  };

  // Get frequencia badge
  const getFrequenciaBadge = (freq: string) => {
    const labels: Record<string, string> = {
      '1x': '1x/semana',
      '2x': '2x/semana',
      '3x': '3x/semana',
      'unlimited': 'Ilimitado',
    };
    return labels[freq] || freq;
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
                {paymentMethod === 'STRIPE'
                  ? 'Link de pagamento criado. Confirme após o membro pagar.'
                  : `${selectedMember?.nome} agora tem acesso ao ginásio.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Membro:</span>
                  <span className="font-semibold">{selectedMember?.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plano:</span>
                  <span>{selectedLink?.display_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{formatPrice(selectedLink?.amount_cents || 0)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => navigate('/staff/checkin')} className="flex-1">
                  Ir para Check-in
                </Button>
                <Button onClick={handleReset} className="flex-1 bg-accent hover:bg-accent/90">
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
              Matricular ou renovar plano com pagamento Dinheiro ou Stripe
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${step === currentStep ? 'bg-accent text-white' : step < currentStep ? 'bg-green-600 text-white' : 'bg-secondary text-muted-foreground'}`}
              >
                {step < currentStep ? '✓' : step}
              </div>
              {step < 4 && (
                <div className={`h-0.5 w-12 ${step < currentStep ? 'bg-green-600' : 'bg-secondary'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select or Create Member */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Selecionar ou Criar Membro</CardTitle>
              <CardDescription>Busque um membro por nome ou telefone</CardDescription>
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
                              className={`text-xs ${
                                member.status === 'LEAD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                member.status === 'ATIVO' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                member.status === 'BLOQUEADO' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' :
                                'bg-blue-500/10 text-blue-500 border-blue-500/30'
                              }`}
                            >
                              {member.status === 'LEAD' ? 'Novo' :
                               member.status === 'ATIVO' ? 'Ativo' :
                               member.status === 'BLOQUEADO' ? 'Bloqueado' : 'Retornando'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum membro encontrado</p>
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

        {/* Step 2: Select Payment Link (Plan) */}
        {currentStep === 2 && selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>2. Selecionar Plano</CardTitle>
              <CardDescription>
                Membro: <strong>{selectedMember.nome}</strong>
                {selectedMember.status === 'LEAD' ? (
                  <Badge className="ml-2 bg-yellow-500/20 text-yellow-600">Novo - Com Matrícula</Badge>
                ) : selectedMember.status === 'ATIVO' || selectedMember.status === 'BLOQUEADO' ? (
                  <Badge className="ml-2 bg-green-500/20 text-green-600">Renovação</Badge>
                ) : (
                  <Badge className="ml-2 bg-blue-500/20 text-blue-600">Reativação</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingLinks ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paymentLinks && paymentLinks.length > 0 ? (
                <>
                  {/* Fallback Warning Banner */}
                  {isFallbackMode && (
                    <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-4 mb-4">
                      <div className="flex gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            Links não filtrados
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {needsEnrollment
                              ? 'Nenhum link específico para matrícula encontrado. Confirme que o link selecionado INCLUI taxa de matrícula.'
                              : 'Nenhum link específico para renovação encontrado. Confirme que o link selecionado NÃO inclui taxa de matrícula.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paymentLinks.map((link) => {
                      const badge = getLinkBadge(link);
                      return (
                        <Card
                          key={link.id}
                          className={`cursor-pointer transition-all ${
                            selectedLink?.id === link.id
                              ? 'border-accent ring-2 ring-accent/20'
                              : 'hover:border-accent/50'
                          }`}
                          onClick={() => setSelectedLink(link)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold">{link.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getFrequenciaBadge(link.frequencia)}
                                  {link.compromisso !== 'mensal' && ` • ${link.compromisso}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-accent">
                                  {formatPrice(link.amount_cents)}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {/* Enrollment badge - always show in fallback mode */}
                              {isFallbackMode && (
                                <Badge variant="outline" className={`text-xs ${badge.color}`}>
                                  {badge.icon === 'warning' && <AlertCircle className="h-3 w-3 mr-1" />}
                                  {badge.text}
                                </Badge>
                              )}
                              {linkHasEnrollmentFee(link) && !isFallbackMode && (
                                <Badge variant="secondary" className="text-xs">
                                  Com Matrícula
                                </Badge>
                              )}
                              {link.is_family_friends && (
                                <Badge variant="outline" className="text-xs border-purple-500 text-purple-600">
                                  F&F
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Nenhum link de pagamento disponível</p>
                  <p className="text-sm mt-1 mb-4">Pode continuar com pagamento em dinheiro</p>
                  <Button
                    variant="outline"
                    className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                    onClick={() => {
                      // Skip to payment step with DINHEIRO pre-selected
                      setPaymentMethod('DINHEIRO');
                      setCurrentStep(3); // Go to modalities (will skip if no modalities needed)
                    }}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Pagamento Manual (Dinheiro)
                  </Button>
                  <p className="text-xs mt-4 text-muted-foreground">
                    Ou configure links em <a href="/admin/stripe-links" className="text-accent underline">Admin → Stripe Links</a>
                  </p>
                </div>
              )}

              {/* Selected Link Summary */}
              {selectedLink && (
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
                  <p className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                    Resumo
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plano:</span>
                      <span>{selectedLink.display_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequência:</span>
                      <span>{getFrequenciaBadge(selectedLink.frequencia)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>TOTAL:</span>
                      <span className="text-accent">{formatPrice(selectedLink.amount_cents)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleLinkConfirm}
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={!selectedLink}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Select Modalities and Classes */}
        {currentStep === 3 && selectedMember && selectedLink && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                3. Modalidades e Turmas
              </CardTitle>
              <CardDescription>
                Selecione o que <strong>{selectedMember.nome}</strong> vai treinar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Modalities Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Modalidade(s)
                </Label>
                {isLoadingModalities ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {modalities?.map((mod) => (
                      <div
                        key={mod.id}
                        onClick={() => toggleModality(mod.id)}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedModalityIds.includes(mod.id)
                            ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                            : 'hover:border-accent/50'
                        }`}
                      >
                        <Checkbox
                          checked={selectedModalityIds.includes(mod.id)}
                          onCheckedChange={() => toggleModality(mod.id)}
                        />
                        <span className="text-sm font-medium">{mod.nome}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Classes Selection (filtered by modality) */}
              {selectedModalityIds.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Turmas / Horários
                  </Label>
                  {isLoadingClasses ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : filteredClasses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredClasses.map((cls) => (
                        <div
                          key={cls.id}
                          onClick={() => toggleClass(cls.id)}
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedClassIds.includes(cls.id)
                              ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                              : 'hover:border-accent/50'
                          }`}
                        >
                          <Checkbox
                            checked={selectedClassIds.includes(cls.id)}
                            onCheckedChange={() => toggleClass(cls.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{cls.nome || cls.modalidade}</p>
                            <p className="text-xs text-muted-foreground">
                              {DAYS_PT[cls.dia_semana]} {cls.hora_inicio?.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <p>Nenhuma turma cadastrada para estas modalidades</p>
                      <p className="text-xs mt-1">Configure turmas em Admin → Horários</p>
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              {selectedModalityIds.length > 0 && (
                <div className="bg-secondary/50 p-4 rounded-lg border border-border space-y-2">
                  <p className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    Resumo
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modalidades:</span>
                      <span>
                        {selectedModalityIds
                          .map((id) => modalities?.find((m) => m.id === id)?.nome)
                          .join(', ')}
                      </span>
                    </div>
                    {selectedClassIds.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Turmas:</span>
                        <span>
                          {selectedClassIds
                            .map((id) => {
                              const cls = allClasses?.find((c) => c.id === id);
                              return cls ? `${DAYS_PT[cls.dia_semana]} ${cls.hora_inicio?.slice(0, 5)}` : '';
                            })
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleModalitiesConfirm}
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={selectedModalityIds.length === 0}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Payment Method */}
        {currentStep === 4 && selectedMember && selectedLink && (
          <Card>
            <CardHeader>
              <CardTitle>4. Método de Pagamento</CardTitle>
              <CardDescription>
                Total: <strong>{formatPrice(selectedLink.amount_cents)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method Selection */}
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    paymentMethod === 'DINHEIRO'
                      ? 'border-green-500 ring-2 ring-green-500/20'
                      : 'hover:border-green-500/50'
                  }`}
                  onClick={() => setPaymentMethod('DINHEIRO')}
                >
                  <CardContent className="p-4 text-center">
                    <Banknote className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p className="font-semibold">Dinheiro</p>
                    <p className="text-xs text-muted-foreground">Pagamento imediato</p>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${
                    paymentMethod === 'STRIPE'
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'hover:border-blue-500/50'
                  }`}
                  onClick={() => setPaymentMethod('STRIPE')}
                >
                  <CardContent className="p-4 text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <p className="font-semibold">Stripe</p>
                    <p className="text-xs text-muted-foreground">Link de pagamento</p>
                  </CardContent>
                </Card>
              </div>

              {paymentMethod === 'STRIPE' && (
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">
                        Pagamento Online via Stripe
                      </p>
                      <p className="text-xs text-white/80">
                        Será gerado um link seguro. O membro será ativado automaticamente após o pagamento.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'DINHEIRO' && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Pagamento em Dinheiro
                      </p>
                      <p className="text-xs text-green-800/80 dark:text-green-200/80">
                        O membro será ativado imediatamente após confirmar.
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
                    <span>{selectedLink.display_name}</span>
                  </div>
                  {selectedModalityIds.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modalidade(s):</span>
                      <span>
                        {selectedModalityIds
                          .map((id) => modalities?.find((m) => m.id === id)?.nome)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedClassIds.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turma(s):</span>
                      <span>
                        {selectedClassIds
                          .map((id) => {
                            const cls = allClasses?.find((c) => c.id === id);
                            return cls ? `${DAYS_PT[cls.dia_semana]} ${cls.hora_inicio?.slice(0, 5)}` : '';
                          })
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-accent">{formatPrice(selectedLink.amount_cents)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1" disabled={isProcessing}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handlePaymentConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!paymentMethod || isProcessing}
                >
                  {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {paymentMethod === 'STRIPE' ? 'Gerar Link' : 'Confirmar Matrícula'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stripe Checkout Dialog */}
      <Dialog open={showStripeDialog} onOpenChange={setShowStripeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link de Pagamento Criado</DialogTitle>
            <DialogDescription>
              Envie este link ao membro via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Checkout URL */}
            <div className="space-y-2">
              <Label>Link de Pagamento</Label>
              <div className="flex gap-2">
                <Input
                  value={stripeCheckoutUrl}
                  readOnly
                  className="flex-1 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(stripeCheckoutUrl);
                    toast({ title: '✓ Link copiado!' });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>

            {/* Member Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Membro:</span>
                <span className="font-medium">{selectedMember?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano:</span>
                <span className="font-medium">{selectedLink?.display_name}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total:</span>
                <span>{formatPrice(selectedLink?.amount_cents || 0)}</span>
              </div>
            </div>

            {/* WhatsApp Send Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                const phone = selectedMember?.telefone.replace(/\D/g, '');

                const message = `Olá ${selectedMember?.nome}! 👋

Segue o link para pagamento da sua matrícula:

📦 *${selectedLink?.display_name}*
💶 Valor: *${formatPrice(selectedLink?.amount_cents || 0)}*

🔗 Link de pagamento:
${stripeCheckoutUrl}

Pode pagar com cartão ou Klarna (parcelado).

Qualquer dúvida, estamos à disposição!`;

                const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');

                toast({
                  title: 'WhatsApp aberto',
                  description: 'Envie a mensagem ao membro',
                });
              }}
            >
              <Phone className="mr-2 h-5 w-5" />
              Enviar via WhatsApp
            </Button>

            {/* Instructions */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p className="font-medium">Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Envie o link ao membro via WhatsApp</li>
                <li>Membro completa o pagamento online</li>
                <li>Membro é ativado automaticamente pelo webhook</li>
              </ol>
            </div>

            {/* Close Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowStripeDialog(false);
                setIsSuccess(true);
              }}
            >
              Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Enrollment;
