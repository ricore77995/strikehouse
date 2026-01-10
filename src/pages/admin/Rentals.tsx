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
import { 
  Plus, 
  CalendarDays, 
  Clock, 
  MapPin, 
  User, 
  XCircle,
  Loader2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format, addDays, differenceInHours, isBefore } from 'date-fns';
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

const Rentals = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    coach_id: '',
    area_id: '',
    rental_date: new Date(),
    start_time: '09:00',
    end_time: '10:00',
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
      const generateCredit = hoursUntil >= 24;

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

      // Generate credit if cancelled with >24h notice
      if (generateCredit && rental.fee_charged_cents) {
        await supabase.from('coach_credits').insert({
          coach_id: rental.coach_id,
          amount: rental.fee_charged_cents,
          reason: 'Cancelamento com antecedência',
          rental_id: rental.id,
          expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
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
              Agendar sublocação de espaços
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Rental
          </Button>
        </div>

        {/* Date Selector */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
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
      </div>
    </DashboardLayout>
  );
};

export default Rentals;
