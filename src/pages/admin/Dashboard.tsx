import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Users, QrCode, CalendarDays, DollarSign, AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardStats {
  checkinsToday: number;
  membrosAtivos: number;
  rentalsToday: number;
  receitaMes: number;
  membrosExpirando: number;
  pendingPayments: number;
}

interface RecentCheckin {
  id: string;
  checked_in_at: string;
  result: string;
  type: string;
  guest_name: string | null;
  member: { nome: string } | null;
}

interface TodayRental {
  id: string;
  start_time: string;
  end_time: string;
  coach_nome: string;
  area_nome: string;
  status: string;
}

const AdminDashboard = () => {
  const { staff } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    checkinsToday: 0,
    membrosAtivos: 0,
    rentalsToday: 0,
    receitaMes: 0,
    membrosExpirando: 0,
    pendingPayments: 0,
  });
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [todayRentals, setTodayRentals] = useState<TodayRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get first day of month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayISO = firstDayOfMonth.toISOString().split('T')[0];

    // Parallel queries
    const [
      checkinsResult,
      membrosResult,
      rentalsResult,
      receitaResult,
      expiringResult,
      pendingResult,
      recentCheckinsResult,
      todayRentalsResult,
    ] = await Promise.all([
      // Check-ins today
      supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .gte('checked_in_at', todayISO),

      // Active members
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ATIVO'),

      // Rentals today
      supabase
        .from('v_today_rentals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SCHEDULED'),

      // Revenue this month
      supabase
        .from('transactions')
        .select('amount_cents')
        .eq('type', 'RECEITA')
        .gte('transaction_date', firstDayISO),

      // Expiring members (next 7 days)
      supabase
        .from('v_expiring_members')
        .select('id', { count: 'exact', head: true }),

      // Pending payments
      supabase
        .from('pending_payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),

      // Recent check-ins (last 10)
      supabase
        .from('check_ins')
        .select(`
          id,
          checked_in_at,
          result,
          type,
          guest_name,
          member:members(nome)
        `)
        .gte('checked_in_at', todayISO)
        .order('checked_in_at', { ascending: false })
        .limit(10),

      // Today's rentals
      supabase
        .from('v_today_rentals')
        .select('id, start_time, end_time, coach_nome, area_nome, status')
        .order('start_time', { ascending: true }),
    ]);

    // Calculate total revenue
    const totalReceita = receitaResult.data?.reduce(
      (sum, t) => sum + (t.amount_cents || 0),
      0
    ) || 0;

    setStats({
      checkinsToday: checkinsResult.count || 0,
      membrosAtivos: membrosResult.count || 0,
      rentalsToday: rentalsResult.count || 0,
      receitaMes: totalReceita,
      membrosExpirando: expiringResult.count || 0,
      pendingPayments: pendingResult.count || 0,
    });

    setRecentCheckins((recentCheckinsResult.data || []) as unknown as RecentCheckin[]);
    setTodayRentals((todayRentalsResult.data || []) as TodayRental[]);
    setIsLoading(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const formatTime = (time: string) => time?.slice(0, 5) || '';

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">DASHBOARD</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo, {staff?.nome}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Check-ins Hoje
              </CardTitle>
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.checkinsToday}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Membros Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.membrosAtivos}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Rentals Hoje
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats.rentalsToday}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Receita do Mês
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {isLoading ? '...' : formatCurrency(stats.receitaMes)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(stats.membrosExpirando > 0 || stats.pendingPayments > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.membrosExpirando > 0 && (
              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="flex items-center gap-4 py-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.membrosExpirando} membros a expirar</p>
                    <p className="text-sm text-muted-foreground">Nos próximos 7 dias</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="uppercase tracking-wider text-xs">
                    <Link to="/admin/billing">Ver</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {stats.pendingPayments > 0 && (
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="flex items-center gap-4 py-4">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.pendingPayments} pagamentos pendentes</p>
                    <p className="text-sm text-muted-foreground">Aguardando confirmação</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="uppercase tracking-wider text-xs">
                    <Link to="/admin/finances/verify">Verificar</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base">Ações Rápidas</CardTitle>
            <CardDescription>Acesso direto às funções principais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/staff/checkin">Check-in</Link>
              </Button>
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/staff/guests">Guests</Link>
              </Button>
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/admin/members">Membros</Link>
              </Button>
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/staff/payment">Pagamento</Link>
              </Button>
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/staff/sales">Nova Venda</Link>
              </Button>
              <Button asChild variant="outline" className="uppercase tracking-wider text-xs">
                <Link to="/admin/rentals">Rentals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base">Check-ins de Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCheckins.length > 0 ? (
                <div className="space-y-2">
                  {recentCheckins.map((checkin) => (
                    <div
                      key={checkin.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded text-sm',
                        checkin.result === 'ALLOWED' ? 'bg-green-500/10' : 'bg-destructive/10'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle 
                          className={cn(
                            'h-3 w-3',
                            checkin.result === 'ALLOWED' ? 'text-green-500' : 'text-destructive'
                          )} 
                        />
                        <span>
                          {checkin.type === 'GUEST' 
                            ? checkin.guest_name 
                            : checkin.member?.nome || 'Membro'}
                        </span>
                        {checkin.type === 'GUEST' && (
                          <span className="text-xs text-muted-foreground">(Guest)</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(checkin.checked_in_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum check-in hoje
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base">Rentals de Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {todayRentals.length > 0 ? (
                <div className="space-y-2">
                  {todayRentals.map((rental) => (
                    <div
                      key={rental.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded text-sm',
                        rental.status === 'SCHEDULED' ? 'bg-accent/10' : 'bg-muted'
                      )}
                    >
                      <div>
                        <p className="font-medium">{rental.coach_nome}</p>
                        <p className="text-xs text-muted-foreground">{rental.area_nome}</p>
                      </div>
                      <span className="text-xs font-mono">
                        {formatTime(rental.start_time)} - {formatTime(rental.end_time)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum rental agendado
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
