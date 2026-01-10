import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DollarSign, Users, TrendingUp, CalendarDays, AlertTriangle, 
  Clock, ArrowUpRight, ArrowDownRight, CreditCard, BarChart3 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const OwnerDashboard = () => {
  const { staff } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  // Stats queries
  const { data: todayRevenue } = useQuery({
    queryKey: ['owner-today-revenue', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount_cents')
        .eq('transaction_date', today)
        .eq('type', 'RECEITA');
      if (error) throw error;
      return data.reduce((sum, t) => sum + t.amount_cents, 0) / 100;
    },
  });

  const { data: monthRevenue } = useQuery({
    queryKey: ['owner-month-revenue', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount_cents')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .eq('type', 'RECEITA');
      if (error) throw error;
      return data.reduce((sum, t) => sum + t.amount_cents, 0) / 100;
    },
  });

  const { data: activeMembers } = useQuery({
    queryKey: ['owner-active-members'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('v_active_members')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: newMembersThisMonth } = useQuery({
    queryKey: ['owner-new-members-month', monthStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: todayCheckins } = useQuery({
    queryKey: ['owner-today-checkins', today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .gte('checked_in_at', `${today}T00:00:00`)
        .lte('checked_in_at', `${today}T23:59:59`);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: todayRentals } = useQuery({
    queryKey: ['owner-today-rentals', today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rentals')
        .select('*', { count: 'exact', head: true })
        .eq('rental_date', today)
        .neq('status', 'CANCELLED');
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: overdueMembers } = useQuery({
    queryKey: ['owner-overdue-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_overdue_members')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ['owner-pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_payments')
        .select(`*, members(nome)`)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: revenueByPlan } = useQuery({
    queryKey: ['owner-revenue-by-plan', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount_cents, description')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .eq('type', 'RECEITA')
        .eq('category', 'MENSALIDADE');
      if (error) throw error;
      
      const byPlan: Record<string, number> = {};
      data.forEach(t => {
        const plan = t.description || 'Outros';
        byPlan[plan] = (byPlan[plan] || 0) + t.amount_cents / 100;
      });
      return Object.entries(byPlan).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: dailyRevenue } = useQuery({
    queryKey: ['owner-daily-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_daily_summary')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(7);
      if (error) throw error;
      return data.reverse().map(d => ({
        date: format(new Date(d.transaction_date!), 'dd/MM'),
        receita: (d.receita_cents || 0) / 100,
        despesa: (d.despesa_cents || 0) / 100,
      }));
    },
  });

  const COLORS = ['#E11D48', '#F97316', '#FBBF24', '#22C55E', '#3B82F6'];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">DASHBOARD OWNER</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo, {staff?.nome} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Receita Hoje
              </CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{(todayRevenue || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                €{(monthRevenue || 0).toFixed(2)} este mês
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Membros Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground">
                +{newMembersThisMonth || 0} novos este mês
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Check-ins Hoje
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayCheckins || 0}</div>
              <p className="text-xs text-muted-foreground">
                Entradas registradas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Rentals Hoje
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayRentals || 0}</div>
              <p className="text-xs text-muted-foreground">
                Sessões agendadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Receita x Despesa (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyRevenue || []}>
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                    <YAxis stroke="#888888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }} 
                    />
                    <Bar dataKey="receita" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Receita por Plano (Mês)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {revenueByPlan && revenueByPlan.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByPlan}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: €${value.toFixed(0)}`}
                      >
                        {revenueByPlan.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sem dados disponíveis
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Membros em Atraso
              </CardTitle>
              <CardDescription>Pagamentos vencidos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {overdueMembers && overdueMembers.length > 0 ? (
                  <div className="space-y-3">
                    {overdueMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{member.nome}</p>
                          <p className="text-xs text-muted-foreground">{member.telefone}</p>
                        </div>
                        <Badge variant="destructive">
                          {member.dias_atraso} dias
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum membro em atraso
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pagamentos Pendentes
              </CardTitle>
              <CardDescription>Aguardando confirmação</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {pendingPayments && pendingPayments.length > 0 ? (
                  <div className="space-y-3">
                    {pendingPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{(payment.members as any)?.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.payment_method} • {payment.reference}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-accent">
                          €{(payment.amount_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum pagamento pendente
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OwnerDashboard;
