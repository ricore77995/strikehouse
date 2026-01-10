import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, Eye, QrCode, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Member {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  qr_code: string;
  status: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  access_type: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS' | null;
  access_expires_at: string | null;
  credits_remaining: number;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ATIVO': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'LEAD': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'BLOQUEADO': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'CANCELADO': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'ATIVO': return 'Ativo';
    case 'LEAD': return 'Lead';
    case 'BLOQUEADO': return 'Bloqueado';
    case 'CANCELADO': return 'Cancelado';
    default: return status;
  }
};

const Members = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Member[];
    },
  });

  const filteredMembers = members?.filter((member) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      member.nome.toLowerCase().includes(searchLower) ||
      member.telefone.includes(search) ||
      member.email?.toLowerCase().includes(searchLower) ||
      member.qr_code.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: members?.length || 0,
    ativos: members?.filter((m) => m.status === 'ATIVO').length || 0,
    leads: members?.filter((m) => m.status === 'LEAD').length || 0,
    bloqueados: members?.filter((m) => m.status === 'BLOQUEADO').length || 0,
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">MEMBROS</h1>
            <p className="text-muted-foreground text-sm">
              Gerenciar membros da academia
            </p>
          </div>
          <Button asChild className="bg-accent hover:bg-accent/90 uppercase tracking-wider text-xs">
            <Link to="/admin/members/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Membro
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold text-green-400">{stats.ativos}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Leads</p>
              <p className="text-2xl font-bold text-blue-400">{stats.leads}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bloqueados</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.bloqueados}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone, email ou QR code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-secondary border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ATIVO">Ativos</SelectItem>
                  <SelectItem value="LEAD">Leads</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueados</SelectItem>
                  <SelectItem value="CANCELADO">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers && filteredMembers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider">Nome</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Contato</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">QR Code</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Expira em</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} className="border-border">
                        <TableCell className="font-medium">{member.nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {member.telefone}
                            </span>
                            {member.email && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-secondary px-2 py-1 rounded">
                            {member.qr_code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(member.status)}>
                            {getStatusLabel(member.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.access_expires_at ? (
                            <span className="text-sm">
                              {format(new Date(member.access_expires_at), 'dd/MM/yyyy', { locale: pt })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Ver QR Code"
                            >
                              <Link to={`/m/${member.qr_code}`} target="_blank">
                                <QrCode className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Ver detalhes"
                            >
                              <Link to={`/admin/members/${member.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {search ? 'Nenhum membro encontrado' : 'Nenhum membro cadastrado'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Members;
