import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGymSettings, getGymSetting } from '@/hooks/useGymSettings';
import {
  Plus,
  CalendarDays,
  Clock,
  MapPin,
  User,
  XCircle,
  Loader2,
  Calendar as CalendarIcon,
  RepeatIcon
} from 'lucide-react';
import { format, addDays, addWeeks, differenceInHours, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Rental {
  id: string;
  coach_id: string;
  area_id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guest_count: number;
  fee_charged_cents: number | null;
  is_recurring: boolean;
  coach: { id: string; nome: string; modalidade: string | null };
  area: { id: string; nome: string };
}

interface Coach {
  id: string;
  nome: string;
  modalidade: string | null;
  fee_type: string;
  fee_value: number;
}

interface Area {
  id: string;
  nome: string;
  capacidade_pts: number;
  is_exclusive: boolean;
}

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const Rentals = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('single');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    coach_id: '',
    area_id: '',
    rental_date: new Date(),
    start_time: '09:00',
    end_time: '10:00',
  });

  // State for recurring rentals
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [recurringFormData, setRecurringFormData] = useState({
    coach_id: '',
    area_id: '',
    weekday: null as number | null,
    start_time: '',
    end_time: '',
    weeks_to_generate: 4,
  });

  // Fetch rentals for selected date
  const { data: rentals, isLoading } = useQuery({
    queryKey: ['rentals', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          coach:external_coaches!rentals_coach_id_fkey(id, nome, modalidade),
          area:areas!rentals_area_id_fkey(id, nome)
        `)
        .eq('rental_date', format(selectedDate, 'yyyy-MM-dd'))
        .neq('status', 'CANCELLED')
        .order('start_time');

      if (error) throw error;
      return data as Rental[];
    },
  });

  // Fetch coaches
  const { data: coaches } = useQuery({
    queryKey: ['coaches-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_coaches')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Coach[];
    },
  });

  // Fetch areas
  const { data: areas } = useQuery({
    queryKey: ['areas-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data as Area[];
    },
  });

  // Fetch recurring rentals (all future rentals with series_id)
  const { data: recurringRentals, isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['admin-recurring-rentals'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          coach:external_coaches!rentals_coach_id_fkey(id, nome, modalidade),
          area:areas!rentals_area_id_fkey(id, nome)
        `)
        .eq('is_recurring', true)
        .gte('rental_date', today)
        .neq('status', 'CANCELLED')
        .order('rental_date', { ascending: true });

      if (error) throw error;
      return data as Rental[];
    },
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

  // Create rental mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const coach = coaches?.find(c => c.id === data.coach_id);
      const feeCharged = coach?.fee_type === 'FIXED' 
        ? coach.fee_value 
        : null; // Percentage will be calculated later based on guests

      const { error } = await supabase.from('rentals').insert({
        coach_id: data.coach_id,
        area_id: data.area_id,
        rental_date: format(data.rental_date, 'yyyy-MM-dd'),
        start_time: data.start_time,
        end_time: data.end_time,
        fee_charged_cents: feeCharged,
        created_by: staffId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      toast({ title: 'Rental criado com sucesso' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Create rental error:', error);
      toast({ title: 'Erro ao criar rental', variant: 'destructive' });
    },
  });

  // Cancel rental mutation
  const cancelMutation = useMutation({
    mutationFn: async (rental: Rental) => {
      const rentalDateTime = new Date(`${rental.rental_date}T${rental.start_time}`);
      const hoursUntil = differenceInHours(rentalDateTime, new Date());

      // Get configurable threshold from settings
      const threshold = await getGymSetting('cancellation_hours_threshold', '24');
      const creditExpiryDays = await getGymSetting('credit_expiry_days', '90');
      const generateCredit = hoursUntil >= parseInt(threshold);

      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancelled_by: staffId,
          credit_generated: generateCredit,
        })
        .eq('id', rental.id);

      if (error) throw error;

      // Generate credit if cancelled with enough notice
      if (generateCredit && rental.fee_charged_cents) {
        await supabase.from('coach_credits').insert({
          coach_id: rental.coach_id,
          amount: rental.fee_charged_cents,
          reason: 'CANCELLATION',
          rental_id: rental.id,
          expires_at: format(addDays(new Date(), parseInt(creditExpiryDays)), 'yyyy-MM-dd'),
        });
      }

      return { generateCredit };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      toast({ 
        title: 'Rental cancelado',
        description: result.generateCredit 
          ? 'Crédito gerado para o coach'
          : 'Cancelamento com menos de 24h - sem crédito'
      });
    },
    onError: () => {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    },
  });

  // Create recurring rentals mutation
  const createRecurringMutation = useMutation({
    mutationFn: async (data: typeof recurringFormData) => {
      if (!data.coach_id || !data.area_id || data.weekday === null || !data.start_time || !data.end_time) {
        throw new Error('Preencha todos os campos');
      }

      const coach = coaches?.find(c => c.id === data.coach_id);
      const feeCharged = coach?.fee_type === 'FIXED' ? coach.fee_value : null;

      const seriesId = crypto.randomUUID();
      const rentalsToCreate = [];

      // Get next occurrence of selected weekday
      const today = new Date();
      const currentWeekday = today.getDay();
      let daysUntilNext = data.weekday - currentWeekday;
      if (daysUntilNext <= 0) daysUntilNext += 7;

      let nextDate = addDays(today, daysUntilNext);

      // Generate rentals for X weeks
      for (let i = 0; i < data.weeks_to_generate; i++) {
        const rentalDate = format(nextDate, 'yyyy-MM-dd');

        // Check for conflicts
        const { data: conflicts } = await supabase
          .from('rentals')
          .select('id')
          .eq('area_id', data.area_id)
          .eq('rental_date', rentalDate)
          .neq('status', 'CANCELLED')
          .or(`and(start_time.lt.${data.end_time},end_time.gt.${data.start_time})`);

        if (!conflicts || conflicts.length === 0) {
          rentalsToCreate.push({
            coach_id: data.coach_id,
            area_id: data.area_id,
            rental_date: rentalDate,
            start_time: data.start_time,
            end_time: data.end_time,
            fee_charged_cents: feeCharged,
            status: 'SCHEDULED',
            is_recurring: true,
            series_id: seriesId,
            created_by: staffId,
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
      toast({
        title: `${count} rentals recorrentes criados`,
        description: 'Série agendada com sucesso'
      });
      queryClient.invalidateQueries({ queryKey: ['admin-recurring-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      setIsRecurringDialogOpen(false);
      resetRecurringForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar série',
        description: error.message,
        variant: 'destructive'
      });
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
          cancelled_by: staffId,
        })
        .eq('series_id', seriesId)
        .eq('status', 'SCHEDULED');

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Série cancelada com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['admin-recurring-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao cancelar série',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const resetRecurringForm = () => {
    setRecurringFormData({
      coach_id: '',
      area_id: '',
      weekday: null,
      start_time: '',
      end_time: '',
      weeks_to_generate: 4,
    });
  };

  const resetForm = () => {
    setFormData({
      coach_id: '',
      area_id: '',
      rental_date: new Date(),
      start_time: '09:00',
      end_time: '10:00',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.coach_id || !formData.area_id) {
      toast({ title: 'Selecione coach e área', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-500/20 text-blue-500';
      case 'IN_PROGRESS': return 'bg-green-500/20 text-green-500';
      case 'COMPLETED': return 'bg-muted text-muted-foreground';
      case 'CANCELLED': return 'bg-destructive/20 text-destructive';
      default: return 'bg-secondary';
    }
  };

  const timeSlots = Array.from({ length: 14 }, (_, i) => {
    const hour = 7 + i;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">RENTALS</h1>
            <p className="text-muted-foreground text-sm">
              Gerenciar sublocação de espaços
            </p>
          </div>
          <Button onClick={() => activeTab === 'single' ? setIsDialogOpen(true) : setIsRecurringDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'single' ? 'Novo Rental' : 'Nova Série'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="single">Single</TabsTrigger>
            <TabsTrigger value="recurring">Recorrente</TabsTrigger>
          </TabsList>

          {/* Tab 1: Single Rentals (existing content) */}
          <TabsContent value="single" className="space-y-4">
            {/* Date Selector */}
            <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "PPP", { locale: pt })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Hoje
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(new Date(), 1))}
                >
                  Amanhã
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rentals List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: pt })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rentals && rentals.length > 0 ? (
              <div className="space-y-3">
                {rentals.map((rental) => (
                  <div
                    key={rental.id}
                    className="p-4 bg-secondary rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
                          </span>
                          <Badge className={getStatusColor(rental.status)}>
                            {rental.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {rental.coach.nome}
                            {rental.coach.modalidade && ` (${rental.coach.modalidade})`}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {rental.area.nome}
                          </span>
                        </div>
                        {rental.guest_count > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rental.guest_count} guest(s) registrado(s)
                          </p>
                        )}
                      </div>
                      {rental.status === 'SCHEDULED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => cancelMutation.mutate(rental)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum rental agendado para este dia</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Novo Rental</DialogTitle>
              <DialogDescription>
                Agendar sublocação de espaço
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Coach *</Label>
                <Select
                  value={formData.coach_id}
                  onValueChange={(value) => setFormData({ ...formData, coach_id: value })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione o coach" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches?.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.nome} {coach.modalidade && `(${coach.modalidade})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Área *</Label>
                <Select
                  value={formData.area_id}
                  onValueChange={(value) => setFormData({ ...formData, area_id: value })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas?.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-secondary"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.rental_date, "PPP", { locale: pt })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.rental_date}
                      onSelect={(date) => date && setFormData({ ...formData, rental_date: date })}
                      disabled={(date) => isBefore(date, new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Select
                    value={formData.start_time}
                    onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
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
                  <Label>Fim</Label>
                  <Select
                    value={formData.end_time}
                    onValueChange={(value) => setFormData({ ...formData, end_time: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
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
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* Tab 2: Recurring Rentals (new content) */}
          <TabsContent value="recurring" className="space-y-4">
            {isLoadingRecurring ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : groupedBySeries && Object.keys(groupedBySeries).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedBySeries).map(([seriesId, rentals]) => {
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
                              <CardTitle className="text-base uppercase tracking-wider">
                                {weekdayName}s às {firstRental.start_time.slice(0, 5)}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 text-xs">
                                <User className="h-3 w-3" />
                                {firstRental.coach.nome}
                                {firstRental.coach.modalidade && ` (${firstRental.coach.modalidade})`}
                                <span className="mx-1">•</span>
                                <MapPin className="h-3 w-3" />
                                {firstRental.area.nome}
                                <span className="mx-1">•</span>
                                <Clock className="h-3 w-3" />
                                {firstRental.start_time.slice(0, 5)} - {firstRental.end_time.slice(0, 5)}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {rentals.length} sessões
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => cancelSeriesMutation.mutate(seriesId)}
                              disabled={cancelSeriesMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {rentals.map((rental) => (
                            <Badge key={rental.id} variant="outline" className="text-xs">
                              {format(new Date(rental.rental_date), 'dd/MM', { locale: pt })}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhuma série recorrente agendada
                  </p>
                  <Button onClick={() => setIsRecurringDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Primeira Série
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recurring Rental Dialog */}
            <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-wider">Nova Série Recorrente</DialogTitle>
                  <DialogDescription>
                    Agendar rentals semanais fixos
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createRecurringMutation.mutate(recurringFormData);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Coach *</Label>
                    <Select
                      value={recurringFormData.coach_id}
                      onValueChange={(value) => setRecurringFormData({ ...recurringFormData, coach_id: value })}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Selecione o coach" />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches?.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.nome} {coach.modalidade && `(${coach.modalidade})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Área *</Label>
                    <Select
                      value={recurringFormData.area_id}
                      onValueChange={(value) => setRecurringFormData({ ...recurringFormData, area_id: value })}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Selecione a área" />
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

                  <div className="space-y-2">
                    <Label>Dia da Semana *</Label>
                    <Select
                      value={recurringFormData.weekday?.toString() ?? ''}
                      onValueChange={(v) => setRecurringFormData({ ...recurringFormData, weekday: parseInt(v) })}
                    >
                      <SelectTrigger className="bg-secondary border-border">
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Início *</Label>
                      <Select
                        value={recurringFormData.start_time}
                        onValueChange={(value) => setRecurringFormData({ ...recurringFormData, start_time: value, end_time: '' })}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="Hora início" />
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
                      <Label>Fim *</Label>
                      <Select
                        value={recurringFormData.end_time}
                        onValueChange={(value) => setRecurringFormData({ ...recurringFormData, end_time: value })}
                        disabled={!recurringFormData.start_time}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="Hora fim" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.filter(t => t > recurringFormData.start_time).map((time) => (
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
                    <Select
                      value={recurringFormData.weeks_to_generate.toString()}
                      onValueChange={(v) => setRecurringFormData({ ...recurringFormData, weeks_to_generate: parseInt(v) })}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 semanas</SelectItem>
                        <SelectItem value="4">4 semanas (1 mês)</SelectItem>
                        <SelectItem value="8">8 semanas (2 meses)</SelectItem>
                        <SelectItem value="12">12 semanas (3 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsRecurringDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-accent hover:bg-accent/90"
                      disabled={createRecurringMutation.isPending}
                    >
                      {createRecurringMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Série
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Rentals;
