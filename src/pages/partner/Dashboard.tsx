import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Wallet, Clock, Users, MapPin, History } from 'lucide-react';

const PartnerDashboard = () => {
  const { staff } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  // Get coach_id from staff
  const coachId = staff?.coach_id;

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">PORTAL DO PARTNER</h1>
            <p className="text-muted-foreground text-sm">
              {coachInfo?.modalidade ? `Coach de ${coachInfo.modalidade}` : 'Coach'} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          {coachInfo && (
            <Badge variant="outline" className="uppercase">
              {coachInfo.fee_type === 'FIXED' 
                ? `€${(coachInfo.fee_value / 100).toFixed(2)}/sessão` 
                : `${coachInfo.fee_value}% por aluno`}
            </Badge>
          )}
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
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
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
                          {getStatusBadge(rental.status || 'SCHEDULED')}
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
