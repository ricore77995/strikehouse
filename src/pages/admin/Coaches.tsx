import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Users, CreditCard, Search, Wallet, PlusCircle, MinusCircle, Key, Loader2, Eye, Phone, Mail, KeyRound, Copy, Check, RotateCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';

interface Coach {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  modalidade: string | null;
  fee_type: string;
  fee_value: number;
  credits_balance: number | null;
  ativo: boolean;
  created_at: string | null;
  user_id: string | null;
}

interface CoachGuest {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  notas: string | null;
  created_at: string | null;
}

interface CoachFormData {
  nome: string;
  email: string;
  telefone: string;
  modalidade: string;
  fee_type: 'FIXED' | 'PERCENTAGE';
  fee_value: string;
}

const initialFormData: CoachFormData = {
  nome: '',
  email: '',
  telefone: '',
  modalidade: '',
  fee_type: 'FIXED',
  fee_value: '',
};

const Coaches = () => {
  const { toast } = useToast();
  const { staffId } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [formData, setFormData] = useState<CoachFormData>(initialFormData);

  // Credit adjustment state
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [creditCoach, setCreditCoach] = useState<Coach | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<'add' | 'subtract'>('add');
  const [creditNote, setCreditNote] = useState('');

  // Login creation state
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [loginCoach, setLoginCoach] = useState<Coach | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [isCreatingLogin, setIsCreatingLogin] = useState(false);
  const [resettingPasswordCoachId, setResettingPasswordCoachId] = useState<string | null>(null);

  // Password generation state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordCoach, setPasswordCoach] = useState<Coach | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Guest view state
  const [isGuestsDialogOpen, setIsGuestsDialogOpen] = useState(false);
  const [viewingCoach, setViewingCoach] = useState<Coach | null>(null);
  const [coachGuests, setCoachGuests] = useState<CoachGuest[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);

  // Fetch coaches
  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ['coaches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_coaches')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as Coach[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CoachFormData) => {
      const payload = {
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        modalidade: data.modalidade || null,
        fee_type: data.fee_type,
        fee_value: data.fee_type === 'FIXED' 
          ? Math.round(parseFloat(data.fee_value) * 100) 
          : Math.round(parseFloat(data.fee_value) * 100), // percentage * 100
      };

      if (editingCoach) {
        const { error } = await supabase
          .from('external_coaches')
          .update(payload)
          .eq('id', editingCoach.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('external_coaches')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      toast({
        title: editingCoach ? 'Coach atualizado' : 'Coach criado',
        description: `${formData.nome} foi ${editingCoach ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o coach.',
        variant: 'destructive',
      });
      console.error(error);
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('external_coaches')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      toast({ title: 'Status atualizado' });
    },
  });

  // Credit adjustment mutation
  const creditAdjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!creditCoach || !creditAmount) throw new Error('Dados inválidos');

      const amount = Math.round(parseFloat(creditAmount)); // unidades de sessão
      const finalAmount = creditType === 'add' ? amount : -amount;

      // Insert credit record
      const { error: creditError } = await supabase
        .from('coach_credits')
        .insert({
          coach_id: creditCoach.id,
          amount: finalAmount,
          reason: 'ADJUSTMENT',
          expires_at: null, // Manual adjustments don't expire
        });

      if (creditError) throw creditError;

      // Update coach balance
      const newBalance = (creditCoach.credits_balance || 0) + finalAmount;
      const { error: updateError } = await supabase
        .from('external_coaches')
        .update({ credits_balance: newBalance })
        .eq('id', creditCoach.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      toast({
        title: 'Crédito ajustado',
        description: `${creditType === 'add' ? 'Adicionado' : 'Removido'} ${creditAmount} sessão(ões) para ${creditCoach?.nome}`,
      });
      handleCloseCreditDialog();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível ajustar o crédito.',
        variant: 'destructive',
      });
    },
  });

  // Login creation mutation
  const createLoginMutation = useMutation({
    mutationFn: async (coach: Coach) => {
      if (!coach.email) throw new Error('Coach deve ter email cadastrado');

      // Check if coach already has login
      if (coach.user_id) {
        throw new Error('Este coach já possui login criado');
      }

      // Generate random password
      const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

      // Store current admin session before signUp (signUp auto-signs in as new user)
      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData.session;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: coach.email,
        password: password,
        options: {
          data: {
            is_coach: true,
            coach_id: coach.id,
          },
        },
      });

      // Restore admin session immediately
      if (adminSession) {
        await supabase.auth.setSession(adminSession);
      }

      // Handle errors
      if (authError) {
        if (authError.message?.includes('already registered')) {
          throw new Error('Este email já está registrado no sistema. Use outro email ou contacte o suporte.');
        }
        throw authError;
      }

      // Check if user was actually created (identities array will be empty if email already exists)
      if (!authData.user || !authData.user.identities || authData.user.identities.length === 0) {
        // User already exists - check if it's a staff member first
        if (authData.user?.id) {
          const existingUserId = authData.user.id;

          // Check if this user is already a staff member
          const { data: existingStaff } = await supabase
            .from('staff')
            .select('id, nome, role')
            .eq('user_id', existingUserId)
            .eq('ativo', true)
            .single();

          if (existingStaff) {
            throw new Error(`Este email pertence a um membro da equipe (${existingStaff.nome} - ${existingStaff.role}). Use outro email para o coach.`);
          }

          // Check if this user is already linked to another coach
          const { data: existingCoach } = await supabase
            .from('external_coaches')
            .select('id, nome')
            .eq('user_id', existingUserId)
            .eq('ativo', true)
            .single();

          if (existingCoach && existingCoach.id !== coach.id) {
            throw new Error(`Este email já está vinculado ao coach "${existingCoach.nome}". Use outro email.`);
          }

          // Safe to link - user exists but is not staff or another coach
          const { error: linkError } = await supabase
            .from('external_coaches')
            .update({ user_id: existingUserId })
            .eq('id', coach.id)
            .is('user_id', null);

          if (linkError) {
            throw new Error('Erro ao vincular usuário existente. Verifique se o email está correto.');
          }

          // Return without password since user already exists
          return { password: '(senha existente - use "Esqueci minha senha" no login)', userId: existingUserId };
        }

        throw new Error('Este email já está registrado no sistema. Use outro email para o coach.');
      }

      const newUserId = authData.user.id;

      // Link user_id to coach (now running as admin again)
      const { error: updateError } = await supabase
        .from('external_coaches')
        .update({ user_id: newUserId })
        .eq('id', coach.id)
        .is('user_id', null); // Only update if user_id is still null (prevents race condition)

      if (updateError) {
        // If update failed due to conflict, coach might already have a user_id
        throw new Error('Erro ao vincular login. Recarregue a página e tente novamente.');
      }

      return { password, userId: newUserId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      setTempPassword(data.password);
      setIsCreatingLogin(false);
    },
    onError: (error: any) => {
      setIsCreatingLogin(false);
      toast({
        title: 'Erro ao criar login',
        description: error.message || 'Não foi possível criar o login.',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (coach: Coach) => {
      if (!coach.email) throw new Error('Coach não tem email cadastrado');
      if (!coach.user_id) throw new Error('Coach não tem login criado');

      const { error } = await supabase.auth.resetPasswordForEmail(coach.email, {
        redirectTo: `${window.location.origin}/coach/login`,
      });

      if (error) throw error;
      return coach;
    },
    onSuccess: (coach) => {
      setResettingPasswordCoachId(null);
      toast({
        title: 'Email enviado',
        description: `Um email de redefinição de senha foi enviado para ${coach.email}`,
      });
    },
    onError: (error: any) => {
      setResettingPasswordCoachId(null);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível enviar o email.',
        variant: 'destructive',
      });
    },
  });

  const handleResetPassword = (coach: Coach) => {
    setResettingPasswordCoachId(coach.id);
    resetPasswordMutation.mutate(coach);
  };

  // Generate password mutation (calls edge function)
  const generatePasswordMutation = useMutation({
    mutationFn: async (coach: Coach) => {
      if (!coach.user_id) throw new Error('Coach não tem login criado');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-coach-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ coach_id: coach.id }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao gerar senha');
      }

      return result;
    },
    onSuccess: (data) => {
      setGeneratedPassword(data.password);
      setIsGeneratingPassword(false);
    },
    onError: (error: any) => {
      setIsGeneratingPassword(false);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível gerar a senha.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenPasswordDialog = (coach: Coach) => {
    setPasswordCoach(coach);
    setGeneratedPassword('');
    setPasswordCopied(false);
    setIsPasswordDialogOpen(true);
  };

  const handleClosePasswordDialog = () => {
    setIsPasswordDialogOpen(false);
    setPasswordCoach(null);
    setGeneratedPassword('');
    setPasswordCopied(false);
  };

  const handleGeneratePassword = () => {
    if (!passwordCoach) return;
    setIsGeneratingPassword(true);
    generatePasswordMutation.mutate(passwordCoach);
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleCopyWhatsAppMessage = async () => {
    if (!generatedPassword || !passwordCoach) return;
    const message = `Olá ${passwordCoach.nome}!\n\nSuas credenciais de acesso ao portal:\n\nEmail: ${passwordCoach.email}\nSenha: ${generatedPassword}\n\nAcesse: ${window.location.origin}/coach/login`;
    await navigator.clipboard.writeText(message);
    toast({ title: 'Mensagem copiada!', description: 'Cole no WhatsApp para enviar' });
  };

  const handleOpenLoginDialog = (coach: Coach) => {
    setLoginCoach(coach);
    setTempPassword('');
    setIsCreatingLogin(false);
    setIsLoginDialogOpen(true);
  };

  const handleCloseLoginDialog = () => {
    setIsLoginDialogOpen(false);
    setLoginCoach(null);
    setTempPassword('');
    setIsCreatingLogin(false);
  };

  const handleCreateLogin = () => {
    if (!loginCoach) return;
    setIsCreatingLogin(true);
    createLoginMutation.mutate(loginCoach);
  };

  const handleOpenGuestsDialog = async (coach: Coach) => {
    setViewingCoach(coach);
    setIsGuestsDialogOpen(true);
    setIsLoadingGuests(true);

    const { data, error } = await supabase
      .from('coach_guests')
      .select('*')
      .eq('coach_id', coach.id)
      .eq('ativo', true)
      .order('nome');

    setIsLoadingGuests(false);
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os alunos.',
        variant: 'destructive',
      });
      return;
    }

    setCoachGuests((data || []) as CoachGuest[]);
  };

  const handleCloseGuestsDialog = () => {
    setIsGuestsDialogOpen(false);
    setViewingCoach(null);
    setCoachGuests([]);
  };

  const handleOpenCreditDialog = (coach: Coach) => {
    setCreditCoach(coach);
    setCreditAmount('');
    setCreditType('add');
    setCreditNote('');
    setIsCreditDialogOpen(true);
  };

  const handleCloseCreditDialog = () => {
    setIsCreditDialogOpen(false);
    setCreditCoach(null);
    setCreditAmount('');
    setCreditNote('');
  };

  const handleOpenCreate = () => {
    setEditingCoach(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      nome: coach.nome,
      email: coach.email || '',
      telefone: coach.telefone || '',
      modalidade: coach.modalidade || '',
      fee_type: coach.fee_type as 'FIXED' | 'PERCENTAGE',
      fee_value: coach.fee_type === 'FIXED' 
        ? (coach.fee_value / 100).toString() 
        : (coach.fee_value / 100).toString(),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCoach(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.fee_value) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e valor da taxa são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredCoaches = coaches.filter(coach =>
    coach.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coach.modalidade?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFee = (coach: Coach) => {
    if (coach.fee_type === 'FIXED') {
      return `€${(coach.fee_value / 100).toFixed(2)}/sessão`;
    }
    return `${(coach.fee_value / 100).toFixed(0)}%`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">COACHES EXTERNOS</h1>
            <p className="text-muted-foreground text-sm">
              Gerir coaches parceiros e taxas de sublocação
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="uppercase tracking-wider text-xs">
                <Plus className="h-4 w-4 mr-2" />
                Novo Coach
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider">
                  {editingCoach ? 'Editar Coach' : 'Novo Coach'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-secondary"
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-secondary"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="bg-secondary"
                      placeholder="+351 XXX XXX XXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Input
                    value={formData.modalidade}
                    onChange={(e) => setFormData({ ...formData, modalidade: e.target.value })}
                    className="bg-secondary"
                    placeholder="Ex: Muay Thai, BJJ, Boxing..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Taxa *</Label>
                    <Select
                      value={formData.fee_type}
                      onValueChange={(value: 'FIXED' | 'PERCENTAGE') => 
                        setFormData({ ...formData, fee_type: value })
                      }
                    >
                      <SelectTrigger className="bg-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Valor Fixo (€)</SelectItem>
                        <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {formData.fee_type === 'FIXED' ? 'Valor (€) *' : 'Percentual (%) *'}
                    </Label>
                    <Input
                      type="number"
                      step={formData.fee_type === 'FIXED' ? '0.01' : '1'}
                      value={formData.fee_value}
                      onChange={(e) => setFormData({ ...formData, fee_value: e.target.value })}
                      className="bg-secondary"
                      placeholder={formData.fee_type === 'FIXED' ? '25.00' : '20'}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total de Coaches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-light">{coaches.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Coaches Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-light">{coaches.filter(c => c.ativo).length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Créditos Totais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-light">
                {coaches.reduce((sum, c) => sum + (c.credits_balance || 0), 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou modalidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredCoaches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'Nenhum coach encontrado' : 'Nenhum coach cadastrado'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="uppercase text-xs tracking-wider">Nome</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider">Modalidade</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider">Contato</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider">Taxa</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider">Créditos</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider">Status</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoaches.map((coach) => (
                    <TableRow key={coach.id} className="border-border">
                      <TableCell className="font-medium">{coach.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {coach.modalidade || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {coach.telefone && <p>{coach.telefone}</p>}
                          {coach.email && (
                            <p className="text-muted-foreground text-xs">{coach.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {formatFee(coach)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{coach.credits_balance || 0}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={coach.ativo ? 'default' : 'secondary'}
                          className={coach.ativo ? 'bg-green-500/20 text-green-400' : ''}
                        >
                          {coach.ativo ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!coach.user_id && coach.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenLoginDialog(coach)}
                              title="Criar login"
                              className="text-orange-500 hover:text-orange-400"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          )}
                          {coach.user_id && (
                            <>
                              <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                                Login
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPasswordDialog(coach)}
                                title="Gerar/Ver senha"
                                className="text-orange-500 hover:text-orange-400"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenGuestsDialog(coach)}
                            title="Ver alunos"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenCreditDialog(coach)}
                            title="Ajustar créditos"
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(coach)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({
                              id: coach.id,
                              ativo: !coach.ativo,
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Credit Adjustment Dialog */}
        <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">
                Ajustar Créditos
              </DialogTitle>
            </DialogHeader>
            {creditCoach && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Coach</p>
                  <p className="font-medium">{creditCoach.nome}</p>
                  <p className="text-sm text-muted-foreground mt-2">Saldo Atual</p>
                  <p className="text-2xl font-mono">
                    {creditCoach.credits_balance || 0} sessões
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Ajuste</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={creditType === 'add' ? 'default' : 'outline'}
                      className={`flex-1 ${creditType === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => setCreditType('add')}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                    <Button
                      type="button"
                      variant={creditType === 'subtract' ? 'default' : 'outline'}
                      className={`flex-1 ${creditType === 'subtract' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setCreditType('subtract')}
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade de Sessões</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="bg-secondary text-lg font-mono"
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Textarea
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    className="bg-secondary"
                    placeholder="Motivo do ajuste..."
                    rows={2}
                  />
                </div>

                {creditAmount && (
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">Novo Saldo</p>
                    <p className="text-2xl font-mono">
                      {(creditCoach.credits_balance || 0) +
                        (creditType === 'add' ? 1 : -1) * Math.round(parseFloat(creditAmount || '0'))} sessões
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseCreditDialog}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => creditAdjustmentMutation.mutate()}
                    disabled={!creditAmount || parseFloat(creditAmount) <= 0 || creditAdjustmentMutation.isPending}
                    className={creditType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                  >
                    {creditAdjustmentMutation.isPending ? 'Salvando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Login Creation Dialog */}
        <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">
                Criar Login do Coach
              </DialogTitle>
            </DialogHeader>
            {loginCoach && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Coach</p>
                  <p className="font-medium">{loginCoach.nome}</p>
                  <p className="text-sm text-muted-foreground mt-2">Email</p>
                  <p className="font-mono text-sm">{loginCoach.email}</p>
                </div>

                {!tempPassword ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Será criado um login com email <strong>{loginCoach.email}</strong> e uma senha temporária.
                      O coach poderá aceder em <strong>/coach/login</strong>.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={handleCloseLoginDialog}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreateLogin}
                        disabled={isCreatingLogin}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {isCreatingLogin ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            Criar Login
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-sm text-green-400 font-medium mb-2">Login criado com sucesso!</p>
                      <p className="text-sm text-muted-foreground">Senha temporária:</p>
                      <p className="font-mono text-lg bg-secondary p-2 rounded mt-1 select-all">
                        {tempPassword}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Guarde esta senha e envie ao coach. Ele deve alterá-la no primeiro acesso.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleCloseLoginDialog}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Guests View Dialog */}
        <Dialog open={isGuestsDialogOpen} onOpenChange={setIsGuestsDialogOpen}>
          <DialogContent className="bg-card sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider flex items-center gap-2">
                <Users className="h-5 w-5" />
                Alunos do Coach
              </DialogTitle>
            </DialogHeader>
            {viewingCoach && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Coach</p>
                  <p className="font-medium">{viewingCoach.nome}</p>
                  {viewingCoach.modalidade && (
                    <p className="text-sm text-muted-foreground">{viewingCoach.modalidade}</p>
                  )}
                </div>

                {isLoadingGuests ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : coachGuests.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {coachGuests.map((guest) => (
                        <div
                          key={guest.id}
                          className="p-3 bg-secondary rounded-lg"
                        >
                          <p className="font-medium">{guest.nome}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                            {guest.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {guest.telefone}
                              </span>
                            )}
                            {guest.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {guest.email}
                              </span>
                            )}
                          </div>
                          {guest.notas && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {guest.notas}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum aluno cadastrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O coach pode adicionar alunos no portal dele
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button variant="outline" onClick={handleCloseGuestsDialog}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Password Generation Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Gerar Senha do Coach
              </DialogTitle>
            </DialogHeader>
            {passwordCoach && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Coach</p>
                  <p className="font-medium">{passwordCoach.nome}</p>
                  <p className="text-sm text-muted-foreground mt-2">Email</p>
                  <p className="font-mono text-sm">{passwordCoach.email}</p>
                </div>

                {!generatedPassword ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Clique para gerar uma nova senha para o coach. A senha anterior será invalidada.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={handleClosePasswordDialog}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleGeneratePassword}
                        disabled={isGeneratingPassword}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {isGeneratingPassword ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Gerar Senha
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-sm text-green-400 font-medium mb-2">Senha gerada com sucesso!</p>
                      <p className="text-sm text-muted-foreground">Nova senha:</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-mono text-lg bg-secondary p-2 rounded flex-1 select-all">
                          {generatedPassword}
                        </p>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyPassword}
                          title="Copiar senha"
                        >
                          {passwordCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handleCopyWhatsAppMessage}
                      variant="outline"
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Mensagem para WhatsApp
                    </Button>

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleClosePasswordDialog}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Coaches;
