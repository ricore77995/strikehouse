import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Plus, Trash2, Clock, MapPin, RepeatIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const RecurringRentals = () => {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const coachId = staff?.coach_id;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [weeksToGenerate, setWeeksToGenerate] = useState(4);

  const { data: coachInfo } = useQuery({
    queryKey: ['partner-coach-info', coachId],
    queryFn: async () => {
      if (!coachId) return null;
      const { data, error } = await supabase
        .from('external_coaches')
        .select('*')
        .eq('id', coachId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const { data: areas } = useQuery({
    queryKey: ['partner-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Fetch recurring rentals (rentals with series_id)
  const { data: recurringRentals, isLoading } = useQuery({
    queryKey: ['partner-recurring-rentals', coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          areas(nome)
        `)
        .eq('coach_id', coachId)
        .eq('is_recurring', true)
        .gte('rental_date', today)
        .neq('status', 'CANCELLED')
        .order('rental_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  // Group by series_id
  const groupedBySeries = recurringRentals?.reduce((acc, rental) => {
    const seriesId = rental.series_id || rental.id;
    if (!acc[seriesId]) {
      acc[seriesId] = [];
    }
    acc[seriesId].push(rental);
    return acc;
  }, {} as Record<string, typeof recurringRentals>);

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  const calculateFee = () => {
    if (!coachInfo) return 0;
    if (coachInfo.fee_type === 'FIXED') {
      return coachInfo.fee_value;
    }
    return 0;
  };

  // Create recurring rentals mutation
  const createRecurringMutation = useMutation({
    mutationFn: async () => {
      if (!coachId || selectedWeekday === null || !selectedAreaId || !startTime || !endTime) {
        throw new Error('Preencha todos os campos');
      }

      const seriesId = crypto.randomUUID();
      const fee = calculateFee();
      const rentalsToCreate = [];

      // Get the next occurrence of the selected weekday
      const today = new Date();
      const currentWeekday = today.getDay();
      let daysUntilNext = selectedWeekday - currentWeekday;
      if (daysUntilNext <= 0) daysUntilNext += 7;
      
      let nextDate = addDays(today, daysUntilNext);

      // Generate rentals for X weeks
      for (let i = 0; i < weeksToGenerate; i++) {
        const rentalDate = format(nextDate, 'yyyy-MM-dd');
        
        // Check for conflicts
        const { data: conflicts } = await supabase
          .from('rentals')
          .select('id')
          .eq('area_id', selectedAreaId)
          .eq('rental_date', rentalDate)
          .neq('status', 'CANCELLED')
          .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

        if (!conflicts || conflicts.length === 0) {
          rentalsToCreate.push({
            coach_id: coachId,
            area_id: selectedAreaId,
            rental_date: rentalDate,
            start_time: startTime,
            end_time: endTime,
            fee_charged_cents: fee,
            status: 'SCHEDULED',
            is_recurring: true,
            series_id: seriesId,
          });
        }

        nextDate = addWeeks(nextDate, 1);
      }

      if (rentalsToCreate.length === 0) {
        throw new Error('Todos os horários selecionados já estão ocupados');
      }

      const { error } = await supabase
        .from('rentals')
        .insert(rentalsToCreate);

      if (error) throw error;

      return rentalsToCreate.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} rentals recorrentes criados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['partner-recurring-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-upcoming-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-month-rentals'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar rentals recorrentes');
    },
  });

  // Cancel entire series mutation
  const cancelSeriesMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('series_id', seriesId)
        .eq('status', 'SCHEDULED');

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Série de rentals cancelada');
      queryClient.invalidateQueries({ queryKey: ['partner-recurring-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-upcoming-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-month-rentals'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cancelar série');
    },
  });

  const resetForm = () => {
    setSelectedWeekday(null);
    setSelectedAreaId('');
    setStartTime('');
    setEndTime('');
    setWeeksToGenerate(4);
  };

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
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">RENTALS RECORRENTES</h1>
            <p className="text-muted-foreground text-sm">
              Agende sessões semanais fixas
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Série
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Rentals Recorrentes</DialogTitle>
                <DialogDescription>
                  Configure uma sessão semanal fixa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select 
                    value={selectedWeekday?.toString() ?? ''} 
                    onValueChange={(v) => setSelectedWeekday(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Área</Label>
                  <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas?.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.nome} {area.is_exclusive && '(Exclusiva)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Início</Label>
                    <Select value={startTime} onValueChange={(v) => { setStartTime(v); setEndTime(''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Início" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Fim</Label>
                    <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Fim" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.filter(t => t > startTime).map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Número de Semanas</Label>
                  <Select value={weeksToGenerate.toString()} onValueChange={(v) => setWeeksToGenerate(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 semanas</SelectItem>
                      <SelectItem value="4">4 semanas</SelectItem>
                      <SelectItem value="8">8 semanas</SelectItem>
                      <SelectItem value="12">12 semanas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {coachInfo?.fee_type === 'FIXED' && (
                  <p className="text-sm text-muted-foreground">
                    Taxa por sessão: €{(coachInfo.fee_value / 100).toFixed(2)} × {weeksToGenerate} = €{((coachInfo.fee_value * weeksToGenerate) / 100).toFixed(2)} total
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createRecurringMutation.mutate()}
                  disabled={selectedWeekday === null || !selectedAreaId || !startTime || !endTime || createRecurringMutation.isPending}
                >
                  {createRecurringMutation.isPending ? 'Criando...' : 'Criar Série'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Series List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                Carregando...
              </CardContent>
            </Card>
          ) : groupedBySeries && Object.keys(groupedBySeries).length > 0 ? (
            Object.entries(groupedBySeries).map(([seriesId, rentals]) => {
              if (!rentals || rentals.length === 0) return null;
              const firstRental = rentals[0];
              const weekday = new Date(firstRental.rental_date).getDay();
              const weekdayName = WEEKDAYS.find(d => d.value === weekday)?.label;

              return (
                <Card key={seriesId} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                          <RepeatIcon className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {weekdayName}s às {firstRental.start_time.slice(0, 5)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {(firstRental.areas as any)?.nome}
                            <span className="mx-1">•</span>
                            <Clock className="h-3 w-3" />
                            {firstRental.start_time.slice(0, 5)} - {firstRental.end_time.slice(0, 5)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {rentals.length} sessões
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => cancelSeriesMutation.mutate(seriesId)}
                          disabled={cancelSeriesMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {rentals.map((rental) => (
                        <Badge key={rental.id} variant="outline" className="text-xs">
                          {format(new Date(rental.rental_date), 'dd/MM', { locale: ptBR })}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <RepeatIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum rental recorrente agendado
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeira Série
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RecurringRentals;