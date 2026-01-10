import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Clock, 
  CalendarDays, 
  Phone, 
  DollarSign,
  Users,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Member {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
  credits_remaining: number | null;
}

interface OverdueMember extends Member {
  dias_atraso: number;
}

interface ExpiringMember extends Member {
  dias_restantes: number;
}

const Billing = () => {
  // Fetch overdue members (already expired)
  const { data: overdueMembers, isLoading: loadingOverdue } = useQuery({
    queryKey: ['overdue-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_overdue_members')
        .select('*')
        .order('dias_atraso', { ascending: false });

      if (error) throw error;
      return data as OverdueMember[];
    },
  });

  // Fetch members expiring today
  const { data: expiringToday, isLoading: loadingToday } = useQuery({
    queryKey: ['expiring-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'ATIVO')
        .gte('access_expires_at', `${today}T00:00:00`)
        .lte('access_expires_at', `${today}T23:59:59`);

      if (error) throw error;
      return data as Member[];
    },
  });

  // Fetch members expiring in next 7 days
  const { data: expiringSoon, isLoading: loadingSoon } = useQuery({
    queryKey: ['expiring-soon'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_expiring_members')
        .select('*')
        .order('dias_restantes', { ascending: true });

      if (error) throw error;
      return data as ExpiringMember[];
    },
  });

  // Fetch monthly summary
  const { data: monthlySummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['monthly-summary'],
    queryFn: async () => {
      const now = new Date();
      const start = startOfMonth(now).toISOString().split('T')[0];
      const end = endOfMonth(now).toISOString().split('T')[0];

      // Get transactions this month
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount_cents, type, category')
        .gte('transaction_date', start)
        .lte('transaction_date', end);

      if (txError) throw txError;

      const receitas = transactions
        ?.filter(t => t.type === 'RECEITA' && t.category === 'MENSALIDADE')
        .reduce((sum, t) => sum + t.amount_cents, 0) || 0;

      // Get active members count
      const { count: activeCount } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ATIVO');

      // Estimate expected (active members * average plan price)
      const { data: plans } = await supabase
        .from('plans')
        .select('preco_cents')
        .eq('ativo', true)
        .eq('tipo', 'SUBSCRIPTION');

      const avgPrice = plans && plans.length > 0
        ? plans.reduce((sum, p) => sum + p.preco_cents, 0) / plans.length
        : 5000; // Default 50€

      const esperado = (activeCount || 0) * avgPrice;

      return {
        recebido: receitas,
        esperado: Math.round(esperado),
        activeMembers: activeCount || 0,
        percentage: esperado > 0 ? Math.round((receitas / esperado) * 100) : 0,
      };
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendReminder = (member: Member | OverdueMember | ExpiringMember, type: 'overdue' | 'expiring' | 'today') => {
    let message = '';
    const firstName = member.nome.split(' ')[0];

    switch (type) {
      case 'overdue':
        message = `Olá ${firstName}! 👋\n\nNotamos que seu plano na Striker's House expirou. Para continuar treinando conosco, por favor regularize sua situação.\n\nDúvidas? Responda esta mensagem!`;
        break;
      case 'today':
        message = `Olá ${firstName}! 👋\n\nSeu plano na Striker's House vence hoje. Para continuar treinando sem interrupção, renove agora mesmo!\n\nDúvidas? Estamos aqui para ajudar!`;
        break;
      case 'expiring':
        message = `Olá ${firstName}! 👋\n\nSeu plano na Striker's House está chegando ao fim. Renove com antecedência e garanta seu acesso!\n\nQualquer dúvida, é só chamar!`;
        break;
    }

    openWhatsApp(member.telefone, message);
  };

  const isLoading = loadingOverdue || loadingToday || loadingSoon || loadingSummary;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">COBRANÇAS</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe renovações e envie lembretes
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overdueMembers?.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Atrasados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{expiringToday?.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencem Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CalendarDays className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{expiringSoon?.length || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Próx. 7 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monthlySummary?.percentage || 0}%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Recebido</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resumo do Mês
            </CardTitle>
            <CardDescription>
              {format(new Date(), "MMMM 'de' yyyy", { locale: pt })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Recebido</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatPrice(monthlySummary?.recebido || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Esperado (estimado)</p>
                <p className="text-2xl font-bold">
                  {formatPrice(monthlySummary?.esperado || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Membros Ativos</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {monthlySummary?.activeMembers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Lists */}
        <Tabs defaultValue="overdue" className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="overdue" className="data-[state=active]:bg-destructive/20">
              Atrasados ({overdueMembers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-yellow-500/20">
              Hoje ({expiringToday?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="soon" className="data-[state=active]:bg-blue-500/20">
              Próx. 7 dias ({expiringSoon?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : overdueMembers && overdueMembers.length > 0 ? (
                  <div className="space-y-3">
                    {overdueMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{member.nome}</p>
                          <p className="text-sm text-muted-foreground">{member.telefone}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">
                            {member.dias_atraso} dias
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReminder(member, 'overdue')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Lembrete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum membro atrasado 🎉
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="today">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : expiringToday && expiringToday.length > 0 ? (
                  <div className="space-y-3">
                    {expiringToday.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-yellow-500/10 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{member.nome}</p>
                          <p className="text-sm text-muted-foreground">{member.telefone}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-yellow-500/20 text-yellow-500">
                            Vence hoje
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReminder(member, 'today')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Lembrete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum plano vence hoje
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="soon">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : expiringSoon && expiringSoon.length > 0 ? (
                  <div className="space-y-3">
                    {expiringSoon.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{member.nome}</p>
                          <p className="text-sm text-muted-foreground">{member.telefone}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-500/20 text-blue-500">
                            {member.dias_restantes} dias
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReminder(member, 'expiring')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Lembrete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum plano vence nos próximos 7 dias
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Billing;
