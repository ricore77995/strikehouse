import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Link as LinkIcon,
  Cloud,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface StripePaymentLink {
  id: string;
  frequencia: string;
  compromisso: string;
  tags: string[] | null;
  includes_enrollment_fee: boolean; // Deprecated, use tags
  is_family_friends: boolean; // Deprecated, use tags
  payment_link_id: string;
  payment_link_url: string;
  price_id: string;
  amount_cents: number;
  display_name: string;
  ativo: boolean;
  created_at: string;
}

// Helper to get tags (backwards compat with boolean fields)
const getLinkTags = (link: StripePaymentLink): string[] => {
  if (link.tags && link.tags.length > 0) {
    return link.tags;
  }
  // Fallback to boolean fields
  const tags: string[] = [];
  if (link.includes_enrollment_fee) tags.push('matricula');
  if (link.is_family_friends) tags.push('family_friends');
  return tags;
};

// Tag display config
const tagConfig: Record<string, { label: string; color: string }> = {
  matricula: { label: 'Matrícula', color: 'bg-green-100 text-green-800' },
  family_friends: { label: 'F&F', color: 'bg-purple-100 text-purple-800' },
  promocao: { label: 'Promo', color: 'bg-orange-100 text-orange-800' },
  staff: { label: 'Staff', color: 'bg-blue-100 text-blue-800' },
  trial: { label: 'Trial', color: 'bg-pink-100 text-pink-800' },
};

const StripeLinks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch all payment links
  const { data: links, isLoading, refetch } = useQuery({
    queryKey: ['stripe-payment-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payment_links')
        .select('*')
        .order('amount_cents', { ascending: true });

      if (error) throw error;
      return data as StripePaymentLink[];
    },
  });

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      console.log(`[StripeLinks] Toggling link ${id} to ativo=${ativo}`);
      const { data, error } = await supabase
        .from('stripe_payment_links')
        .update({ ativo })
        .eq('id', id)
        .select();

      if (error) {
        console.error('[StripeLinks] Update error:', error);
        throw error;
      }
      console.log('[StripeLinks] Update success:', data);
      return data;
    },
    onMutate: ({ id }) => {
      setTogglingId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-payment-links'] });
      toast({
        title: 'Link actualizado',
        description: 'Estado do link alterado com sucesso.',
      });
    },
    onError: (error: Error) => {
      console.error('[StripeLinks] Mutation error:', error);
      toast({
        title: 'Erro ao actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  // Sync with Stripe API
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-payment-links');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Sincronizado com Stripe',
          description: data.message || 'Payment Links actualizados.',
        });
        await refetch();
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Erro ao sincronizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: 'Dados actualizados',
      description: 'Lista de links recarregada.',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const getFrequenciaBadge = (freq: string) => {
    const colors: Record<string, string> = {
      '1x': 'bg-blue-100 text-blue-800',
      '2x': 'bg-green-100 text-green-800',
      '3x': 'bg-purple-100 text-purple-800',
      'unlimited': 'bg-amber-100 text-amber-800',
    };
    const labels: Record<string, string> = {
      '1x': '1x/sem',
      '2x': '2x/sem',
      '3x': '3x/sem',
      'unlimited': 'Ilimitado',
    };
    return (
      <Badge className={colors[freq] || 'bg-gray-100 text-gray-800'}>
        {labels[freq] || freq}
      </Badge>
    );
  };

  const getCompromissoBadge = (comp: string) => {
    const labels: Record<string, string> = {
      'mensal': 'Mensal',
      'trimestral': 'Trimestral',
      'semestral': 'Semestral',
      'anual': 'Anual',
    };
    return (
      <Badge variant="outline">
        {labels[comp] || comp}
      </Badge>
    );
  };

  // Count links by tag (using the helper function)
  const linksWithMatricula = links?.filter(l => getLinkTags(l).includes('matricula')).length || 0;
  const linksWithFF = links?.filter(l => getLinkTags(l).includes('family_friends')).length || 0;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8" />
              Payment Links
            </h1>
            <p className="text-muted-foreground">
              Links de pagamento do Stripe configurados para matrícula
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/admin/stripe-links/new')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Link
            </Button>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-4 w-4" />
              )}
              Sincronizar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={syncing}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            Clique em <strong>"Criar Link"</strong> para adicionar novos Payment Links, ou{' '}
            <strong>"Sincronizar"</strong> para importar links criados no{' '}
            <a
              href="https://dashboard.stripe.com/payment-links"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-600"
            >
              Stripe Dashboard
            </a>.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <Card>
            <CardContent className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{links?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Links</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {links?.filter(l => l.ativo).length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Links Activos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {linksWithMatricula}
                  </div>
                  <p className="text-sm text-muted-foreground">Com Matrícula</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {linksWithFF}
                  </div>
                  <p className="text-sm text-muted-foreground">Family & Friends</p>
                </CardContent>
              </Card>
            </div>

            {/* All Payment Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Todos os Payment Links
                </CardTitle>
                <CardDescription>
                  Links de pagamento configurados com tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Compromisso</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-center">Activo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links?.map((link) => {
                      const linkTags = getLinkTags(link);
                      return (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">
                            {link.display_name}
                          </TableCell>
                          <TableCell>{getFrequenciaBadge(link.frequencia)}</TableCell>
                          <TableCell>{getCompromissoBadge(link.compromisso)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {linkTags.length > 0 ? (
                                linkTags.map((tag) => {
                                  const config = tagConfig[tag] || {
                                    label: tag,
                                    color: 'bg-gray-100 text-gray-800',
                                  };
                                  return (
                                    <Badge
                                      key={tag}
                                      className={`text-xs ${config.color}`}
                                    >
                                      {config.label}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(link.amount_cents)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(link.payment_link_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Abrir
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {togglingId === link.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              <Switch
                                checked={link.ativo}
                                disabled={togglingId !== null}
                                onCheckedChange={(checked) =>
                                  toggleMutation.mutate({ id: link.id, ativo: checked })
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StripeLinks;
