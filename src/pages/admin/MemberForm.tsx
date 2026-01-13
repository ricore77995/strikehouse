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
import { ArrowLeft, Loader2, Save, QrCode, Trash2, Plus, Receipt } from 'lucide-react';
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
  status: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  access_type: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS' | null;
  access_expires_at: string | null;
  credits_remaining: number;
  current_plan_id: string | null;
  created_at: string;
  plans?: {
    id: string;
    nome: string;
    tipo: string;
    preco_cents: number;
    duracao_dias: number | null;
  } | null;
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
      toast({ title: 'Erro ao criar membro', variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { nome: string; email: string; telefone: string; status: Member['status'] }) => {
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
    onError: () => {
      toast({ title: 'Erro ao atualizar membro', variant: 'destructive' });
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

  const isLoading = isLoadingMember || isLoadingIbans || isLoadingTransactions;
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
                  <CardContent>
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
