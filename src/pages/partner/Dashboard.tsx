import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfMonth, endOfMonth, addDays, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Wallet, Clock, Users, MapPin, History, Plus, X, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PartnerDashboard = () => {
  const { staff } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  // Get coach_id from staff
  const coachId = staff?.coach_id;

  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [cancellingRentalId, setCancellingRentalId] = useState<string | null>(null);

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

  const { data: upcomingRentals } = useQuery({
    queryKey: ['partner-upcoming-rentals', coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          areas(nome)
        `)
        .eq('coach_id', coachId)
        .gte('rental_date', today)
        .neq('status', 'CANCELLED')
        .order('rental_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const { data: monthRentals } = useQuery({
    queryKey: ['partner-month-rentals', coachId, monthStart, monthEnd],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          areas(nome)
        `)
        .eq('coach_id', coachId)
        .gte('rental_date', monthStart)
        .lte('rental_date', monthEnd)
        .order('rental_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const { data: creditHistory } = useQuery({
    queryKey: ['partner-credits', coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from('coach_credits')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const nextRental = upcomingRentals?.[0];
  const totalCredits = coachInfo?.credits_balance || 0;
  const completedRentals = monthRentals?.filter(r => r.status === 'COMPLETED').length || 0;
  const scheduledRentals = monthRentals?.filter(r => r.status === 'SCHEDULED').length || 0;

  // Calculate fee for rental
  const calculateFee = () => {
    if (!coachInfo) return 0;
    if (coachInfo.fee_type === 'FIXED') {
      return coachInfo.fee_value;
    }
    return 0; // Per-student fee will be calculated later
  };

  // Create rental mutation
  const createRentalMutation = useMutation({
    mutationFn: async () => {
      if (!coachId || !selectedDate || !selectedAreaId || !startTime || !endTime) {
        throw new Error('Preencha todos os campos');
      }

      const rentalDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Check for time conflicts in the same area
      const { data: conflictingRentals, error: conflictError } = await supabase
        .from('rentals')
        .select('id, start_time, end_time')
        .eq('area_id', selectedAreaId)
        .eq('rental_date', rentalDate)
        .neq('status', 'CANCELLED');

      if (conflictError) throw conflictError;

      // Check for overlapping times
      const hasConflict = conflictingRentals?.some(rental => {
        const existingStart = rental.start_time;
        const existingEnd = rental.end_time;
        // Overlap: new start < existing end AND new end > existing start
        return startTime < existingEnd && endTime > existingStart;
      });

      if (hasConflict) {
        throw new Error('Já existe um rental agendado nesta área neste horário. Escolha outro horário ou área.');
      }
      
      const fee = calculateFee();
      const { error } = await supabase
        .from('rentals')
        .insert({
          coach_id: coachId,
          area_id: selectedAreaId,
          rental_date: rentalDate,
          start_time: startTime,
          end_time: endTime,
          fee_charged_cents: fee,
          status: 'SCHEDULED',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rental criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['partner-upcoming-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-month-rentals'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar rental');
    },
  });

  // Cancel rental mutation
  const cancelRentalMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      const rental = upcomingRentals?.find(r => r.id === rentalId);
      if (!rental) throw new Error('Rental não encontrado');

      // Calculate hours until rental
      const rentalDateTime = new Date(`${rental.rental_date}T${rental.start_time}`);
      const hoursUntil = differenceInHours(rentalDateTime, new Date());

      // Update rental status
      const { error: updateError } = await supabase
        .from('rentals')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', rentalId);

      if (updateError) throw updateError;

      // Generate credit if cancelled with enough notice (24h+)
      if (hoursUntil >= 24 && rental.fee_charged_cents && rental.fee_charged_cents > 0) {
        const { error: creditError } = await supabase
          .from('coach_credits')
          .insert({
            coach_id: coachId!,
            amount: rental.fee_charged_cents,
            reason: `Cancelamento antecipado (${hoursUntil}h antes)`,
            rental_id: rentalId,
            expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
          });
        
        if (creditError) throw creditError;

        // Update coach balance
        await supabase
          .from('external_coaches')
          .update({ credits_balance: (coachInfo?.credits_balance || 0) + rental.fee_charged_cents })
          .eq('id', coachId!);
      }
    },
    onSuccess: () => {
      toast.success('Rental cancelado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['partner-upcoming-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-month-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-credits'] });
      queryClient.invalidateQueries({ queryKey: ['partner-coach-info'] });
      setCancellingRentalId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cancelar rental');
      setCancellingRentalId(null);
    },
  });

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedAreaId('');
    setStartTime('');
    setEndTime('');
  };

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Agendado</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Concluído</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!coachId) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Sua conta de partner ainda não está vinculada a um coach.
                <br />
                Entre em contato com a administração.
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
            <h1 className="text-2xl tracking-wider mb-1">PORTAL DO PARTNER</h1>
            <p className="text-muted-foreground text-sm">
              {coachInfo?.modalidade ? `Coach de ${coachInfo.modalidade}` : 'Coach'} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {coachInfo && (
              <Badge variant="outline" className="uppercase">
                {coachInfo.fee_type === 'FIXED' 
                  ? `€${(coachInfo.fee_value / 100).toFixed(2)}/sessão` 
                  : `${coachInfo.fee_value}% por aluno`}
              </Badge>
            )}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Rental
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Agendar Novo Rental</DialogTitle>
                  <DialogDescription>
                    Preencha os dados para agendar uma nova sessão
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                      <Select value={startTime} onValueChange={setStartTime}>
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
                      <Select value={endTime} onValueChange={setEndTime}>
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
                  {coachInfo?.fee_type === 'FIXED' && (
                    <p className="text-sm text-muted-foreground">
                      Taxa: €{(coachInfo.fee_value / 100).toFixed(2)}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createRentalMutation.mutate()}
                    disabled={!selectedDate || !selectedAreaId || !startTime || !endTime || createRentalMutation.isPending}
                  >
                    {createRentalMutation.isPending ? 'Agendando...' : 'Agendar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Créditos Disponíveis
              </CardTitle>
              <Wallet className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                €{(totalCredits / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                De cancelamentos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Próximo Rental
              </CardTitle>
              <Clock className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              {nextRental ? (
                <>
                  <div className="text-lg font-medium">
                    {format(new Date(nextRental.rental_date), "dd/MM")} às {nextRental.start_time.slice(0, 5)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(nextRental.areas as any)?.nome}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-medium">Nenhum</div>
                  <p className="text-xs text-muted-foreground">Agendado</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Rentals Este Mês
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedRentals + scheduledRentals}</div>
              <p className="text-xs text-muted-foreground">
                {completedRentals} concluídos • {scheduledRentals} agendados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Upcoming Rentals */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Próximos Rentals
              </CardTitle>
              <CardDescription>Suas sessões agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                {upcomingRentals && upcomingRentals.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingRentals.map((rental) => (
                      <div
                        key={rental.id}
                        className="p-4 bg-muted/50 rounded-lg border border-border"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium">
                              {format(new Date(rental.rental_date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {(rental.areas as any)?.nome}
                              </span>
                            </div>
                            {rental.guest_count && rental.guest_count > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {rental.guest_count} alunos esperados
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(rental.status || 'SCHEDULED')}
                            {rental.status === 'SCHEDULED' && (
                              <Dialog open={cancellingRentalId === rental.id} onOpenChange={(open) => setCancellingRentalId(open ? rental.id : null)}>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2">
                                    <X className="h-3 w-3 mr-1" />
                                    Cancelar
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Cancelar Rental</DialogTitle>
                                    <DialogDescription>
                                      Tem certeza que deseja cancelar este rental?
                                      {(() => {
                                        const rentalDateTime = new Date(`${rental.rental_date}T${rental.start_time}`);
                                        const hoursUntil = differenceInHours(rentalDateTime, new Date());
                                        if (hoursUntil >= 24) {
                                          return (
                                            <span className="block mt-2 text-green-500">
                                              ✓ Cancelamento com mais de 24h de antecedência. Você receberá um crédito de €{((rental.fee_charged_cents || 0) / 100).toFixed(2)}.
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="block mt-2 text-yellow-500">
                                            ⚠ Cancelamento com menos de 24h. Não há crédito disponível.
                                          </span>
                                        );
                                      })()}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setCancellingRentalId(null)}>
                                      Voltar
                                    </Button>
                                    <Button 
                                      variant="destructive"
                                      onClick={() => cancelRentalMutation.mutate(rental.id)}
                                      disabled={cancelRentalMutation.isPending}
                                    >
                                      {cancelRentalMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum rental agendado
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Credit History */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Créditos
              </CardTitle>
              <CardDescription>Créditos de cancelamentos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                {creditHistory && creditHistory.length > 0 ? (
                  <div className="space-y-3">
                    {creditHistory.map((credit) => (
                      <div
                        key={credit.id}
                        className="p-3 bg-muted/50 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{credit.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {credit.created_at && format(new Date(credit.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {credit.expires_at && (
                            <p className="text-xs text-yellow-500">
                              Expira: {format(new Date(credit.expires_at), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                        <span className={`text-sm font-bold ${credit.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {credit.amount > 0 ? '+' : ''}€{(credit.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum crédito registrado
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Month History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm">
              Histórico do Mês - {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {monthRentals && monthRentals.length > 0 ? (
                <div className="space-y-2">
                  {monthRentals.map((rental) => (
                    <div
                      key={rental.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-16">
                          <p className="text-lg font-bold">{format(new Date(rental.rental_date), 'dd')}</p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {format(new Date(rental.rental_date), 'EEE', { locale: ptBR })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(rental.areas as any)?.nome}
                            {rental.guest_count ? ` • ${rental.guest_count} alunos` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(rental.status || 'SCHEDULED')}
                        {rental.fee_charged_cents && (
                          <p className="text-xs text-muted-foreground mt-1">
                            €{(rental.fee_charged_cents / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum rental neste mês
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PartnerDashboard;
