import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { z } from 'zod';

const planSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(100),
  tipo: z.enum(['SUBSCRIPTION', 'CREDITS', 'DAILY_PASS']),
  preco_cents: z.number().min(1, 'Preço deve ser maior que 0'),
  enrollment_fee_cents: z.number().min(0, 'Taxa não pode ser negativa'),
  duracao_dias: z.number().min(1).nullable(),
  creditos: z.number().min(1).nullable(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  preco_cents: number;
  enrollment_fee_cents: number;
  duracao_dias: number | null;
  creditos: number | null;
  ativo: boolean;
  created_at: string;
}

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

const Plans = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Partial<PlanFormData>>({
    nome: '',
    tipo: 'SUBSCRIPTION',
    preco_cents: 0,
    enrollment_fee_cents: 0,
    duracao_dias: 30,
    creditos: null,
  });
  const [precoInput, setPrecoInput] = useState('');
  const [enrollmentFeeInput, setEnrollmentFeeInput] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Plan[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const { error } = await supabase.from('plans').insert({
        nome: data.nome,
        tipo: data.tipo,
        preco_cents: data.preco_cents,
        enrollment_fee_cents: data.enrollment_fee_cents,
        duracao_dias: data.duracao_dias,
        creditos: data.creditos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({ title: 'Plano criado com sucesso' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Erro ao criar plano', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlanFormData> }) => {
      const { error } = await supabase
        .from('plans')
        .update({
          nome: data.nome,
          tipo: data.tipo,
          preco_cents: data.preco_cents,
          enrollment_fee_cents: data.enrollment_fee_cents,
          duracao_dias: data.duracao_dias,
          creditos: data.creditos,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({ title: 'Plano atualizado com sucesso' });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar plano', variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('plans')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({ title: 'Status atualizado' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlan(null);
    setFormData({
      nome: '',
      tipo: 'SUBSCRIPTION',
      preco_cents: 0,
      enrollment_fee_cents: 0,
      duracao_dias: 30,
      creditos: null,
    });
    setPrecoInput('');
    setEnrollmentFeeInput('');
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome,
      tipo: plan.tipo,
      preco_cents: plan.preco_cents,
      enrollment_fee_cents: plan.enrollment_fee_cents,
      duracao_dias: plan.duracao_dias,
      creditos: plan.creditos,
    });
    setPrecoInput((plan.preco_cents / 100).toFixed(2));
    setEnrollmentFeeInput((plan.enrollment_fee_cents / 100).toFixed(2));
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const preco_cents = Math.round(parseFloat(precoInput) * 100);
    const enrollment_fee_cents = Math.round(parseFloat(enrollmentFeeInput || '0') * 100);
    const dataToValidate = {
      ...formData,
      preco_cents,
      enrollment_fee_cents,
      duracao_dias: formData.tipo === 'DAILY_PASS' ? 1 : formData.duracao_dias,
      creditos: formData.tipo === 'CREDITS' ? formData.creditos : null,
    };

    const validation = planSchema.safeParse(dataToValidate);
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: validation.data });
    } else {
      createMutation.mutate(validation.data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">PLANOS</h1>
            <p className="text-muted-foreground text-sm">
              Gerenciar planos de acesso
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 uppercase tracking-wider text-xs">
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider">
                  {editingPlan ? 'Editar Plano' : 'Novo Plano'}
                </DialogTitle>
                <DialogDescription>
                  {editingPlan ? 'Atualize os dados do plano' : 'Preencha os dados do novo plano'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-secondary border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS') =>
                      setFormData({ ...formData, tipo: value })
                    }
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUBSCRIPTION">Mensalidade</SelectItem>
                      <SelectItem value="CREDITS">Créditos</SelectItem>
                      <SelectItem value="DAILY_PASS">Diária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preco">Preço (€)</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={precoInput}
                    onChange={(e) => setPrecoInput(e.target.value)}
                    className="bg-secondary border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enrollment_fee">Taxa de Matrícula (€)</Label>
                  <Input
                    id="enrollment_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={enrollmentFeeInput}
                    onChange={(e) => setEnrollmentFeeInput(e.target.value)}
                    className="bg-secondary border-border"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cobrada uma vez na primeira matrícula
                  </p>
                </div>

                {formData.tipo !== 'DAILY_PASS' && (
                  <div className="space-y-2">
                    <Label htmlFor="duracao">Duração (dias)</Label>
                    <Input
                      id="duracao"
                      type="number"
                      min="1"
                      value={formData.duracao_dias || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, duracao_dias: parseInt(e.target.value) || null })
                      }
                      className="bg-secondary border-border"
                      required
                    />
                  </div>
                )}

                {formData.tipo === 'CREDITS' && (
                  <div className="space-y-2">
                    <Label htmlFor="creditos">Número de Créditos</Label>
                    <Input
                      id="creditos"
                      type="number"
                      min="1"
                      value={formData.creditos || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, creditos: parseInt(e.target.value) || null })
                      }
                      className="bg-secondary border-border"
                      required
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-accent hover:bg-accent/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingPlan ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Plans Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans?.map((plan) => (
              <Card key={plan.id} className={`bg-card border-border ${!plan.ativo && 'opacity-60'}`}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{plan.nome}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs uppercase">
                      {getTipoLabel(plan.tipo)}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(plan)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-bold">
                    {formatCurrency(plan.preco_cents)}
                  </div>

                  {plan.enrollment_fee_cents > 0 && (
                    <div className="text-sm text-muted-foreground">
                      + {formatCurrency(plan.enrollment_fee_cents)} matrícula
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground space-y-1">
                    {plan.duracao_dias && (
                      <p>{plan.duracao_dias} dias de acesso</p>
                    )}
                    {plan.creditos && (
                      <p>{plan.creditos} créditos</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Label htmlFor={`ativo-${plan.id}`} className="text-sm">
                      Ativo
                    </Label>
                    <Switch
                      id={`ativo-${plan.id}`}
                      checked={plan.ativo}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: plan.id, ativo: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Plans;
