import { CheckCircle, XCircle, AlertTriangle, Clock, CreditCard, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CheckinResult } from '@/hooks/useCheckin';

interface CheckinResultCardProps {
  result: CheckinResult;
  onDismiss: () => void;
}

const CheckinResultCard = ({ result, onDismiss }: CheckinResultCardProps) => {
  const getResultStyle = () => {
    switch (result.result) {
      case 'ALLOWED':
        return {
          icon: CheckCircle,
          bgClass: 'bg-green-500/10 border-green-500/30',
          iconClass: 'text-green-500',
          title: 'ACESSO LIBERADO',
        };
      case 'BLOCKED':
        return {
          icon: XCircle,
          bgClass: 'bg-destructive/10 border-destructive/30',
          iconClass: 'text-destructive',
          title: 'ACESSO BLOQUEADO',
        };
      case 'EXPIRED':
        return {
          icon: Clock,
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
          iconClass: 'text-yellow-500',
          title: 'ACESSO EXPIRADO',
        };
      case 'NO_CREDITS':
        return {
          icon: CreditCard,
          bgClass: 'bg-orange-500/10 border-orange-500/30',
          iconClass: 'text-orange-500',
          title: 'SEM CRÉDITOS',
        };
      case 'AREA_EXCLUSIVE':
        return {
          icon: Lock,
          bgClass: 'bg-purple-500/10 border-purple-500/30',
          iconClass: 'text-purple-500',
          title: 'ÁREA EXCLUSIVA',
        };
      default:
        return {
          icon: AlertTriangle,
          bgClass: 'bg-muted border-border',
          iconClass: 'text-muted-foreground',
          title: 'NÃO ENCONTRADO',
        };
    }
  };

  const style = getResultStyle();
  const Icon = style.icon;

  return (
    <Card className={cn('border-2 transition-all', style.bgClass)}>
      <CardContent className="p-6 text-center">
        <Icon className={cn('h-16 w-16 mx-auto mb-4', style.iconClass)} />
        
        <h3 className="text-xl uppercase tracking-wider mb-2">{style.title}</h3>
        
        {result.member && (
          <div className="mb-4">
            <p className="text-lg font-medium">{result.member.nome}</p>
            <p className="text-sm text-muted-foreground">{result.member.telefone}</p>
            {result.member.access_type === 'CREDITS' && result.success && (
              <p className="text-sm text-muted-foreground mt-1">
                Créditos restantes: {(result.member.credits_remaining || 1) - 1}
              </p>
            )}
            {result.member.access_expires_at && result.success && (
              <p className="text-sm text-muted-foreground mt-1">
                Válido até: {new Date(result.member.access_expires_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {result.result === 'AREA_EXCLUSIVE' && result.rentalInfo && (
          <div className="mb-4 p-3 bg-purple-500/10 rounded-lg">
            <p className="text-sm font-medium">{result.rentalInfo.areaName}</p>
            <p className="text-xs text-muted-foreground">
              Aula com {result.rentalInfo.coachName}
            </p>
            <p className="text-xs text-muted-foreground">
              Libera às {result.rentalInfo.endTime.slice(0, 5)}
            </p>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground mb-6">{result.message}</p>
        
        <Button
          onClick={onDismiss}
          className="uppercase tracking-wider text-xs"
          variant={result.success ? 'default' : 'outline'}
        >
          OK
        </Button>
      </CardContent>
    </Card>
  );
};

export default CheckinResultCard;
