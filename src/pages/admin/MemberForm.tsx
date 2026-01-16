import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save, QrCode, Trash2, Plus, Receipt, Pause, Play, CalendarDays } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  validateFreezeRequest,
  calculateNewExpiresAt,
  isCurrentlyFrozen,
  getRemainingFreezeDays,
  type FreezeHistory,
} from '@/lib/subscription-freeze';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const memberSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  telefone: z.string().min(9, 'Telefone inválido').max(20),
});

interface Member {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  qr_code: string;
  status: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO' | 'PAUSADO';
  access_type: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS' | null;
  access_expires_at: string | null;
  credits_remaining: number;
  current_plan_id: string | null;
  current_subscription_id: string | null;
  created_at: string;
  plans?: {
    id: string;
    nome: string;
    tipo: string;
    preco_cents: number;
    duracao_dias: number | null;
  } | null;
}

interface Subscription {
  id: string;
  member_id: string;
  status: string;
  frozen_at: string | null;
  frozen_until: string | null;
  freeze_reason: string | null;
  original_expires_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
}

interface MemberIban {
  id: string;
  member_id: string;
  iban: string;
  label: string | null;
  is_primary: boolean;
}

interface Transaction {
  id: string;
  type: 'RECEITA' | 'DESPESA';
  category: string;
  amount_cents: number;
  payment_method: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'SUBSCRIPTION': 'Mensalidade',
    'CREDITS': 'Créditos',
    'DAILY_PASS': 'Diária',
    'TAXA_MATRICULA': 'Taxa Matrícula',
    'PRODUTOS': 'Produtos',
    'RENTAL_FIXED': 'Rental Fixo',
    'RENTAL_PERCENTAGE': 'Rental %',
  };
  return labels[category] || category;
};

const getMethodLabel = (method: string | null): string => {
  if (!method) return '—';
  const labels: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'CARTAO': 'Cartão',
    'MBWAY': 'MB Way',
    'TRANSFERENCIA': 'Transferência',
  };
  return labels[method] || method;
};

const MemberForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== 'new';
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    status: 'LEAD' as Member['status'],
  });

  const [newIban, setNewIban] = useState({ iban: '', label: '' });
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeUntil, setFreezeUntil] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch member data if editing (with plan join)
  const { data: member, isLoading: isLoadingMember } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      if (!isEditing) return null;
      const { data, error } = await supabase
        .from('members')
        .select('*, plans(id, nome, tipo, preco_cents, duracao_dias)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Member | null;
    },
    enabled: isEditing,
  });

  // Fetch member IBANs if editing
  const { data: ibans, isLoading: isLoadingIbans } = useQuery({
    queryKey: ['member-ibans', id],
    queryFn: async () => {
      if (!isEditing) return [];
      const { data, error } = await supabase
        .from('member_ibans')
        .select('*')
        .eq('member_id', id)
        .order('created_at');
      if (error) throw error;
      return data as MemberIban[];
    },
    enabled: isEditing,
  });

  // Fetch member transactions if editing
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['member-transactions', id],
    queryFn: async () => {
      if (!isEditing) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: isEditing,
  });

  // Fetch current subscription for freeze info
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['member-subscription', member?.current_subscription_id],
    queryFn: async () => {
      if (!member?.current_subscription_id) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', member.current_subscription_id)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!member?.current_subscription_id,
  });

  // Fetch freeze history for validation
  const { data: freezeHistory } = useQuery({
    queryKey: ['freeze-history', id],
    queryFn: async () => {
      if (!isEditing) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('frozen_at, frozen_until')
        .eq('member_id', id)
        .not('frozen_at', 'is', null);
      if (error) throw error;
      return (data || []).filter(s => s.frozen_at && s.frozen_until) as FreezeHistory[];
    },
    enabled: isEditing,
  });

  // Update form when member data loads
  useEffect(() => {
    if (member) {
      setFormData({
        nome: member.nome,
        email: member.email || '',
        telefone: member.telefone,
        status: member.status,
      });
    }
  }, [member]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { nome: string; email: string; telefone: string }) => {
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
          email: data.email || null,
          telefone: data.telefone,
          qr_code: '', // Will be auto-generated by trigger
        })
        .select()
        .single();
      if (error) throw error;
      return newMember;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({ title: 'Membro criado com sucesso' });
      navigate(`/admin/members/${data.id}`);
    },
    onError: (error) => {
      console.error('Error creating member:', error);
      toast({
        title: 'Erro ao criar membro',
        description: error instanceof Error ? error.message : 'Verifique os dados',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { nome: string; email: string; telefone: string; status: Member['status'] }) => {
      // Check for existing member with same phone or email (excluding current member)
      const orConditions = [`telefone.eq.${data.telefone}`];
      if (data.email) {
        orConditions.push(`email.eq.${data.email}`);
      }
      const { data: existing } = await supabase
        .from('members')
        .select('id, nome, telefone, email')
        .or(orConditions.join(','))
        .neq('id', id) // Exclude current member
        .limit(1);

      if (existing && existing.length > 0) {
        const match = existing[0];
        const matchField = match.telefone === data.telefone ? 'telefone' : 'email';
        throw new Error(`Já existe membro com este ${matchField}: ${match.nome}`);
      }

      const { error } = await supabase
        .from('members')
        .update({
          nome: data.nome,
          email: data.email || null,
          telefone: data.telefone,
          status: data.status,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      toast({ title: 'Membro atualizado com sucesso' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar membro',
        description: error instanceof Error ? error.message : 'Verifique os dados',
        variant: 'destructive',
      });
    },
  });

  // Add IBAN mutation
  const addIbanMutation = useMutation({
    mutationFn: async (data: { iban: string; label: string }) => {
      const { error } = await supabase
        .from('member_ibans')
        .insert({
          member_id: id,
          iban: data.iban.replace(/\s/g, '').toUpperCase(),
          label: data.label || null,
          is_primary: (ibans?.length || 0) === 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-ibans', id] });
      setNewIban({ iban: '', label: '' });
      toast({ title: 'IBAN adicionado' });
    },
    onError: () => {
      toast({ title: 'Erro ao adicionar IBAN', variant: 'destructive' });
    },
  });

  // Delete IBAN mutation
  const deleteIbanMutation = useMutation({
    mutationFn: async (ibanId: string) => {
      const { error } = await supabase
        .from('member_ibans')
        .delete()
        .eq('id', ibanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-ibans', id] });
      toast({ title: 'IBAN removido' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover IBAN', variant: 'destructive' });
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No member ID');

      // Check if member has transactions
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', id);

      if (txCount && txCount > 0) {
        throw new Error(`Este membro tem ${txCount} transação(ões) registrada(s). Não é possível excluir membros com histórico financeiro. Use o status "Cancelado" em vez disso.`);
      }

      // Check if member has check-ins
      const { count: checkinCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', id);

      if (checkinCount && checkinCount > 0) {
        throw new Error(`Este membro tem ${checkinCount} check-in(s) registrado(s). Não é possível excluir membros com histórico de acesso. Use o status "Cancelado" em vez disso.`);
      }

      // Delete related data first (IBANs, subscriptions, pending_payments)
      await supabase.from('member_ibans').delete().eq('member_id', id);
      await supabase.from('subscriptions').delete().eq('member_id', id);
      await supabase.from('pending_payments').delete().eq('member_id', id);

      // Delete the member
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({ title: 'Membro excluído com sucesso' });
      navigate('/admin/members');
    },
    onError: (error) => {
      console.error('Error deleting member:', error);
      toast({
        title: 'Erro ao excluir membro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  // Freeze subscription mutation
  const freezeMutation = useMutation({
    mutationFn: async ({ until, reason }: { until: string; reason: string }) => {
      if (!subscription || !member) throw new Error('No subscription found');

      const freezeUntilDate = new Date(until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const freezeDays = Math.ceil((freezeUntilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Validate freeze request (staff override = true for admin)
      const validation = validateFreezeRequest(freezeHistory || [], freezeDays, true);
      if (!validation.valid) {
        throw new Error(validation.error || 'Freeze validation failed');
      }

      // Calculate new expires_at
      const newExpiresAt = subscription.expires_at
        ? calculateNewExpiresAt(subscription.expires_at, freezeUntilDate)
        : null;

      // Update subscription with freeze info
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          frozen_at: today.toISOString().split('T')[0],
          frozen_until: until,
          freeze_reason: reason || null,
          original_expires_at: subscription.expires_at,
          expires_at: newExpiresAt,
        })
        .eq('id', subscription.id);
      if (subError) throw subError;

      // Update member status to PAUSADO
      const { error: memberError } = await supabase
        .from('members')
        .update({ status: 'PAUSADO' })
        .eq('id', member.id);
      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['member-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['freeze-history', id] });
      setFreezeDialogOpen(false);
      setFreezeUntil('');
      setFreezeReason('');
      toast({ title: 'Subscricao pausada com sucesso' });
    },
    onError: (error) => {
      console.error('Freeze error:', error);
      toast({
        title: 'Erro ao pausar subscricao',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  // Unfreeze subscription mutation
  const unfreezeMutation = useMutation({
    mutationFn: async () => {
      if (!subscription || !member) throw new Error('No subscription found');

      // Update subscription - restore original expires_at and clear freeze fields
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          frozen_at: null,
          frozen_until: null,
          freeze_reason: null,
          expires_at: subscription.original_expires_at || subscription.expires_at,
          original_expires_at: null,
        })
        .eq('id', subscription.id);
      if (subError) throw subError;

      // Update member status back to ATIVO
      const { error: memberError } = await supabase
        .from('members')
        .update({ status: 'ATIVO' })
        .eq('id', member.id);
      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['member-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['freeze-history', id] });
      toast({ title: 'Subscricao reativada com sucesso' });
    },
    onError: (error) => {
      console.error('Unfreeze error:', error);
      toast({ title: 'Erro ao reativar subscricao', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = memberSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (isEditing) {
      updateMutation.mutate({ ...formData, status: formData.status });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddIban = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIban.iban) return;
    addIbanMutation.mutate(newIban);
  };

  const isLoading = isLoadingMember || isLoadingIbans || isLoadingTransactions || isLoadingSubscription;
  const remainingFreezeDays = getRemainingFreezeDays(freezeHistory || []);
  const isFrozen = subscription ? isCurrentlyFrozen(subscription.frozen_at, subscription.frozen_until) : false;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/members')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl tracking-wider mb-1">
                {isEditing ? 'EDITAR MEMBRO' : 'NOVO MEMBRO'}
              </h1>
              {isEditing && member && (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-secondary px-2 py-1 rounded">{member.qr_code}</code>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/m/${member.qr_code}`} target="_blank" rel="noopener noreferrer">
                      <QrCode className="h-4 w-4 mr-1" />
                      Ver QR
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
          {isEditing && (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">Excluir Membro</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja excluir <strong>{member?.nome}</strong>?
                    <br /><br />
                    Esta ação é <strong>permanente</strong> e não pode ser desfeita.
                    <br /><br />
                    <span className="text-xs text-muted-foreground">
                      Nota: Membros com transações ou check-ins não podem ser excluídos.
                      Use o status "Cancelado" nesses casos.
                    </span>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMemberMutation.mutate()}
                    disabled={deleteMemberMutation.isPending}
                  >
                    {deleteMemberMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Sim, Excluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isEditing ? (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="pagamentos" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Pagamentos
                {transactions && transactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {transactions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-6 mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Member Form */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="uppercase tracking-wider text-base">Dados do Membro</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          className="bg-secondary border-border"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone *</Label>
                        <Input
                          id="telefone"
                          value={formData.telefone}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          className="bg-secondary border-border"
                          placeholder="+351 912 345 678"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-secondary border-border"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value: Member['status']) =>
                            setFormData({ ...formData, status: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LEAD">Lead</SelectItem>
                            <SelectItem value="ATIVO">Ativo</SelectItem>
                            <SelectItem value="PAUSADO">Pausado</SelectItem>
                            <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                            <SelectItem value="CANCELADO">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-accent hover:bg-accent/90"
                        disabled={isSubmitting}
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Alterações
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* IBANs */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="uppercase tracking-wider text-base">IBANs</CardTitle>
                    <CardDescription>
                      IBANs associados para identificação de pagamentos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing IBANs */}
                    {ibans && ibans.length > 0 ? (
                      <div className="space-y-2">
                        {ibans.map((iban) => (
                          <div
                            key={iban.id}
                            className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                          >
                            <div>
                              <code className="text-sm">{iban.iban}</code>
                              {iban.label && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {iban.label}
                                </Badge>
                              )}
                              {iban.is_primary && (
                                <Badge className="ml-2 text-xs bg-accent">Principal</Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteIbanMutation.mutate(iban.id)}
                              disabled={deleteIbanMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum IBAN cadastrado</p>
                    )}

                    {/* Add IBAN Form */}
                    <form onSubmit={handleAddIban} className="space-y-3 pt-4 border-t border-border">
                      <div className="space-y-2">
                        <Label htmlFor="newIban">Adicionar IBAN</Label>
                        <Input
                          id="newIban"
                          value={newIban.iban}
                          onChange={(e) => setNewIban({ ...newIban, iban: e.target.value })}
                          className="bg-secondary border-border"
                          placeholder="PT50 0000 0000 0000 0000 0000 0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ibanLabel">Rótulo (opcional)</Label>
                        <Input
                          id="ibanLabel"
                          value={newIban.label}
                          onChange={(e) => setNewIban({ ...newIban, label: e.target.value })}
                          className="bg-secondary border-border"
                          placeholder="Pessoal, Empresa, etc."
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full"
                        disabled={!newIban.iban || addIbanMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar IBAN
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Access Info */}
              {member && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="uppercase tracking-wider text-base">Acesso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                          Plano Atual
                        </p>
                        <p className="font-medium">
                          {member.plans?.nome || (
                            <span className="text-muted-foreground">Nenhum plano</span>
                          )}
                        </p>
                        {member.plans && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            €{(member.plans.preco_cents / 100).toFixed(2)}
                            {member.plans.duracao_dias && ` / ${member.plans.duracao_dias} dias`}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                          Tipo de Acesso
                        </p>
                        <p className="font-medium">
                          {member.access_type === 'SUBSCRIPTION' && 'Mensalidade'}
                          {member.access_type === 'CREDITS' && 'Créditos'}
                          {member.access_type === 'DAILY_PASS' && 'Diária'}
                          {!member.access_type && <span className="text-muted-foreground">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                          Expira em
                        </p>
                        <p className="font-medium">
                          {member.access_expires_at
                            ? new Date(member.access_expires_at).toLocaleDateString('pt-PT')
                            : <span className="text-muted-foreground">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                          Créditos Restantes
                        </p>
                        <p className="font-medium">
                          {member.credits_remaining}
                        </p>
                      </div>
                    </div>

                    {/* Freeze Status Alert */}
                    {isFrozen && subscription && (
                      <Alert className="border-yellow-500/50 bg-yellow-500/10">
                        <Pause className="h-4 w-4 text-yellow-500" />
                        <AlertTitle className="text-yellow-500">Subscricao Pausada</AlertTitle>
                        <AlertDescription className="text-yellow-400/80">
                          Pausada ate {subscription.frozen_until ? format(new Date(subscription.frozen_until), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          {subscription.freeze_reason && (
                            <span className="block mt-1 text-xs">Motivo: {subscription.freeze_reason}</span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Freeze/Unfreeze Actions */}
                    {member.current_subscription_id && member.status === 'ATIVO' && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Pausar Subscricao</p>
                            <p className="text-xs text-muted-foreground">
                              Dias restantes este ano: {remainingFreezeDays} de 30
                            </p>
                          </div>
                          <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                                disabled={remainingFreezeDays <= 0}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Pausar Subscricao</DialogTitle>
                                <DialogDescription>
                                  A subscricao sera pausada e o acesso bloqueado ate a data selecionada.
                                  O periodo de pausa sera adicionado ao vencimento.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="freezeUntil">Pausar ate *</Label>
                                  <Input
                                    id="freezeUntil"
                                    type="date"
                                    value={freezeUntil}
                                    onChange={(e) => setFreezeUntil(e.target.value)}
                                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                    max={new Date(Date.now() + remainingFreezeDays * 86400000).toISOString().split('T')[0]}
                                    className="bg-secondary border-border"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Maximo: {remainingFreezeDays} dias restantes este ano
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="freezeReason">Motivo (opcional)</Label>
                                  <Textarea
                                    id="freezeReason"
                                    value={freezeReason}
                                    onChange={(e) => setFreezeReason(e.target.value)}
                                    placeholder="Ex: Viagem, lesao, etc."
                                    className="bg-secondary border-border"
                                    rows={2}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="ghost" onClick={() => setFreezeDialogOpen(false)}>
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={() => freezeMutation.mutate({ until: freezeUntil, reason: freezeReason })}
                                  disabled={!freezeUntil || freezeMutation.isPending}
                                  className="bg-yellow-600 hover:bg-yellow-700"
                                >
                                  {freezeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  <Pause className="h-4 w-4 mr-2" />
                                  Confirmar Pausa
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    )}

                    {/* Unfreeze Action */}
                    {isFrozen && member.status === 'PAUSADO' && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Reativar Subscricao</p>
                            <p className="text-xs text-muted-foreground">
                              Encerrar pausa e restaurar acesso imediatamente
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                            onClick={() => unfreezeMutation.mutate()}
                            disabled={unfreezeMutation.isPending}
                          >
                            {unfreezeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Play className="h-4 w-4 mr-2" />
                            Reativar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Auto-renewal status */}
                    {subscription && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Renovacao Automatica</p>
                            <p className="text-xs text-muted-foreground">
                              {subscription.auto_renew ? 'Ativada' : 'Desativada'}
                            </p>
                          </div>
                          <Badge variant={subscription.auto_renew ? 'default' : 'secondary'}>
                            {subscription.auto_renew ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pagamentos" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Histórico de Pagamentos
                  </CardTitle>
                  <CardDescription>
                    Todas as transações deste membro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions && transactions.length > 0 ? (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-secondary/50">
                            <TableHead className="text-xs uppercase tracking-wider">Data</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider">Categoria</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-right">Valor</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider">Método</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider">Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((t) => (
                            <TableRow key={t.id} className="border-border">
                              <TableCell className="text-sm">
                                {format(new Date(t.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {getCategoryLabel(t.category)}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${t.type === 'RECEITA' ? 'text-green-500' : 'text-red-500'}`}>
                                {t.type === 'RECEITA' ? '+' : '-'}€{(t.amount_cents / 100).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {getMethodLabel(t.payment_method)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {t.description || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Nenhum pagamento registrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          /* New Member Form (no tabs) */
          <Card className="bg-card border-border max-w-lg">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base">Dados do Membro</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-secondary border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="+351 912 345 678"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Criar Membro
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MemberForm;
