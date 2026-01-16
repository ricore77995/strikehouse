import { useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  useAllDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useDeleteDiscount,
} from '@/hooks/useDiscounts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Loader2, Percent, Tag } from 'lucide-react';
import type { Discount, DiscountCategoryType, DiscountTypeType } from '@/types/pricing';

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-PT');
};

const Discounts = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [activeTab, setActiveTab] = useState<'commitment' | 'promo'>('promo');
  const [formData, setFormData] = useState<{
    code: string;
    nome: string;
    category: DiscountCategoryType;
    discount_type: DiscountTypeType;
    discount_value: number;
    min_commitment_months: number | null;
    valid_from: string;
    valid_until: string;
    max_uses: number | null;
    new_members_only: boolean;
  }>({
    code: '',
    nome: '',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 0,
    min_commitment_months: null,
    valid_from: '',
    valid_until: '',
    max_uses: null,
    new_members_only: false,
  });

  const { toast } = useToast();
  const { staffId } = useAuth();
  const { discounts, isLoading } = useAllDiscounts();
  const createMutation = useCreateDiscount();
  const updateMutation = useUpdateDiscount();
  const deleteMutation = useDeleteDiscount();

  const commitmentDiscounts = discounts.filter((d) => d.category === 'commitment');
  const promoDiscounts = discounts.filter((d) => d.category === 'promo');

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDiscount(null);
    setFormData({
      code: '',
      nome: '',
      category: 'promo',
      discount_type: 'percentage',
      discount_value: 0,
      min_commitment_months: null,
      valid_from: '',
      valid_until: '',
      max_uses: null,
      new_members_only: false,
    });
  };

  const handleEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setFormData({
      code: discount.code,
      nome: discount.nome,
      category: discount.category,
      discount_type: discount.discount_type,
      // Convert cents to euros for fixed type display
      discount_value: discount.discount_type === 'fixed'
        ? discount.discount_value / 100
        : discount.discount_value,
      min_commitment_months: discount.min_commitment_months,
      valid_from: discount.valid_from || '',
      valid_until: discount.valid_until || '',
      max_uses: discount.max_uses,
      new_members_only: discount.new_members_only,
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
      // Convert euros to cents for fixed type storage
      const valueToSave = formData.discount_type === 'fixed'
        ? Math.round(formData.discount_value * 100)
        : formData.discount_value;

      if (editingDiscount) {
        await updateMutation.mutateAsync({
          id: editingDiscount.id,
          updates: {
            code: formData.code.toUpperCase(),
            nome: formData.nome,
            discount_type: formData.discount_type,
            discount_value: valueToSave,
            min_commitment_months: formData.min_commitment_months,
            valid_from: formData.valid_from || null,
            valid_until: formData.valid_until || null,
            max_uses: formData.max_uses,
            new_members_only: formData.new_members_only,
          },
        });
        toast({ title: 'Desconto atualizado com sucesso' });
      } else {
        await createMutation.mutateAsync({
          code: formData.code.toUpperCase(),
          nome: formData.nome,
          category: formData.category,
          discount_type: formData.discount_type,
          discount_value: valueToSave,
          min_commitment_months: formData.min_commitment_months,
          valid_from: formData.valid_from || null,
          valid_until: formData.valid_until || null,
          max_uses: formData.max_uses,
          new_members_only: formData.new_members_only,
          referrer_credit_cents: null,
          ativo: true,
          created_by: staffId,
        });
        toast({ title: 'Desconto criado com sucesso' });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Discount save error:', error);
      toast({
        title: editingDiscount ? 'Erro ao atualizar' : 'Erro ao criar',
        description: 'Verifique se o codigo ja existe',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (discount: Discount) => {
    try {
      await updateMutation.mutateAsync({
        id: discount.id,
        updates: { ativo: !discount.ativo },
      });
      toast({ title: 'Status atualizado' });
    } catch (error) {
      console.error('Discount toggle error:', error);
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const DiscountCard = ({ discount }: { discount: Discount }) => (
    <Card
      className={`bg-card border-border ${!discount.ativo ? 'opacity-50' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="font-mono text-accent border-accent"
              >
                {discount.code}
              </Badge>
              <span className="font-medium">{discount.nome}</span>
              {!discount.ativo && (
                <Badge variant="destructive" className="text-xs">
                  Inativo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                {discount.discount_type === 'percentage'
                  ? `${discount.discount_value}%`
                  : `€${(discount.discount_value / 100).toFixed(2)}`}
              </span>
              {discount.category === 'commitment' &&
                discount.min_commitment_months && (
                  <span>Min: {discount.min_commitment_months} meses</span>
                )}
              {discount.category === 'promo' && (
                <>
                  {discount.valid_until && (
                    <span>Ate: {formatDate(discount.valid_until)}</span>
                  )}
                  {discount.max_uses && (
                    <span>
                      Usos: {discount.current_uses}/{discount.max_uses}
                    </span>
                  )}
                  {discount.new_members_only && (
                    <Badge variant="secondary" className="text-xs">
                      Novos membros
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={discount.ativo}
              onCheckedChange={() => handleToggleActive(discount)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(discount)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">DESCONTOS</h1>
            <p className="text-muted-foreground text-sm">
              Descontos por compromisso e codigos promocionais
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 uppercase tracking-wider text-xs">
                <Plus className="h-4 w-4 mr-2" />
                Novo Codigo Promo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider">
                  {editingDiscount ? 'Editar Desconto' : 'Novo Codigo Promocional'}
                </DialogTitle>
                <DialogDescription>
                  {editingDiscount
                    ? 'Atualize os dados do desconto'
                    : 'Crie um novo codigo promocional'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Codigo</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="ex: UNI15"
                      disabled={!!editingDiscount}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="ex: Desconto Universitario"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount_type">Tipo</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          discount_type: val as DiscountTypeType,
                          discount_value: 0, // Reset value when changing type
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentagem</SelectItem>
                        <SelectItem value="fixed">Valor Fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_value">
                      {formData.discount_type === 'percentage' ? 'Percentagem (%)' : 'Valor (€)'}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min="0"
                      step={formData.discount_type === 'fixed' ? '0.01' : '1'}
                      max={formData.discount_type === 'percentage' ? 100 : undefined}
                      value={formData.discount_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount_value: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder={formData.discount_type === 'fixed' ? 'ex: 10.00' : 'ex: 15'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valid_from">Valido De</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) =>
                        setFormData({ ...formData, valid_from: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Valido Ate</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) =>
                        setFormData({ ...formData, valid_until: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_uses">Maximo de Usos (opcional)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="0"
                    value={formData.max_uses || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_uses: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="Sem limite"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="new_members_only"
                    checked={formData.new_members_only}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, new_members_only: checked })
                    }
                  />
                  <Label htmlFor="new_members_only">
                    Apenas para novos membros (LEAD)
                  </Label>
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
                    {editingDiscount ? 'Guardar' : 'Criar'}
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

        {/* Tabs */}
        {!isLoading && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'commitment' | 'promo')}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="promo" className="uppercase text-xs tracking-wider">
                <Tag className="h-3 w-3 mr-2" />
                Promocionais ({promoDiscounts.length})
              </TabsTrigger>
              <TabsTrigger value="commitment" className="uppercase text-xs tracking-wider">
                <Percent className="h-3 w-3 mr-2" />
                Compromisso ({commitmentDiscounts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="promo" className="mt-6 space-y-3">
              {promoDiscounts.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Nenhum codigo promocional cadastrado
                    </p>
                  </CardContent>
                </Card>
              ) : (
                promoDiscounts.map((discount) => (
                  <DiscountCard key={discount.id} discount={discount} />
                ))
              )}
            </TabsContent>

            <TabsContent value="commitment" className="mt-6 space-y-3">
              <Card className="bg-secondary/30 border-border mb-4">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Descontos por compromisso sao aplicados automaticamente com base no
                    periodo de compromisso selecionado pelo membro.
                  </p>
                </CardContent>
              </Card>
              {commitmentDiscounts.map((discount) => (
                <DiscountCard key={discount.id} discount={discount} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Discounts;
