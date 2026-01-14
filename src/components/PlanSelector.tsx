import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/pricing-engine';
import type { Plan } from '@/types/pricing';
import { Package, Clock, CreditCard, Ticket } from 'lucide-react';

interface PlanSelectorProps {
  plans: Plan[];
  selectedPlan: Plan | null;
  onSelect: (plan: Plan) => void;
  isLoading?: boolean;
}

const getPlanTypeIcon = (tipo: Plan['tipo']) => {
  switch (tipo) {
    case 'SUBSCRIPTION':
      return <Clock className="h-4 w-4" />;
    case 'CREDITS':
      return <CreditCard className="h-4 w-4" />;
    case 'DAILY_PASS':
      return <Ticket className="h-4 w-4" />;
  }
};

const getPlanTypeLabel = (tipo: Plan['tipo']) => {
  switch (tipo) {
    case 'SUBSCRIPTION':
      return 'Mensalidade';
    case 'CREDITS':
      return 'Creditos';
    case 'DAILY_PASS':
      return 'Diaria';
  }
};

const PlanSelector = ({ plans, selectedPlan, onSelect, isLoading }: PlanSelectorProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse flex flex-col gap-3 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-secondary rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum plano disponivel</p>
        <p className="text-sm">Use a opcao "Customizado" para configurar manualmente</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {plans.map((plan) => (
        <div
          key={plan.id}
          onClick={() => onSelect(plan)}
          className={cn(
            'p-4 border rounded-lg cursor-pointer transition-all',
            selectedPlan?.id === plan.id
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-accent/50'
          )}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold">{plan.nome}</p>
                <Badge variant="outline" className="text-xs">
                  {getPlanTypeIcon(plan.tipo)}
                  <span className="ml-1">{getPlanTypeLabel(plan.tipo)}</span>
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {plan.modalities && plan.modalities.length > 0 && (
                  <p>{plan.modalities.length} modalidade(s)</p>
                )}
                {plan.commitment_months > 1 && (
                  <p>{plan.commitment_months} meses de compromisso</p>
                )}
                {plan.tipo === 'CREDITS' && plan.creditos && (
                  <p>{plan.creditos} creditos</p>
                )}
                {plan.tipo === 'SUBSCRIPTION' && plan.duracao_dias && (
                  <p>{plan.duracao_dias} dias de acesso</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-accent">
                {formatCurrency(plan.preco_cents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {plan.tipo === 'CREDITS' ? '/pacote' : '/mes'}
              </p>
              {plan.enrollment_fee_cents > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {formatCurrency(plan.enrollment_fee_cents)} matricula
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlanSelector;
