import { CheckCircle, XCircle, AlertTriangle, Clock, CreditCard, Lock, CalendarCheck, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      case 'WEEKLY_LIMIT_REACHED':
        return {
          icon: Calendar,
          bgClass: 'bg-orange-500/10 border-orange-500/30',
          iconClass: 'text-orange-500',
          title: 'LIMITE SEMANAL',
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

        {/* Booking Info - Show class details when member has a booking */}
        {result.success && result.bookingInfo?.had_booking && (
          <div className="mb-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CalendarCheck className="h-5 w-5 text-accent" />
              <span className="font-semibold text-accent uppercase tracking-wider text-sm">
                Reserva Confirmada
              </span>
            </div>
            <p className="text-lg font-medium">{result.bookingInfo.class_name}</p>
            <p className="text-sm text-muted-foreground">
              Horário: {result.bookingInfo.class_time}
            </p>
          </div>
        )}

        {/* No booking warning - When member entered without a booking */}
        {result.success && !result.bookingInfo?.had_booking && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-yellow-500">
                Entrada sem reserva prévia
              </span>
            </div>
          </div>
        )}

        {/* Weekly limit info */}
        {result.result === 'WEEKLY_LIMIT_REACHED' && result.weeklyLimitInfo && (
          <div className="mb-4 p-3 bg-orange-500/10 rounded-lg">
            <p className="text-sm font-medium">
              Limite: {result.weeklyLimitInfo.used}/{result.weeklyLimitInfo.limit} aulas
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Próximo reset: {result.weeklyLimitInfo.nextResetDate}
            </p>
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
