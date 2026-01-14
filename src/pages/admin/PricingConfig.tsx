import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePricingConfig, useUpdatePricingConfig } from '@/hooks/usePricingConfig';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/pricing-engine';
import { Loader2, Save, Euro } from 'lucide-react';

const PricingConfig = () => {
  const { config, isLoading } = usePricingConfig();
  const updateConfig = useUpdatePricingConfig();
  const { toast } = useToast();

  // Form state (in EUR, not cents)
  const [basePrice, setBasePrice] = useState('');
  const [extraModalityPrice, setExtraModalityPrice] = useState('');
  const [singleClassPrice, setSingleClassPrice] = useState('');
  const [dayPassPrice, setDayPassPrice] = useState('');
  const [enrollmentFee, setEnrollmentFee] = useState('');

  // Initialize form when config loads
  useEffect(() => {
    if (config.id) {
      setBasePrice((config.base_price_cents / 100).toFixed(2));
      setExtraModalityPrice((config.extra_modality_price_cents / 100).toFixed(2));
      setSingleClassPrice((config.single_class_price_cents / 100).toFixed(2));
      setDayPassPrice((config.day_pass_price_cents / 100).toFixed(2));
      setEnrollmentFee((config.enrollment_fee_cents / 100).toFixed(2));
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateConfig.mutateAsync({
        base_price_cents: Math.round(parseFloat(basePrice) * 100),
        extra_modality_price_cents: Math.round(parseFloat(extraModalityPrice) * 100),
        single_class_price_cents: Math.round(parseFloat(singleClassPrice) * 100),
        day_pass_price_cents: Math.round(parseFloat(dayPassPrice) * 100),
        enrollment_fee_cents: Math.round(parseFloat(enrollmentFee) * 100),
      });
      toast({ title: 'Configuracao atualizada com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar configuracao', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">CONFIGURACAO DE PRECOS</h1>
          <p className="text-muted-foreground text-sm">
            Parametros globais de precificacao
          </p>
        </div>

        {/* Formula Card */}
        <Card className="bg-card/50 border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-accent">
              Formula de Preco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm text-muted-foreground">
              P = (Base + (M-1) x Extra) x (1 - Desconto Compromisso) x (1 - Desconto Promo)
            </code>
          </CardContent>
        </Card>

        {/* Config Form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base">Precos Base</CardTitle>
            <CardDescription>
              Valores usados no calculo quando o plano nao especifica override
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Base Price */}
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Preco Base (1a Modalidade)</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preco para a primeira modalidade escolhida
                  </p>
                </div>

                {/* Extra Modality Price */}
                <div className="space-y-2">
                  <Label htmlFor="extraModalityPrice">Preco Modalidade Extra</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="extraModalityPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={extraModalityPrice}
                      onChange={(e) => setExtraModalityPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preco adicional por cada modalidade extra
                  </p>
                </div>

                {/* Single Class Price */}
                <div className="space-y-2">
                  <Label htmlFor="singleClassPrice">Preco Aula Avulsa</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="singleClassPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={singleClassPrice}
                      onChange={(e) => setSingleClassPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preco para uma aula avulsa (drop-in)
                  </p>
                </div>

                {/* Day Pass Price */}
                <div className="space-y-2">
                  <Label htmlFor="dayPassPrice">Preco Diaria</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dayPassPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayPassPrice}
                      onChange={(e) => setDayPassPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preco para acesso de um dia inteiro
                  </p>
                </div>

                {/* Enrollment Fee */}
                <div className="space-y-2">
                  <Label htmlFor="enrollmentFee">Taxa de Matricula</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="enrollmentFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={enrollmentFee}
                      onChange={(e) => setEnrollmentFee(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Taxa cobrada apenas na primeira matricula (LEAD → ATIVO)
                  </p>
                </div>
              </div>

              {/* Preview */}
              <Card className="bg-secondary/30 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    Exemplo: 2 Modalidades, 6 Meses
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Base (1a modalidade):</span>
                    <span>{formatCurrency(Math.round(parseFloat(basePrice || '0') * 100))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extra (2a modalidade):</span>
                    <span>+ {formatCurrency(Math.round(parseFloat(extraModalityPrice || '0') * 100))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>
                      {formatCurrency(
                        Math.round((parseFloat(basePrice || '0') + parseFloat(extraModalityPrice || '0')) * 100)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-accent">
                    <span>Desconto Semestral (-15%):</span>
                    <span>
                      - {formatCurrency(
                        Math.round((parseFloat(basePrice || '0') + parseFloat(extraModalityPrice || '0')) * 15)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                    <span>Mensal:</span>
                    <span>
                      {formatCurrency(
                        Math.round((parseFloat(basePrice || '0') + parseFloat(extraModalityPrice || '0')) * 85)
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-accent hover:bg-accent/90 uppercase tracking-wider text-xs"
                  disabled={updateConfig.isPending}
                >
                  {updateConfig.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar Alteracoes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PricingConfig;
