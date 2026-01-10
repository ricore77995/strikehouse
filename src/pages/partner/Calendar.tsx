import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Rental {
  id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guest_count: number | null;
  areas: { nome: string } | null;
}

const PartnerCalendar = () => {
  const { staff } = useAuth();
  const coachId = staff?.coach_id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: rentals, isLoading } = useQuery({
    queryKey: ['partner-calendar-rentals', coachId, format(monthStart, 'yyyy-MM'), format(monthEnd, 'yyyy-MM')],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          id,
          rental_date,
          start_time,
          end_time,
          status,
          guest_count,
          areas(nome)
        `)
        .eq('coach_id', coachId)
        .gte('rental_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('rental_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as Rental[];
    },
    enabled: !!coachId,
  });

  // Get rentals for a specific day
  const getRentalsForDay = (date: Date) => {
    if (!rentals) return [];
    return rentals.filter(r => isSameDay(new Date(r.rental_date), date));
  };

  // Get calendar days including padding for week alignment
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'CANCELLED':
        return 'bg-red-500/50';
      default:
        return 'bg-muted';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Agendado</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Concluído</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Cancelado</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const selectedDayRentals = selectedDate ? getRentalsForDay(selectedDate) : [];

  if (!coachId) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Sua conta de partner ainda não está vinculada a um coach.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">CALENDÁRIO</h1>
            <p className="text-muted-foreground text-sm">
              Visualize seus rentals no mês
            </p>
          </div>
        </div>

        {/* Calendar Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg uppercase tracking-wider">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayRentals = getRentalsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const hasRentals = dayRentals.length > 0;
                const scheduledCount = dayRentals.filter(r => r.status === 'SCHEDULED').length;
                const completedCount = dayRentals.filter(r => r.status === 'COMPLETED').length;
                const cancelledCount = dayRentals.filter(r => r.status === 'CANCELLED').length;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => hasRentals && setSelectedDate(day)}
                    disabled={!hasRentals}
                    className={cn(
                      'relative min-h-[80px] lg:min-h-[100px] p-1 lg:p-2 rounded-lg border transition-colors text-left',
                      isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                      isCurrentDay && 'ring-2 ring-accent',
                      hasRentals && 'cursor-pointer hover:bg-muted/50',
                      !hasRentals && 'cursor-default',
                      'border-border'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        !isCurrentMonth && 'text-muted-foreground/50',
                        isCurrentDay && 'text-accent'
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Rental indicators */}
                    {hasRentals && isCurrentMonth && (
                      <div className="mt-1 space-y-0.5">
                        {dayRentals.slice(0, 3).map((rental) => (
                          <div
                            key={rental.id}
                            className={cn(
                              'text-[10px] lg:text-xs px-1 py-0.5 rounded truncate text-white',
                              getStatusColor(rental.status || 'SCHEDULED')
                            )}
                          >
                            <span className="hidden lg:inline">
                              {rental.start_time.slice(0, 5)} - {rental.areas?.nome}
                            </span>
                            <span className="lg:hidden">
                              {rental.start_time.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                        {dayRentals.length > 3 && (
                          <div className="text-[10px] text-muted-foreground text-center">
                            +{dayRentals.length - 3} mais
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary dots for mobile when there are rentals */}
                    {hasRentals && isCurrentMonth && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 lg:hidden">
                        {scheduledCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {completedCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                        {cancelledCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded bg-blue-500" />
                Agendado
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded bg-green-500" />
                Concluído
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded bg-red-500/50" />
                Cancelado
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Details Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </DialogTitle>
              <DialogDescription>
                {selectedDayRentals.length} rental{selectedDayRentals.length !== 1 ? 's' : ''} neste dia
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3 pr-4">
                {selectedDayRentals.map((rental) => (
                  <div
                    key={rental.id}
                    className={cn(
                      'p-3 rounded-lg border border-border',
                      rental.status === 'CANCELLED' && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
                      </div>
                      {getStatusBadge(rental.status || 'SCHEDULED')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {rental.areas?.nome || 'Área não definida'}
                    </div>
                    {rental.guest_count && rental.guest_count > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Users className="h-4 w-4" />
                        {rental.guest_count} aluno{rental.guest_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PartnerCalendar;