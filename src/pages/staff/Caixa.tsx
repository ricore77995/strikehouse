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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Wallet, 
  Lock, 
  Unlock, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface CashSession {
  id: string;
  session_date: string;
  opening_balance_cents: number;
  expected_closing_cents: number | null;
  actual_closing_cents: number | null;
  difference_cents: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  closed_by: string | null;
}

const Caixa = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's cash session
  const { data: currentSession, isLoading } = useQuery({
    queryKey: ['cash-session', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('session_date', today)
        .maybeSingle();

      if (error) throw error;
      return data as CashSession | null;
    },
  });

  // Fetch today's cash transactions
  const { data: todayTransactions } = useQuery({
    queryKey: ['cash-transactions', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount_cents, type, payment_method')
        .eq('transaction_date', today)
        .eq('payment_method', 'DINHEIRO');

      if (error) throw error;
      
      const receitas = data.filter(t => t.type === 'RECEITA').reduce((sum, t) => sum + t.amount_cents, 0);
      const despesas = data.filter(t => t.type === 'DESPESA').reduce((sum, t) => sum + t.amount_cents, 0);
      
      return { receitas, despesas, count: data.length };
    },
    enabled: !!currentSession && currentSession.status === 'OPEN',
  });

  // Open cash mutation
  const openMutation = useMutation({
    mutationFn: async (openingCents: number) => {
      const { error } = await supabase.from('cash_sessions').insert({
        session_date: today,
        opening_balance_cents: openingCents,
        expected_closing_cents: openingCents,
        opened_by: staffId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
      toast({ title: 'Caixa aberto com sucesso' });
      setIsOpenDialogOpen(false);
      setOpeningAmount('');
    },
    onError: () => {
      toast({ title: 'Erro ao abrir caixa', variant: 'destructive' });
    },
  });

  // Close cash mutation
  const closeMutation = useMutation({
    mutationFn: async (actualCents: number) => {
      if (!currentSession) throw new Error('No session');

      const expectedCents = currentSession.opening_balance_cents + 
        (todayTransactions?.receitas || 0) - 
        (todayTransactions?.despesas || 0);
      
      const difference = actualCents - expectedCents;

      const { error } = await supabase
        .from('cash_sessions')
        .update({
          actual_closing_cents: actualCents,
          expected_closing_cents: expectedCents,
          difference_cents: difference,
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          closed_by: staffId,
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      return { difference, expectedCents, actualCents };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
      
      const diffText = result.difference === 0 
        ? 'Caixa fechado corretamente!'
        : result.difference > 0 
          ? `Sobra de ${formatPrice(result.difference)}`
          : `Falta de ${formatPrice(Math.abs(result.difference))}`;
      
      toast({ 
        title: 'Caixa fechado',
        description: diffText,
        variant: result.difference === 0 ? 'default' : 'destructive',
      });
      
      setIsCloseDialogOpen(false);
      setShowCloseConfirm(false);
      setClosingAmount('');
    },
    onError: () => {
      toast({ title: 'Erro ao fechar caixa', variant: 'destructive' });
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const parseCurrency = (value: string): number => {
    return Math.round(parseFloat(value.replace(',', '.')) * 100) || 0;
  };

  const handleOpenCash = () => {
    const cents = parseCurrency(openingAmount);
    if (cents < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    openMutation.mutate(cents);
  };

  const handleCloseCash = () => {
    const cents = parseCurrency(closingAmount);
    if (cents < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    setShowCloseConfirm(true);
  };

  const confirmCloseCash = () => {
    const cents = parseCurrency(closingAmount);
    closeMutation.mutate(cents);
  };

  const expectedClosing = currentSession 
    ? currentSession.opening_balance_cents + (todayTransactions?.receitas || 0) - (todayTransactions?.despesas || 0)
    : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">CAIXA</h1>
            <p className="text-muted-foreground text-sm">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
            </p>
          </div>
          <Badge 
            variant={currentSession?.status === 'OPEN' ? 'default' : 'secondary'}
            className="text-sm px-3 py-1"
          >
            {currentSession?.status === 'OPEN' ? (
              <><Unlock className="h-4 w-4 mr-1" /> Aberto</>
            ) : currentSession?.status === 'CLOSED' ? (
              <><Lock className="h-4 w-4 mr-1" /> Fechado</>
            ) : (
              <>Não aberto</>
            )}
          </Badge>
        </div>

        {!currentSession ? (
          // No session - show open button
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-medium mb-2">Caixa não aberto</h2>
              <p className="text-muted-foreground mb-6">
                Abra o caixa para registrar movimentações em dinheiro
              </p>
              <Button 
                size="lg"
                className="bg-accent hover:bg-accent/90"
                onClick={() => setIsOpenDialogOpen(true)}
              >
                <Unlock className="h-5 w-5 mr-2" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        ) : currentSession.status === 'OPEN' ? (
          // Open session - show summary and close button
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Wallet className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Abertura</p>
                      <p className="text-xl font-bold">{formatPrice(currentSession.opening_balance_cents)}</p>
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Entradas</p>
                      <p className="text-xl font-bold text-green-500">
                        +{formatPrice(todayTransactions?.receitas || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Saídas</p>
                      <p className="text-xl font-bold text-destructive">
                        -{formatPrice(todayTransactions?.despesas || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-accent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <DollarSign className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Esperado</p>
                      <p className="text-xl font-bold text-accent">{formatPrice(expectedClosing)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Close Button */}
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Aberto às {format(new Date(currentSession.opened_at), 'HH:mm')}
                </p>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => setIsCloseDialogOpen(true)}
                >
                  <Lock className="h-5 w-5 mr-2" />
                  Fechar Caixa
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          // Closed session - show summary
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base">Resumo do Dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Abertura</p>
                  <p className="text-lg font-bold">{formatPrice(currentSession.opening_balance_cents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Esperado</p>
                  <p className="text-lg font-bold">{formatPrice(currentSession.expected_closing_cents || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Contado</p>
                  <p className="text-lg font-bold">{formatPrice(currentSession.actual_closing_cents || 0)}</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${
                currentSession.difference_cents === 0 
                  ? 'bg-green-500/10'
                  : 'bg-destructive/10'
              }`}>
                <div className="flex items-center gap-2">
                  {currentSession.difference_cents === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  <span className="font-medium">
                    Diferença: {formatPrice(currentSession.difference_cents || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Open Dialog */}
        <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Abrir Caixa</DialogTitle>
              <DialogDescription>
                Informe o valor em dinheiro no caixa
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor de Abertura (€)</Label>
                <Input
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="bg-secondary border-border text-lg"
                  placeholder="0,00"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsOpenDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={handleOpenCash}
                  disabled={openMutation.isPending}
                >
                  {openMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Abrir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Close Dialog */}
        <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Fechar Caixa</DialogTitle>
              <DialogDescription>
                Conte o dinheiro e informe o valor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Valor esperado</p>
                <p className="text-2xl font-bold text-accent">{formatPrice(expectedClosing)}</p>
              </div>

              <div className="space-y-2">
                <Label>Valor Contado (€)</Label>
                <Input
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  className="bg-secondary border-border text-lg"
                  placeholder="0,00"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCloseDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCloseCash}
                  disabled={closeMutation.isPending}
                >
                  Fechar Caixa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Close Confirmation */}
        <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a fechar o caixa com {formatPrice(parseCurrency(closingAmount))}.
                {parseCurrency(closingAmount) !== expectedClosing && (
                  <span className="block mt-2 text-destructive">
                    Diferença de {formatPrice(parseCurrency(closingAmount) - expectedClosing)}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCloseCash}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Caixa;
