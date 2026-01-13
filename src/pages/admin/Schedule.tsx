import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Calendar, Clock, User, MapPin, Loader2, Trash2 } from 'lucide-react';

interface Class {
  id: string;
  nome: string;
  modalidade: string;
  dia_semana: number;
  hora_inicio: string;
  duracao_min: number;
  coach_id: string | null;
  area_id: string | null;
  capacidade: number | null;
  ativo: boolean;
  created_at: string;
  external_coaches?: { nome: string } | null;
  areas?: { nome: string } | null;
}

interface Coach {
  id: string;
  nome: string;
}

interface Area {
  id: string;
  nome: string;
}

const DIAS_SEMANA = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terca' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sabado' },
  { value: 0, label: 'Domingo' },
];

const MODALIDADES = [
  'Boxe',
  'Muay Thai',
  'Jiu-Jitsu',
  'MMA',
  'Kickboxing',
  'Wrestling',
  'Funcional',
  'Cardio Boxing',
];

const HORARIOS = Array.from({ length: 15 }, (_, i) => {
  const hour = 6 + i;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const getModalidadeColor = (modalidade: string) => {
  switch (modalidade.toLowerCase()) {
    case 'boxe':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'muay thai':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'jiu-jitsu':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'mma':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'kickboxing':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'wrestling':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'funcional':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'cardio boxing':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const Schedule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [filterModalidade, setFilterModalidade] = useState<string>('all');
  const [formData, setFormData] = useState({
    nome: '',
    modalidade: '',
    dia_semana: 1,
    hora_inicio: '09:00',
    duracao_min: 60,
    coach_id: '',
    area_id: '',
    capacidade: '',
  });

  // Fetch classes
  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, external_coaches(nome), areas(nome)')
        .order('dia_semana')
        .order('hora_inicio');

      if (error) throw error;
      return data as Class[];
    },
  });

  // Fetch coaches for dropdown
  const { data: coaches } = useQuery({
    queryKey: ['coaches-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_coaches')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Coach[];
    },
  });

  // Fetch areas for dropdown
  const { data: areas } = useQuery({
    queryKey: ['areas-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Area[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        nome: data.nome,
        modalidade: data.modalidade,
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio,
        duracao_min: data.duracao_min,
        coach_id: data.coach_id || null,
        area_id: data.area_id || null,
        capacidade: data.capacidade ? parseInt(data.capacidade) : null,
      };

      if (data.id) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: editingClass ? 'Aula atualizada' : 'Aula criada' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Erro ao salvar aula', variant: 'destructive' });
    },
  });

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('classes')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Status atualizado' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Aula removida' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover aula', variant: 'destructive' });
    },
  });

  const openCreateDialog = () => {
    setEditingClass(null);
    setFormData({
      nome: '',
      modalidade: '',
      dia_semana: 1,
      hora_inicio: '09:00',
      duracao_min: 60,
      coach_id: '',
      area_id: '',
      capacidade: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (classItem: Class) => {
    setEditingClass(classItem);
    setFormData({
      nome: classItem.nome,
      modalidade: classItem.modalidade,
      dia_semana: classItem.dia_semana,
      hora_inicio: classItem.hora_inicio.slice(0, 5),
      duracao_min: classItem.duracao_min,
      coach_id: classItem.coach_id || '',
      area_id: classItem.area_id || '',
      capacidade: classItem.capacidade?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingClass(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.modalidade) {
      toast({ title: 'Preencha nome e modalidade', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ ...formData, id: editingClass?.id });
  };

  // Filter classes by modalidade
  const filteredClasses = classes?.filter((c) => {
    if (filterModalidade === 'all') return true;
    return c.modalidade.toLowerCase() === filterModalidade.toLowerCase();
  });

  // Group classes by day
  const classesByDay = DIAS_SEMANA.map((dia) => ({
    ...dia,
    classes: filteredClasses?.filter((c) => c.dia_semana === dia.value && c.ativo) || [],
  }));

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">GRADE DE HORARIOS</h1>
            <p className="text-muted-foreground text-sm">
              Gerenciar aulas semanais recorrentes
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filterModalidade} onValueChange={setFilterModalidade}>
              <SelectTrigger className="w-[180px] bg-secondary border-border">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {MODALIDADES.map((mod) => (
                  <SelectItem key={mod} value={mod.toLowerCase()}>
                    {mod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" />
              Nova Aula
            </Button>
          </div>
        </div>

        {/* Weekly Schedule Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {classesByDay.map((dia) => (
              <Card key={dia.value} className="bg-card border-border">
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-sm uppercase tracking-wider">{dia.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {dia.classes.length} aula{dia.classes.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <CardContent className="p-2 space-y-2 min-h-[200px]">
                  {dia.classes.length > 0 ? (
                    dia.classes
                      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                      .map((classItem) => (
                        <div
                          key={classItem.id}
                          className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-accent/50 transition-colors cursor-pointer group"
                          onClick={() => openEditDialog(classItem)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm font-medium">
                                  {classItem.hora_inicio.slice(0, 5)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({classItem.duracao_min}min)
                                </span>
                              </div>
                              <p className="font-medium truncate">{classItem.nome}</p>
                              <Badge
                                variant="outline"
                                className={`mt-1 text-xs ${getModalidadeColor(classItem.modalidade)}`}
                              >
                                {classItem.modalidade}
                              </Badge>
                              {classItem.external_coaches?.nome && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{classItem.external_coaches.nome}</span>
                                </div>
                              )}
                              {classItem.areas?.nome && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{classItem.areas.nome}</span>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(classItem);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Sem aulas
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* All Classes List (including inactive) */}
        {classes && classes.some((c) => !c.ativo) && (
          <Card className="bg-card border-border">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm uppercase tracking-wider">Aulas Inativas</h3>
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                {classes
                  .filter((c) => !c.ativo)
                  .map((classItem) => (
                    <div
                      key={classItem.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm">
                          {DIAS_SEMANA.find((d) => d.value === classItem.dia_semana)?.label}
                        </span>
                        <span className="text-sm">{classItem.hora_inicio.slice(0, 5)}</span>
                        <span className="font-medium">{classItem.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {classItem.modalidade}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={classItem.ativo}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: classItem.id, ativo: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(classItem)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">
                {editingClass ? 'Editar Aula' : 'Nova Aula'}
              </DialogTitle>
              <DialogDescription>
                {editingClass
                  ? 'Atualize as informacoes da aula'
                  : 'Preencha os dados da nova aula recorrente'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Aula *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="Ex: Boxe Iniciantes"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modalidade">Modalidade *</Label>
                  <Select
                    value={formData.modalidade}
                    onValueChange={(value) => setFormData({ ...formData, modalidade: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map((mod) => (
                        <SelectItem key={mod} value={mod}>
                          {mod}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dia">Dia *</Label>
                  <Select
                    value={formData.dia_semana.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, dia_semana: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value.toString()}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora">Horario *</Label>
                  <Select
                    value={formData.hora_inicio}
                    onValueChange={(value) => setFormData({ ...formData, hora_inicio: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HORARIOS.map((hora) => (
                        <SelectItem key={hora} value={hora}>
                          {hora}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duracao">Duracao (min)</Label>
                  <Input
                    id="duracao"
                    type="number"
                    min={15}
                    step={15}
                    value={formData.duracao_min}
                    onChange={(e) =>
                      setFormData({ ...formData, duracao_min: parseInt(e.target.value) || 60 })
                    }
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coach">Coach</Label>
                  <Select
                    value={formData.coach_id}
                    onValueChange={(value) => setFormData({ ...formData, coach_id: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {coaches?.map((coach) => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area">Area</Label>
                  <Select
                    value={formData.area_id}
                    onValueChange={(value) => setFormData({ ...formData, area_id: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {areas?.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacidade">Capacidade Maxima</Label>
                <Input
                  id="capacidade"
                  type="number"
                  min={1}
                  value={formData.capacidade}
                  onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
                  className="bg-secondary border-border"
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>

              {editingClass && (
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <Label>Status</Label>
                    <p className="text-xs text-muted-foreground">
                      {editingClass.ativo ? 'Aula ativa' : 'Aula inativa'}
                    </p>
                  </div>
                  <Switch
                    checked={editingClass.ativo}
                    onCheckedChange={(checked) => {
                      toggleMutation.mutate({ id: editingClass.id, ativo: checked });
                      setEditingClass({ ...editingClass, ativo: checked });
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {editingClass && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      if (confirm('Remover esta aula permanentemente?')) {
                        deleteMutation.mutate(editingClass.id);
                        closeDialog();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingClass ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
