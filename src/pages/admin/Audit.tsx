import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Shield, User, FileText, CreditCard, DollarSign, Package, Calendar, Users } from 'lucide-react';

const Audit = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          staff:user_id (nome)
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.staff as any)?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesEntity && matchesAction;
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'member': return <Users className="h-4 w-4" />;
      case 'plan': return <CreditCard className="h-4 w-4" />;
      case 'payment': return <DollarSign className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      case 'rental': return <Calendar className="h-4 w-4" />;
      case 'transaction': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Criar</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Atualizar</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Excluir</Badge>;
      case 'CONFIRM':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Confirmar</Badge>;
      case 'CHECKIN':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Check-in</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const entityTypes = ['all', 'member', 'plan', 'payment', 'product', 'rental', 'transaction', 'checkin', 'cash_session', 'sale'];
  const actionTypes = ['all', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CHECKIN'];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">Auditoria</h1>
            <p className="text-muted-foreground text-sm">Histórico de todas as ações do sistema</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, ID ou usuário..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Tipo de entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === 'all' ? 'Todas entidades' : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === 'all' ? 'Todas ações' : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs list */}
        <Card>
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm">Logs de Auditoria</CardTitle>
            <CardDescription>
              {filteredLogs?.length || 0} registros encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredLogs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {getEntityIcon(log.entity_type)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getActionBadge(log.action)}
                              <Badge variant="outline" className="uppercase text-xs">
                                {log.entity_type}
                              </Badge>
                            </div>
                            <p className="text-sm">{log.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {(log.staff as any)?.nome || 'Sistema'}
                              </span>
                              <span>
                                {log.created_at && format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {log.entity_id && (
                                <span className="font-mono text-xs bg-muted px-1 rounded">
                                  {log.entity_id.substring(0, 8)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show old/new values if present */}
                      {(log.old_value || log.new_value) && (
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
                          {log.old_value && (
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground uppercase">Valor anterior</span>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24">
                                {JSON.stringify(log.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground uppercase">Novo valor</span>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24">
                                {JSON.stringify(log.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Audit;
