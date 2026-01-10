import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, 
  ShoppingCart, Calendar, Users, ArrowUpRight, ArrowDownRight,
  Wallet, PiggyBank
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, Legend
} from 'recharts';

const Finances = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  const monthDate = parseISO(`${selectedMonth}-01`);
  const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(monthDate, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(monthDate, 1)), 'yyyy-MM-dd');

  // Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  // Current month transactions
  const { data: monthTransactions } = useQuery({
    queryKey: ['finance-transactions', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Previous month for comparison
  const { data: prevMonthTransactions } = useQuery({
    queryKey: ['finance-prev-transactions', prevMonthStart, prevMonthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount_cents, type')
        .gte('transaction_date', prevMonthStart)
        .lte('transaction_date', prevMonthEnd);
      if (error) throw error;
      return data;
    },
  });

  // Daily summary for the month
  const { data: dailySummary } = useQuery({
    queryKey: ['finance-daily-summary', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_daily_summary')
        .select('*')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Calculate totals
  const receita = monthTransactions?.filter(t => t.type === 'RECEITA').reduce((sum, t) => sum + t.amount_cents, 0) || 0;
  const despesa = monthTransactions?.filter(t => t.type === 'DESPESA').reduce((sum, t) => sum + t.amount_cents, 0) || 0;
  const resultado = receita - despesa;

  const prevReceita = prevMonthTransactions?.filter(t => t.type === 'RECEITA').reduce((sum, t) => sum + t.amount_cents, 0) || 0;
  const prevDespesa = prevMonthTransactions?.filter(t => t.type === 'DESPESA').reduce((sum, t) => sum + t.amount_cents, 0) || 0;

  const receitaChange = prevReceita > 0 ? ((receita - prevReceita) / prevReceita * 100) : 0;
  const despesaChange = prevDespesa > 0 ? ((despesa - prevDespesa) / prevDespesa * 100) : 0;

  // Revenue by category
  const revenueByCategory = monthTransactions?.filter(t => t.type === 'RECEITA').reduce((acc, t) => {
    const cat = t.category || 'OUTROS';
    acc[cat] = (acc[cat] || 0) + t.amount_cents;
    return acc;
  }, {} as Record<string, number>) || {};

  const expenseByCategory = monthTransactions?.filter(t => t.type === 'DESPESA').reduce((acc, t) => {
    const cat = t.category || 'OUTROS';
    acc[cat] = (acc[cat] || 0) + t.amount_cents;
    return acc;
  }, {} as Record<string, number>) || {};

  // Revenue by payment method
  const revenueByMethod = monthTransactions?.filter(t => t.type === 'RECEITA').reduce((acc, t) => {
    const method = t.payment_method || 'OUTROS';
    acc[method] = (acc[method] || 0) + t.amount_cents;
    return acc;
  }, {} as Record<string, number>) || {};

  // Chart data
  const dailyChartData = dailySummary?.map(d => ({
    date: format(new Date(d.transaction_date!), 'dd'),
    receita: (d.receita_cents || 0) / 100,
    despesa: (d.despesa_cents || 0) / 100,
    resultado: ((d.receita_cents || 0) - (d.despesa_cents || 0)) / 100,
  })) || [];

  const categoryChartData = Object.entries(revenueByCategory).map(([name, value]) => ({
    name: getCategoryLabel(name),
    value: value / 100,
  }));

  const methodChartData = Object.entries(revenueByMethod).map(([name, value]) => ({
    name: getMethodLabel(name),
    value: value / 100,
  }));

  const COLORS = ['#E11D48', '#F97316', '#FBBF24', '#22C55E', '#3B82F6', '#8B5CF6'];

  function getCategoryLabel(code: string) {
    const labels: Record<string, string> = {
      'MENSALIDADE': 'Mensalidades',
      'VENDA_PRODUTO': 'Vendas',
      'RENTAL': 'Rentals',
      'ENTRADA_AVULSA': 'Entradas Avulsas',
      'OUTROS': 'Outros',
      'SALARIO': 'Salários',
      'ALUGUEL': 'Aluguel',
      'UTILIDADES': 'Utilidades',
      'EQUIPAMENTO': 'Equipamentos',
      'MARKETING': 'Marketing',
    };
    return labels[code] || code;
  }

  function getMethodLabel(code: string) {
    const labels: Record<string, string> = {
      'DINHEIRO': 'Dinheiro',
      'CARTAO': 'Cartão',
      'MBWAY': 'MBWay',
      'TRANSFERENCIA': 'Transferência',
    };
    return labels[code] || code;
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">Financeiro</h1>
              <p className="text-muted-foreground text-sm">Análise completa de receitas e despesas</p>
            </div>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Receita Total
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                €{(receita / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {receitaChange >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                {receitaChange >= 0 ? '+' : ''}{receitaChange.toFixed(1)}% vs mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Despesa Total
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                €{(despesa / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {despesaChange <= 0 ? (
                  <ArrowDownRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-red-500" />
                )}
                {despesaChange >= 0 ? '+' : ''}{despesaChange.toFixed(1)}% vs mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Resultado
              </CardTitle>
              <PiggyBank className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${resultado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                €{(resultado / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Lucro {resultado >= 0 ? 'líquido' : 'negativo'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">
                Transações
              </CardTitle>
              <Wallet className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monthTransactions?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Movimentações no mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="evolucao" className="space-y-4">
          <TabsList>
            <TabsTrigger value="evolucao">Evolução Diária</TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
            <TabsTrigger value="metodos">Por Método</TabsTrigger>
          </TabsList>

          <TabsContent value="evolucao">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm">
                  Evolução Diária - {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData}>
                      <defs>
                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                      <YAxis stroke="#888888" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                        formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="receita" name="Receita" stroke="#22C55E" fillOpacity={1} fill="url(#colorReceita)" />
                      <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#EF4444" fillOpacity={1} fill="url(#colorDespesa)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categorias">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Receitas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {categoryChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {categoryChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, '']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Sem dados
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {Object.keys(expenseByCategory).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(expenseByCategory).map(([name, value]) => ({
                          name: getCategoryLabel(name),
                          value: value / 100,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="#888888" fontSize={10} />
                          <YAxis stroke="#888888" fontSize={12} />
                          <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, '']} />
                          <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Sem dados
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="metodos">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm">
                  Receitas por Método de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="h-64">
                    {methodChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={methodChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {methodChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Sem dados
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {methodChartData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold">€{item.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm">
              Últimas Transações
            </CardTitle>
            <CardDescription>
              Movimentações recentes do mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              {monthTransactions && monthTransactions.length > 0 ? (
                <div className="space-y-2">
                  {[...monthTransactions].reverse().slice(0, 20).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          t.type === 'RECEITA' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {t.type === 'RECEITA' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {t.description || getCategoryLabel(t.category)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.transaction_date), 'dd/MM')} • {getMethodLabel(t.payment_method)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        t.type === 'RECEITA' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {t.type === 'RECEITA' ? '+' : '-'}€{(t.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transação neste mês
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Finances;
