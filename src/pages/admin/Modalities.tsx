import { useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useAllModalities,
  useCreateModality,
  useUpdateModality,
  useDeleteModality,
} from '@/hooks/useModalities';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Loader2, GripVertical } from 'lucide-react';
import type { Modality } from '@/types/pricing';

const Modalities = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModality, setEditingModality] = useState<Modality | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nome: '',
    description: '',
    sort_order: 0,
    ativo: true,
  });

  const { toast } = useToast();
  const { modalities, isLoading } = useAllModalities();
  const createMutation = useCreateModality();
  const updateMutation = useUpdateModality();
  const deleteMutation = useDeleteModality();

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingModality(null);
    setFormData({
      code: '',
      nome: '',
      description: '',
      sort_order: modalities.length + 1,
      ativo: true,
    });
  };

  const handleEdit = (modality: Modality) => {
    setEditingModality(modality);
    setFormData({
      code: modality.code,
      nome: modality.nome,
      description: modality.description || '',
      sort_order: modality.sort_order,
      ativo: modality.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim() || !formData.nome.trim()) {
      toast({
        title: 'Erro de validacao',
        description: 'Codigo e nome sao obrigatorios',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingModality) {
        await updateMutation.mutateAsync({
          id: editingModality.id,
          updates: {
            code: formData.code.toLowerCase().replace(/\s+/g, '_'),
            nome: formData.nome,
            description: formData.description || null,
            sort_order: formData.sort_order,
            ativo: formData.ativo,
          },
        });
        toast({ title: 'Modalidade atualizada com sucesso' });
      } else {
        await createMutation.mutateAsync({
          code: formData.code.toLowerCase().replace(/\s+/g, '_'),
          nome: formData.nome,
          description: formData.description || null,
          sort_order: formData.sort_order || modalities.length + 1,
          ativo: true,
        });
        toast({ title: 'Modalidade criada com sucesso' });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Modality save error:', error);
      toast({
        title: editingModality ? 'Erro ao atualizar' : 'Erro ao criar',
        description: 'Verifique se o codigo ja existe',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (modality: Modality) => {
    try {
      await updateMutation.mutateAsync({
        id: modality.id,
        updates: { ativo: !modality.ativo },
      });
      toast({ title: 'Status atualizado' });
    } catch (error) {
      console.error('Modality toggle error:', error);
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">MODALIDADES</h1>
            <p className="text-muted-foreground text-sm">
              Artes marciais disponiveis para subscricao
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 uppercase tracking-wider text-xs">
                <Plus className="h-4 w-4 mr-2" />
                Nova Modalidade
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider">
                  {editingModality ? 'Editar Modalidade' : 'Nova Modalidade'}
                </DialogTitle>
                <DialogDescription>
                  {editingModality
                    ? 'Atualize os dados da modalidade'
                    : 'Adicione uma nova arte marcial'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Codigo</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="ex: muay_thai"
                    disabled={!!editingModality}
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador unico (sem espacos, minusculas)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="ex: Muay Thai"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descricao (opcional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Breve descricao da modalidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sort_order">Ordem</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sort_order: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCloseDialog}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-accent hover:bg-accent/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingModality ? 'Guardar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* List */}
        {!isLoading && (
          <div className="grid gap-3">
            {modalities.map((modality) => (
              <Card
                key={modality.id}
                className={`bg-card border-border ${
                  !modality.ativo ? 'opacity-50' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{modality.nome}</span>
                        <Badge variant="secondary" className="text-xs">
                          {modality.code}
                        </Badge>
                        {!modality.ativo && (
                          <Badge variant="destructive" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      {modality.description && (
                        <p className="text-sm text-muted-foreground">
                          {modality.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={modality.ativo}
                      onCheckedChange={() => handleToggleActive(modality)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(modality)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && modalities.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Nenhuma modalidade cadastrada
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Modalities;
