import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Plus, Mail, Shield, UserCog, Trash2 } from 'lucide-react';

type StaffRole = 'OWNER' | 'ADMIN' | 'STAFF';

interface StaffMember {
  id: string;
  nome: string;
  email: string;
  role: StaffRole;
  ativo: boolean;
  coach_id: string | null;
  user_id: string | null;
  created_at: string;
}

const Staff = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    role: 'STAFF' as StaffRole,
  });

  const { data: staffList, isLoading } = useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          external_coaches(nome)
        `)
        .order('role')
        .order('nome');
      if (error) throw error;
      return data as (StaffMember & { external_coaches?: { nome: string } })[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('staff').insert({
        nome: data.nome,
        email: data.email,
        role: data.role,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      toast.success('Staff criado com sucesso!');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar staff');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<StaffMember>) => {
      const { error } = await supabase.from('staff').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      toast.success('Staff atualizado!');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('staff').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      toast.success('Status atualizado!');
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', email: '', role: 'STAFF', coach_id: '' });
    setEditingStaff(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      updateMutation.mutate({
        id: editingStaff.id,
        nome: formData.nome,
        email: formData.email,
        role: formData.role,
        coach_id: formData.role === 'PARTNER' && formData.coach_id ? formData.coach_id : null,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      nome: staff.nome,
      email: staff.email,
      role: staff.role,
      coach_id: staff.coach_id || '',
    });
    setIsDialogOpen(true);
  };

  const getRoleBadge = (role: StaffRole) => {
    switch (role) {
      case 'OWNER':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Owner</Badge>;
      case 'ADMIN':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Admin</Badge>;
      case 'STAFF':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Staff</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">Equipe</h1>
              <p className="text-muted-foreground text-sm">Gestão de utilizadores do sistema</p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingStaff ? 'Editar Staff' : 'Novo Staff'}</DialogTitle>
                  <DialogDescription>
                    {editingStaff 
                      ? 'Atualize os dados do membro da equipe'
                      : 'Adicione um novo membro à equipe'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      O utilizador deve registar-se com este email para aceder ao sistema
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(v) => setFormData({ ...formData, role: v as StaffRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff - Operações básicas</SelectItem>
                        <SelectItem value="ADMIN">Admin - Gestão completa</SelectItem>
                        <SelectItem value="OWNER">Owner - Acesso total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingStaff ? 'Guardar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm">Membros da Equipe</CardTitle>
            <CardDescription>
              {staffList?.length || 0} utilizadores registados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : staffList?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum staff registado
              </div>
            ) : (
              <div className="space-y-3">
                {staffList?.map((member) => (
                  <div
                    key={member.id}
                    className={`border border-border rounded-lg p-4 transition-colors ${
                      !member.ativo ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="font-medium">
                            {member.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.nome}</p>
                            {getRoleBadge(member.role)}
                            {member.user_id && (
                              <Badge variant="outline" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Verificado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.email}
                            </span>
                            {member.role === 'PARTNER' && member.external_coaches && (
                              <span className="flex items-center gap-1">
                                <UserCog className="h-3 w-3" />
                                Coach: {member.external_coaches.nome}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`ativo-${member.id}`} className="text-xs text-muted-foreground">
                            Ativo
                          </Label>
                          <Switch
                            id={`ativo-${member.id}`}
                            checked={member.ativo}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: member.id, ativo: checked })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(member)}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Info */}
        <Card>
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm">Níveis de Acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getRoleBadge('OWNER')}
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso total: finanças, staff, auditoria, configurações
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getRoleBadge('ADMIN')}
                </div>
                <p className="text-sm text-muted-foreground">
                  Gestão: membros, planos, coaches, rentals, cobranças
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getRoleBadge('STAFF')}
                </div>
                <p className="text-sm text-muted-foreground">
                  Operações: check-in, vendas, pagamentos, caixa
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getRoleBadge('PARTNER')}
                </div>
                <p className="text-sm text-muted-foreground">
                  Visualização: próprios rentals e créditos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
