import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, MapPin, Users, Lock, Loader2 } from 'lucide-react';

interface Area {
  id: string;
  nome: string;
  capacidade_pts: number;
  is_exclusive: boolean;
  ativo: boolean;
  created_at: string;
}

const Areas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    capacidade_pts: 1,
    is_exclusive: false,
  });

  // Fetch areas
  const { data: areas, isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data as Area[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('areas')
          .update({
            nome: data.nome,
            capacidade_pts: data.capacidade_pts,
            is_exclusive: data.is_exclusive,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('areas')
          .insert({
            nome: data.nome,
            capacidade_pts: data.capacidade_pts,
            is_exclusive: data.is_exclusive,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast({ title: editingArea ? 'Área atualizada' : 'Área criada' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Erro ao salvar área', variant: 'destructive' });
    },
  });

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('areas')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast({ title: 'Status atualizado' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });

  const openCreateDialog = () => {
    setEditingArea(null);
    setFormData({ nome: '', capacidade_pts: 1, is_exclusive: false });
    setIsDialogOpen(true);
  };

  const openEditDialog = (area: Area) => {
    setEditingArea(area);
    setFormData({
      nome: area.nome,
      capacidade_pts: area.capacidade_pts,
      is_exclusive: area.is_exclusive,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingArea(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingArea?.id });
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">ÁREAS</h1>
            <p className="text-muted-foreground text-sm">
              Gerenciar espaços para sublocação
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Área
          </Button>
        </div>

        {/* Areas Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : areas && areas.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <Card
                key={area.id}
                className={`bg-card border-border ${!area.ativo ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-accent" />
                      <CardTitle className="text-lg">{area.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {area.is_exclusive && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Exclusiva
                        </Badge>
                      )}
                      <Badge variant={area.ativo ? 'default' : 'secondary'}>
                        {area.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">
                        Capacidade: {area.capacidade_pts} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={area.ativo}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: area.id, ativo: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(area)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma área cadastrada</p>
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                Criar primeira área
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">
                {editingArea ? 'Editar Área' : 'Nova Área'}
              </DialogTitle>
              <DialogDescription>
                {editingArea
                  ? 'Atualize as informações da área'
                  : 'Preencha os dados da nova área'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-secondary border-border"
                  placeholder="Ex: Ringue Principal"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacidade">Capacidade (pts simultâneos)</Label>
                <Input
                  id="capacidade"
                  type="number"
                  min={1}
                  value={formData.capacidade_pts}
                  onChange={(e) =>
                    setFormData({ ...formData, capacidade_pts: parseInt(e.target.value) || 1 })
                  }
                  className="bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Quantos coaches podem usar simultaneamente
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <Label htmlFor="exclusive">Área Exclusiva</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia check-in de membros durante rental
                  </p>
                </div>
                <Switch
                  id="exclusive"
                  checked={formData.is_exclusive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_exclusive: checked })
                  }
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingArea ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Areas;
