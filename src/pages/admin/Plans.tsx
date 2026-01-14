import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
import { usePricing } from '@/hooks/usePricing';
import { Plus, Pencil, Loader2, Eye, EyeOff, Dumbbell, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  preco_cents: number;
  enrollment_fee_cents: number;
  duracao_dias: number | null;
  creditos: number | null;
  modalities: string[] | null;
  commitment_months: number | null;
  visible: boolean | null;
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
    case 'CREDITS': return 'Creditos';
    case 'DAILY_PASS': return 'Diaria';
    default: return tipo;
  }
};

const Plans = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'SUBSCRIPTION' as 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS',
    creditos: null as number | null,
  });
  const [precoOverride, setPrecoOverride] = useState('');
  const [enrollmentFeeInput, setEnrollmentFeeInput] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pricing engine hook
  const pricing = usePricing({ memberStatus: 'LEAD' });

  // Reset pricing when dialog opens for new plan
  useEffect(() => {
    if (isDialogOpen && !editingPlan) {
      pricing.setSelectedModalities([]);
      pricing.setSelectedCommitmentMonths(1);
    }
  }, [isDialogOpen, editingPlan]);

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
    mutationFn: async (data: {
      nome: string;
      tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
      preco_cents: number;
      enrollment_fee_cents: number;
      duracao_dias: number | null;
      creditos: number | null;
      modalities: string[];
      commitment_months: number;
      visible: boolean;
    }) => {
      const { error } = await supabase.from('plans').insert(data);
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Plan> }) => {
      const { error } = await supabase
        .from('plans')
        .update(data)
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

  const toggleVisibleMutation = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const { error } = await supabase
        .from('plans')
        .update({ visible })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({ title: 'Visibilidade atualizada' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar visibilidade', variant: 'destructive' });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlan(null);
    setFormData({
      nome: '',
      tipo: 'SUBSCRIPTION',
      creditos: null,
    });
    setPrecoOverride('');
    setEnrollmentFeeInput('');
    setIsVisible(true);
    pricing.setSelectedModalities([]);
    pricing.setSelectedCommitmentMonths(1);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome,
      tipo: plan.tipo,
      creditos: plan.creditos,
    });
    setPrecoOverride((plan.preco_cents / 100).toFixed(2));
    setEnrollmentFeeInput((plan.enrollment_fee_cents / 100).toFixed(2));
    setIsVisible(plan.visible ?? true);

    // Set pricing engine state from plan
    if (plan.modalities && plan.modalities.length > 0) {
      pricing.setSelectedModalities(plan.modalities);
    } else {
      pricing.setSelectedModalities([]);
    }
    pricing.setSelectedCommitmentMonths(plan.commitment_months ?? 1);

    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({ title: 'Nome obrigatorio', variant: 'destructive' });
      return;
    }

    // For SUBSCRIPTION type, require at least one modality
    if (formData.tipo === 'SUBSCRIPTION' && pricing.selectedModalities.length === 0) {
      toast({ title: 'Selecione pelo menos uma modalidade', variant: 'destructive' });
      return;
    }

    // Calculate price: use override if provided, otherwise use calculated price
    let preco_cents: number;
    if (precoOverride && parseFloat(precoOverride) > 0) {
      preco_cents = Math.round(parseFloat(precoOverride) * 100);
    } else if (pricing.breakdown?.monthly_price_cents) {
      preco_cents = pricing.breakdown.monthly_price_cents;
    } else {
      toast({ title: 'Preco invalido', variant: 'destructive' });
      return;
    }

    const enrollment_fee_cents = Math.round(parseFloat(enrollmentFeeInput || '0') * 100);

    // Duration based on commitment months for SUBSCRIPTION, 1 for DAILY_PASS
    let duracao_dias: number | null = null;
    if (formData.tipo === 'SUBSCRIPTION') {
      duracao_dias = pricing.selectedCommitmentMonths * 30;
    } else if (formData.tipo === 'DAILY_PASS') {
      duracao_dias = 1;
    } else if (formData.tipo === 'CREDITS') {
      duracao_dias = 90; // Credits valid for 90 days
    }

    const planData = {
      nome: formData.nome,
      tipo: formData.tipo,
      preco_cents,
      enrollment_fee_cents,
      duracao_dias,
      creditos: formData.tipo === 'CREDITS' ? formData.creditos : null,
      modalities: pricing.selectedModalities,
      commitment_months: pricing.selectedCommitmentMonths,
      visible: isVisible,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: planData });
    } else {
      createMutation.mutate(planData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Get modality names for display in cards
  const getModalityNames = (modalityIds: string[] | null) => {
    if (!modalityIds || modalityIds.length === 0) return null;
    return pricing.modalities
      .filter(m => modalityIds.includes(m.id))
      .map(m => m.nome)
      .join(', ');
  };

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
            <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider">
                  {editingPlan ? 'Editar Plano' : 'Novo Plano'}
                </DialogTitle>
                <DialogDescription>
                  {editingPlan ? 'Atualize os dados do plano' : 'Configure o plano usando o pricing engine'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Plano</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="bg-secondary border-border"
                      placeholder="Ex: Boxe Trimestral"
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
                        <SelectItem value="CREDITS">Creditos</SelectItem>
                        <SelectItem value="DAILY_PASS">Diaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Modalities Selection - Only for SUBSCRIPTION */}
                {formData.tipo === 'SUBSCRIPTION' && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      Modalidades Incluidas
                    </Label>
                    {pricing.isLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {pricing.modalities.map((modality) => (
                          <div
                            key={modality.id}
                            onClick={() => pricing.toggleModality(modality.id)}
                            className={cn(
                              'p-3 border rounded-lg cursor-pointer transition-all flex items-center gap-2',
                              pricing.selectedModalities.includes(modality.id)
                                ? 'border-accent bg-accent/10'
                                : 'border-border hover:border-accent/50'
                            )}
                          >
                            <Checkbox
                              checked={pricing.selectedModalities.includes(modality.id)}
                              onCheckedChange={() => pricing.toggleModality(modality.id)}
                            />
                            <span className="text-sm font-medium">{modality.nome}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {pricing.selectedModalities.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {pricing.selectedModalities.length} modalidade(s) selecionada(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Commitment Period Selection - Only for SUBSCRIPTION */}
                {formData.tipo === 'SUBSCRIPTION' && (
                  <div className="space-y-3">
                    <Label>Periodo de Compromisso</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {pricing.commitmentPeriods.map((period) => (
                        <div
                          key={period.months}
                          onClick={() => pricing.setSelectedCommitmentMonths(period.months)}
                          className={cn(
                            'p-3 text-center border rounded-lg cursor-pointer transition-all',
                            pricing.selectedCommitmentMonths === period.months
                              ? 'border-accent bg-accent/10'
                              : 'border-border hover:border-accent/50'
                          )}
                        >
                          <p className="font-medium text-sm">{period.label}</p>
                          {period.discount > 0 && (
                            <Badge className="mt-1 bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                              -{period.discount}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Preview - Only for SUBSCRIPTION */}
                {formData.tipo === 'SUBSCRIPTION' && pricing.breakdown && pricing.selectedModalities.length > 0 && (
                  <div className="p-4 bg-secondary rounded-lg space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium">Preco Calculado</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Base ({pricing.selectedModalities.length} modalidade{pricing.selectedModalities.length > 1 ? 's' : ''})
                        </span>
                        <span>{pricing.formatPrice(pricing.breakdown.subtotal_cents)}</span>
                      </div>
                      {pricing.breakdown.commitment_discount_pct > 0 && (
                        <div className="flex justify-between text-green-500">
                          <span>Desconto Compromisso</span>
                          <span>-{pricing.breakdown.commitment_discount_pct}%</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between font-bold">
                        <span>Mensal</span>
                        <span className="text-accent">{pricing.formatPrice(pricing.breakdown.monthly_price_cents)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Override */}
                <div className="space-y-2">
                  <Label htmlFor="preco">
                    {formData.tipo === 'SUBSCRIPTION' ? 'Preco Override (opcional)' : 'Preco (€)'}
                  </Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={precoOverride}
                    onChange={(e) => setPrecoOverride(e.target.value)}
                    className="bg-secondary border-border"
                    placeholder={
                      pricing.breakdown?.monthly_price_cents
                        ? (pricing.breakdown.monthly_price_cents / 100).toFixed(2)
                        : '0.00'
                    }
                    required={formData.tipo !== 'SUBSCRIPTION'}
                  />
                  {formData.tipo === 'SUBSCRIPTION' && (
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para usar o preco calculado. Use para arredondar (ex: €80 em vez de €81).
                    </p>
                  )}
                </div>

                {/* Enrollment Fee */}
                <div className="space-y-2">
                  <Label htmlFor="enrollment_fee">Taxa de Matricula (€)</Label>
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
                    Cobrada uma vez na primeira matricula
                  </p>
                </div>

                {/* Credits - Only for CREDITS type */}
                {formData.tipo === 'CREDITS' && (
                  <div className="space-y-2">
                    <Label htmlFor="creditos">Numero de Creditos</Label>
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

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      Visivel no Seletor
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Se ativo, aparece nas opcoes de plano para staff
                    </p>
                  </div>
                  <Switch checked={isVisible} onCheckedChange={setIsVisible} />
                </div>

                {/* Submit Buttons */}
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
              <Card
                key={plan.id}
                className={cn(
                  'bg-card border-border',
                  !plan.ativo && 'opacity-60'
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{plan.nome}</CardTitle>
                      {plan.visible === false && (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs uppercase">
                        {getTipoLabel(plan.tipo)}
                      </Badge>
                      {plan.commitment_months && plan.commitment_months > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {plan.commitment_months} meses
                        </Badge>
                      )}
                    </div>
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
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </div>

                  {plan.enrollment_fee_cents > 0 && (
                    <div className="text-sm text-muted-foreground">
                      + {formatCurrency(plan.enrollment_fee_cents)} matricula
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground space-y-1">
                    {plan.modalities && plan.modalities.length > 0 && (
                      <p className="flex items-center gap-1">
                        <Dumbbell className="h-3 w-3" />
                        {getModalityNames(plan.modalities) || `${plan.modalities.length} modalidade(s)`}
                      </p>
                    )}
                    {plan.duracao_dias && (
                      <p>{plan.duracao_dias} dias de acesso</p>
                    )}
                    {plan.creditos && (
                      <p>{plan.creditos} creditos</p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`visible-${plan.id}`} className="text-sm flex items-center gap-1">
                        {plan.visible !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        Visivel
                      </Label>
                      <Switch
                        id={`visible-${plan.id}`}
                        checked={plan.visible !== false}
                        onCheckedChange={(checked) =>
                          toggleVisibleMutation.mutate({ id: plan.id, visible: checked })
                        }
                      />
                    </div>
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
