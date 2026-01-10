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
import { Plus, Pencil, Trash2, Users, CreditCard, Search } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [formData, setFormData] = useState<CoachFormData>(initialFormData);

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
      </div>
    </DashboardLayout>
  );
};

export default Coaches;
