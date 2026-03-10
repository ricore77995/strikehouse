import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  QrCode,
  Calendar,
  Clock,
  Plus,
  X,
  CalendarDays,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface MemberData {
  id: string;
  nome: string;
  qr_code: string;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
  weekly_limit: number | null;
  booking_blocked_until: string | null;
}

interface ClassBooking {
  id: string;
  class_id: string;
  class_date: string;
  status: string;
  booked_at: string;
  checked_in_at: string | null;
  classes: {
    id: string;
    nome: string;
    modalidade: string;
    dia_semana: number;
    hora_inicio: string;
    duracao_min: number;
  };
}

interface AvailableClass {
  id: string;
  nome: string;
  modalidade: string;
  dia_semana: number;
  hora_inicio: string;
  duracao_min: number;
  capacidade: number | null;
  bookingCount: number;
  spotsAvailable: number | null;
  isFull: boolean;
}

const DIAS_SEMANA_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MemberQR = () => {
  const { qrCode } = useParams<{ qrCode: string }>();
  const queryClient = useQueryClient();
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Fetch member data
  useEffect(() => {
    const fetchMember = async () => {
      if (!qrCode) {
        setError('QR Code inválido');
        setLoading(false);
        return;
      }

      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error: fetchError } = await supabase
          .rpc('get_member_by_qr', { qr_code_input: qrCode });

        if (fetchError || !data || data.length === 0) {
          console.error('Error fetching member:', fetchError);
          setError('QR Code não encontrado');
          setLoading(false);
          return;
        }

        setMember(data[0] as MemberData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching member:', err);
        setError('Erro ao conectar com o servidor');
        setLoading(false);
      }
    };

    fetchMember();
  }, [qrCode]);

  // Fetch member bookings
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['member-bookings-public', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { supabase } = await import('@/integrations/supabase/client');
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          *,
          classes (
            id, nome, modalidade, dia_semana, hora_inicio, duracao_min
          )
        `)
        .eq('member_id', member.id)
        .gte('class_date', today)
        .in('status', ['BOOKED', 'CHECKED_IN'])
        .order('class_date', { ascending: true });

      if (error) throw error;
      return data as ClassBooking[];
    },
    enabled: !!member?.id,
  });

  // Fetch available classes for selected date
  const { data: availableClasses, isLoading: classesLoading } = useQuery({
    queryKey: ['available-classes-public', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { supabase } = await import('@/integrations/supabase/client');
      const dayOfWeek = new Date(selectedDate).getDay();

      // Get classes for this day
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, nome, modalidade, dia_semana, hora_inicio, duracao_min, capacidade')
        .eq('dia_semana', dayOfWeek)
        .eq('ativo', true)
        .order('hora_inicio', { ascending: true });

      if (classesError) throw classesError;
      if (!classes) return [];

      // Get booking counts
      const { data: bookingCounts, error: bookingsError } = await supabase
        .from('class_bookings')
        .select('class_id')
        .eq('class_date', selectedDate)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      if (bookingsError) throw bookingsError;

      const counts: Record<string, number> = {};
      bookingCounts?.forEach((b) => {
        counts[b.class_id] = (counts[b.class_id] || 0) + 1;
      });

      return classes.map((c) => ({
        ...c,
        bookingCount: counts[c.id] || 0,
        spotsAvailable: c.capacidade ? c.capacidade - (counts[c.id] || 0) : null,
        isFull: c.capacidade ? (counts[c.id] || 0) >= c.capacidade : false,
      })) as AvailableClass[];
    },
    enabled: !!selectedDate,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async ({ classId, classDate }: { classId: string; classDate: string }) => {
      if (!member?.id) throw new Error('No member');
      const { supabase } = await import('@/integrations/supabase/client');

      const { data, error } = await supabase
        .from('class_bookings')
        .insert({
          class_id: classId,
          member_id: member.id,
          class_date: classDate,
          status: 'BOOKED',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings-public', member?.id] });
      queryClient.invalidateQueries({ queryKey: ['available-classes-public', selectedDate] });
      setShowBookingDialog(false);
      setSelectedDate(null);
    },
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');

      // Get booking details to check time
      const { data: booking, error: fetchError } = await supabase
        .from('class_bookings')
        .select('*, classes(hora_inicio)')
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) throw new Error('Reserva não encontrada');

      // Check if cancellation is allowed (2+ hours before)
      const classDateTime = new Date(`${booking.class_date}T${booking.classes.hora_inicio}`);
      const now = new Date();
      const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilClass < 2) {
        throw new Error('Não é possível cancelar com menos de 2 horas de antecedência');
      }

      const { error } = await supabase
        .from('class_bookings')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-bookings-public', member?.id] });
      setCancellingBookingId(null);
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Erro ao cancelar');
      setCancellingBookingId(null);
    },
  });

  // Check if member can book (not blocked)
  const canBook = () => {
    if (!member) return false;
    if (member.booking_blocked_until) {
      const blockedUntil = new Date(member.booking_blocked_until);
      if (blockedUntil > new Date()) return false;
    }
    return member.status === 'ATIVO';
  };

  // Helper to determine if member has active access
  const hasActiveAccess = () => {
    if (!member) return false;
    if (member.status !== 'ATIVO') return false;
    if (!member.access_type) return false;
    if (member.access_expires_at) {
      const expiresAt = new Date(member.access_expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return expiresAt >= today;
    }
    return true;
  };

  // Helper to get status display info
  const getStatusInfo = () => {
    if (!member) return null;
    const active = hasActiveAccess();

    if (active) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        text: 'Acesso Ativo',
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    } else {
      if (member.status === 'LEAD') {
        return {
          icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
          text: 'Aguardando Primeiro Pagamento',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50'
        };
      }
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        text: member.status === 'BLOQUEADO' ? 'Acesso Bloqueado' :
              member.status === 'CANCELADO' ? 'Acesso Cancelado' : 'Acesso Expirado',
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      };
    }
  };

  // Generate next 7 days for booking
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date: date.toISOString().split('T')[0],
      label: isToday(date) ? 'Hoje' : isTomorrow(date) ? 'Amanhã' : format(date, 'EEE dd', { locale: pt }),
      dayOfWeek: date.getDay(),
    };
  });

  // Check if member already has booking for a class on selected date
  const hasBookingForClass = (classId: string) => {
    if (!selectedDate || !bookings) return false;
    return bookings.some(
      (b) => b.class_id === classId && b.class_date === selectedDate && b.status !== 'CANCELLED'
    );
  };

  // Get hours until class for cancel button
  const getHoursUntilClass = (classDate: string, classTime: string) => {
    const classDateTime = new Date(`${classDate}T${classTime}`);
    const now = new Date();
    return (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-card border-border">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-medium mb-2">QR Code Inválido</h2>
            <p className="text-sm text-muted-foreground">{error || 'Este QR code não foi encontrado'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header Card with QR */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center space-y-4">
            {/* Logo */}
            <div className="h-10 w-10 mx-auto bg-accent rounded-sm flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-lg">BM</span>
            </div>

            {/* Member Name */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Membro</p>
              <h1 className="text-lg font-semibold tracking-wider uppercase">{member.nome}</h1>
            </div>

            {/* Status Badge */}
            {statusInfo && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bgColor}`}>
                {statusInfo.icon}
                <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
              </div>
            )}

            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg mx-auto w-fit shadow-sm">
              <QRCodeSVG
                value={`${window.location.origin}/m/${member.qr_code}`}
                size={160}
                level="H"
                includeMargin={false}
              />
            </div>

            <p className="text-xs font-mono text-muted-foreground">{member.qr_code}</p>
          </CardContent>
        </Card>

        {/* Bookings Section - Only show if member has active access */}
        {hasActiveAccess() && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Minhas Aulas
                </CardTitle>
                {canBook() && (
                  <Button
                    size="sm"
                    onClick={() => setShowBookingDialog(true)}
                    className="bg-accent hover:bg-accent/90"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Reservar
                  </Button>
                )}
              </div>
              {member.booking_blocked_until && new Date(member.booking_blocked_until) > new Date() && (
                <p className="text-xs text-red-500 mt-2">
                  Bloqueado até {format(new Date(member.booking_blocked_until), 'dd/MM HH:mm')}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : bookings && bookings.length > 0 ? (
                bookings.map((booking) => {
                  const hoursUntil = getHoursUntilClass(booking.class_date, booking.classes.hora_inicio);
                  const canCancel = hoursUntil >= 2 && booking.status === 'BOOKED';
                  const isCheckedIn = booking.status === 'CHECKED_IN';
                  const dateObj = parseISO(booking.class_date);

                  return (
                    <div
                      key={booking.id}
                      className={`p-3 rounded-lg border ${
                        isCheckedIn ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/50 border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{booking.classes.nome}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {isToday(dateObj) ? 'Hoje' : isTomorrow(dateObj) ? 'Amanhã' : format(dateObj, 'EEE dd/MM', { locale: pt })}
                            </span>
                            <Clock className="h-3 w-3 ml-1" />
                            <span>{booking.classes.hora_inicio.slice(0, 5)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCheckedIn ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                              Presente
                            </Badge>
                          ) : canCancel ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancellingBookingId(booking.id);
                                cancelBookingMutation.mutate(booking.id);
                              }}
                              disabled={cancelBookingMutation.isPending && cancellingBookingId === booking.id}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7 px-2"
                            >
                              {cancelBookingMutation.isPending && cancellingBookingId === booking.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {Math.round(hoursUntil)}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6">
                  <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma reserva</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Access Info */}
        {member.access_type && member.access_expires_at && (
          <div className="text-center text-xs text-muted-foreground">
            <span>
              {member.access_type === 'SUBSCRIPTION' ? 'Mensalidade' :
               member.access_type === 'CREDITS' ? 'Créditos' : 'Passe Diário'}
            </span>
            {member.weekly_limit && (
              <span className="ml-1">• {member.weekly_limit}x/semana</span>
            )}
            <span className="ml-1">• Até {new Date(member.access_expires_at).toLocaleDateString('pt-BR')}</span>
          </div>
        )}

        {/* Booking Dialog */}
        <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle>Reservar Aula</DialogTitle>
            </DialogHeader>

            {/* Date Selection */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Selecione o dia:</p>
              <div className="flex flex-wrap gap-2">
                {next7Days.map((day) => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedDate === day.date
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Classes */}
            {selectedDate && (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-muted-foreground">Aulas disponíveis:</p>
                {classesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : availableClasses && availableClasses.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableClasses.map((cls) => {
                      const alreadyBooked = hasBookingForClass(cls.id);

                      return (
                        <div
                          key={cls.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                        >
                          <div>
                            <p className="font-medium text-sm">{cls.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {cls.hora_inicio.slice(0, 5)} • {cls.duracao_min}min
                              {cls.spotsAvailable !== null && (
                                <span className="ml-2">
                                  ({cls.spotsAvailable} vagas)
                                </span>
                              )}
                            </p>
                          </div>
                          {alreadyBooked ? (
                            <Badge variant="outline" className="text-xs">Reservado</Badge>
                          ) : cls.isFull ? (
                            <Badge variant="outline" className="text-xs text-red-500">Lotada</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => createBookingMutation.mutate({
                                classId: cls.id,
                                classDate: selectedDate,
                              })}
                              disabled={createBookingMutation.isPending}
                              className="h-7"
                            >
                              {createBookingMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Reservar'
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Sem aulas neste dia
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MemberQR;
