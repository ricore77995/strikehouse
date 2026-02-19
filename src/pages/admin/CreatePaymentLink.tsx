import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CreditCard,
  ArrowLeft,
  Plus,
  X,
  Check,
} from 'lucide-react';

interface StripePrice {
  id: string;
  nickname: string | null;
  unit_amount: number;
  currency: string;
  recurring: {
    interval: string;
    interval_count: number;
  } | null;
  product: {
    id: string;
    name: string;
    description: string | null;
  };
  display_name: string;
}

const CreatePaymentLink = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [frequencia, setFrequencia] = useState<string>('');
  const [compromisso, setCompromisso] = useState<string>('mensal');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [collectPhone, setCollectPhone] = useState(false);
  const [allowPromoCodes, setAllowPromoCodes] = useState(true);

  // Suggested tags for quick selection
  const suggestedTags = ['matricula', 'family_friends', 'promocao', 'staff', 'trial'];

  // Derive weekly limit from frequencia
  const getWeeklyLimit = (freq: string): number | undefined => {
    if (freq === '1x') return 1;
    if (freq === '2x') return 2;
    if (freq === '3x') return 3;
    return undefined; // unlimited
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, '_');
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // Fetch prices from Stripe
  const { data: pricesData, isLoading: loadingPrices } = useQuery({
    queryKey: ['stripe-prices'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-stripe-prices');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to load prices');
      return data.prices as StripePrice[];
    },
  });

  // Create payment link mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (selectedPrices.length === 0) {
        throw new Error('Seleccione pelo menos um produto');
      }
      if (!frequencia) {
        throw new Error('Seleccione a frequência');
      }

      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          priceIds: selectedPrices,
          metadata: {
            display_name: displayName || undefined,
            frequencia,
            compromisso,
            tags,
            weekly_limit: getWeeklyLimit(frequencia),
          },
          collectPhone,
          allowPromotionCodes: allowPromoCodes,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create payment link');
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Payment Link criado!',
        description: `Link criado: ${data.paymentLink.display_name}`,
      });
      navigate('/admin/stripe-links');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar link',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const totalAmount = selectedPrices.reduce((sum, priceId) => {
    const price = pricesData?.find((p) => p.id === priceId);
    return sum + (price?.unit_amount || 0);
  }, 0);

  const addPrice = (priceId: string) => {
    if (!selectedPrices.includes(priceId)) {
      setSelectedPrices([...selectedPrices, priceId]);
    }
  };

  const removePrice = (priceId: string) => {
    setSelectedPrices(selectedPrices.filter((id) => id !== priceId));
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/stripe-links')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Criar Payment Link
            </h1>
            <p className="text-muted-foreground text-sm">
              Criar novo link de pagamento no Stripe
            </p>
          </div>
        </div>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produtos</CardTitle>
            <CardDescription>
              Seleccione os produtos/preços para este link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected prices */}
            {selectedPrices.length > 0 && (
              <div className="space-y-2">
                {selectedPrices.map((priceId) => {
                  const price = pricesData?.find((p) => p.id === priceId);
                  if (!price) return null;
                  return (
                    <div
                      key={priceId}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{price.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(price.unit_amount)}
                          {price.recurring && ` / ${price.recurring.interval}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePrice(priceId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}

            {/* Price selector */}
            <div className="space-y-2">
              <Label>Adicionar produto</Label>
              {loadingPrices ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando preços...
                </div>
              ) : (
                <Select onValueChange={addPrice} value="">
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pricesData?.map((price) => (
                      <SelectItem
                        key={price.id}
                        value={price.id}
                        disabled={selectedPrices.includes(price.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{price.display_name}</span>
                          {selectedPrices.includes(price.id) && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadados</CardTitle>
            <CardDescription>
              Configurações para categorização e regras de negócio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Frequência */}
            <div className="space-y-2">
              <Label>Frequência semanal *</Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar frequência..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x">1x por semana</SelectItem>
                  <SelectItem value="2x">2x por semana</SelectItem>
                  <SelectItem value="3x">3x por semana</SelectItem>
                  <SelectItem value="unlimited">Ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Compromisso */}
            <div className="space-y-2">
              <Label>Compromisso *</Label>
              <Select value={compromisso} onValueChange={setCompromisso}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags / Categorias</Label>

              {/* Selected tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeTag(tag)}
                    >
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Tag input */}
              <Input
                placeholder="Adicionar tag (Enter para confirmar)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput && addTag(tagInput)}
              />

              {/* Suggested tags */}
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Sugestões:</span>
                {suggestedTags
                  .filter((t) => !tags.includes(t))
                  .map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent text-xs"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Ex: "matricula" para novos membros, "family_friends" para descontos especiais
              </p>
            </div>

            {/* Display Name (optional) */}
            <div className="space-y-2">
              <Label>Nome de exibição (opcional)</Label>
              <Input
                placeholder="Ex: 2x/semana + Matrícula €55"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para gerar automaticamente
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Opções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Recolher telefone</Label>
                <p className="text-xs text-muted-foreground">
                  Pedir número de telefone no checkout
                </p>
              </div>
              <Switch checked={collectPhone} onCheckedChange={setCollectPhone} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir códigos promocionais</Label>
                <p className="text-xs text-muted-foreground">
                  Clientes podem usar cupões de desconto
                </p>
              </div>
              <Switch checked={allowPromoCodes} onCheckedChange={setAllowPromoCodes} />
            </div>
          </CardContent>
        </Card>

        {/* Summary & Submit */}
        <Card className="border-accent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Total do link</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {frequencia && (
                  <Badge>{frequencia === 'unlimited' ? 'Ilimitado' : `${frequencia}/sem`}</Badge>
                )}
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/admin/stripe-links')}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || selectedPrices.length === 0 || !frequencia}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Criar Payment Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CreatePaymentLink;
