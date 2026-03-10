import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useClassBookings, useCreateBooking, useCheckInBooking } from '@/hooks/useClassBookings';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Calendar,
  Clock,
  Search,
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface ClassInfo {
  id: string;
  nome: string;
  modalidade: string;
  dia_semana: number;
  hora_inicio: string;
  duracao_min: number;
  capacidade: number | null;
  external_coaches?: { nome: string } | null;
}

const ClassRoster = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; nome: string; telefone: string; qr_code: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const dayOfWeek = new Date(selectedDate).getDay();

  // Fetch classes for selected day of week
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes-for-day', dayOfWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          nome,
          modalidade,
          dia_semana,
          hora_inicio,
          duracao_min,
          capacidade,
          external_coaches (nome)
        `)
        .eq('dia_semana', dayOfWeek)
        .eq('ativo', true)
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
      return data as ClassInfo[];
    },
  });

  // Fetch bookings for selected class and date
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useClassBookings(
    selectedClassId,
    selectedDate
  );

  const createBooking = useCreateBooking();
  const checkInBooking = useCheckInBooking();

  const selectedClass = useMemo(
    () => classes?.find((c) => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  // Stats for selected class
  const stats = useMemo(() => {
    if (!bookings || !selectedClass) return { booked: 0, checkedIn: 0, cancelled: 0, available: null };

    const booked = bookings.filter((b) => b.status === 'BOOKED').length;
    const checkedIn = bookings.filter((b) => b.status === 'CHECKED_IN').length;
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
    const total = booked + checkedIn;
    const available = selectedClass.capacidade ? selectedClass.capacidade - total : null;

    return { booked, checkedIn, cancelled, available, total };
  }, [bookings, selectedClass]);

  // Navigate dates
  const goToPreviousDay = () => {
    setSelectedDate(subDays(parseISO(selectedDate), 1).toISOString().split('T')[0]);
    setSelectedClassId(null);
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(parseISO(selectedDate), 1).toISOString().split('T')[0]);
    setSelectedClassId(null);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedClassId(null);
  };

  // Search members
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const { data, error } = await supabase
      .from('members')
      .select('id, nome, telefone, qr_code')
      .eq('status', 'ATIVO')
      .or(`nome.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
      .limit(10);

    if (!error && data) {
      setSearchResults(data);
    }
    setIsSearching(false);
  };

  // Add member to class
  const handleAddMember = async (memberId: string) => {
    if (!selectedClassId || !staffId) return;

    try {
      await createBooking.mutateAsync({
        classId: selectedClassId,
        memberId,
        classDate: selectedDate,
        createdBy: staffId,
      });

      toast({
        title: 'Aluno adicionado',
        description: 'Reserva criada com sucesso',
      });

      setShowAddMemberDialog(false);
      setSearchQuery('');
      setSearchResults([]);
      refetchBookings();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao adicionar aluno',
        variant: 'destructive',
      });
    }
  };

  // Manual check-in
  const handleManualCheckIn = async (bookingId: string) => {
    try {
      await checkInBooking.mutateAsync(bookingId);
      toast({
        title: 'Check-in realizado',
        description: 'Presença confirmada',
      });
      refetchBookings();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao fazer check-in',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Reservado</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Presente</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">Cancelado</Badge>;
      case 'NO_SHOW':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">Faltou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">LISTA DE PRESENÇAS</h1>
            <p className="text-muted-foreground text-sm">
              Gerir reservas e presenças nas aulas
            </p>
          </div>
        </div>

        {/* Date Navigation */}
        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-semibold">
                    {format(parseISO(selectedDate), 'dd MMM', { locale: pt })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(selectedDate), 'EEEE', { locale: pt })}
                  </p>
                </div>
                {!isToday(parseISO(selectedDate)) && (
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoje
                  </Button>
                )}
              </div>

              <Button variant="ghost" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Class Selection */}
          <Card className="bg-card border-border lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Aulas do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : classes?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Sem aulas neste dia
                </p>
              ) : (
                <div className="space-y-2">
                  {classes?.map((classItem) => (
                    <button
                      key={classItem.id}
                      onClick={() => setSelectedClassId(classItem.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedClassId === classItem.id
                          ? 'bg-accent/20 border-accent'
                          : 'bg-secondary/50 border-border hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{classItem.nome}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{classItem.hora_inicio.slice(0, 5)}</span>
                            <span>•</span>
                            <span>{classItem.duracao_min} min</span>
                          </div>
                          {classItem.external_coaches?.nome && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Coach: {classItem.external_coaches.nome}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {classItem.modalidade}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roster */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {selectedClass ? selectedClass.nome : 'Selecione uma Aula'}
                </CardTitle>
                {selectedClass && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddMemberDialog(true)}
                    className="bg-accent hover:bg-accent/90"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                )}
              </div>
              {selectedClass && (
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-green-400">{stats.checkedIn} presentes</span>
                  <span className="text-blue-400">{stats.booked} reservados</span>
                  {stats.available !== null && (
                    <span className="text-muted-foreground">{stats.available} vagas</span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedClassId ? (
                <p className="text-center text-muted-foreground py-12">
                  Selecione uma aula para ver a lista de presenças
                </p>
              ) : bookingsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : bookings?.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma reserva para esta aula</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowAddMemberDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Aluno
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookings?.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold">
                          {booking.members?.nome?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{booking.members?.nome || 'Desconhecido'}</p>
                          <p className="text-sm text-muted-foreground">{booking.members?.telefone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(booking.status)}
                        {booking.status === 'BOOKED' && isToday(parseISO(selectedDate)) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManualCheckIn(booking.id)}
                            disabled={checkInBooking.isPending}
                            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Check-in
                          </Button>
                        )}
                        {booking.status === 'CHECKED_IN' && booking.checked_in_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(booking.checked_in_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Member Dialog */}
        <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Adicionar Aluno à Aula</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Pesquisar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-secondary border-border"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddMember(member.id)}
                      disabled={createBooking.isPending}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary transition-colors"
                    >
                      <div className="text-left">
                        <p className="font-medium">{member.nome}</p>
                        <p className="text-sm text-muted-foreground">{member.telefone}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum membro encontrado
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ClassRoster;
