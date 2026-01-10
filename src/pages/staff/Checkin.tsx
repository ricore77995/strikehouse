import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, Search, UserPlus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCheckin, type CheckinResult, type MemberCheckinInfo } from '@/hooks/useCheckin';
import QRScanner from '@/components/QRScanner';
import CheckinResultCard from '@/components/CheckinResultCard';
import QuickMemberModal from '@/components/QuickMemberModal';
import { cn } from '@/lib/utils';

interface RecentCheckin {
  id: string;
  checked_in_at: string;
  result: string;
  member: {
    nome: string;
    telefone: string;
  } | null;
}

const StaffCheckin = () => {
  const { staffId } = useAuth();
  const { isLoading, findMemberBySearch, performCheckin, processQRCode } = useCheckin();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [searchResults, setSearchResults] = useState<MemberCheckinInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [showQuickMember, setShowQuickMember] = useState(false);

  // Load recent check-ins
  useEffect(() => {
    loadRecentCheckins();
  }, []);

  const loadRecentCheckins = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('check_ins')
      .select(`
        id,
        checked_in_at,
        result,
        member:members(nome, telefone)
      `)
      .gte('checked_in_at', today.toISOString())
      .order('checked_in_at', { ascending: false })
      .limit(20);

    if (data) {
      setRecentCheckins(data as unknown as RecentCheckin[]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    const results = await findMemberBySearch(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleMemberSelect = async (member: MemberCheckinInfo) => {
    if (!staffId) return;
    
    const result = await performCheckin(member, staffId);
    setCheckinResult(result);
    setSearchResults([]);
    setSearchQuery('');
    loadRecentCheckins();
  };

  const handleQRScan = async (code: string) => {
    if (!staffId) return;
    
    setScanMode(false);
    const result = await processQRCode(code, staffId);
    setCheckinResult(result);
    loadRecentCheckins();
  };

  const dismissResult = () => {
    setCheckinResult(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">ATIVO</span>;
      case 'BLOQUEADO':
        return <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">BLOQUEADO</span>;
      case 'LEAD':
        return <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">LEAD</span>;
      default:
        return <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{status}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">CHECK-IN</h1>
            <p className="text-muted-foreground text-sm">
              Registrar entrada de membros
            </p>
          </div>
          <Button 
            variant="outline" 
            className="uppercase tracking-wider text-xs"
            onClick={() => setShowQuickMember(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastro Rápido
          </Button>
        </div>

        {/* Result Modal */}
        {checkinResult && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
              <CheckinResultCard result={checkinResult} onDismiss={dismissResult} />
            </div>
          </div>
        )}

        {/* Scanner Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanner QR Code
            </CardTitle>
            <CardDescription>
              Escaneie o QR code do membro ou busque manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanMode ? (
              <QRScanner onScan={handleQRScan} onClose={() => setScanMode(false)} />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className="w-full max-w-md h-24 bg-accent hover:bg-accent/90 text-accent-foreground uppercase tracking-wider"
                  onClick={() => setScanMode(true)}
                  disabled={isLoading}
                >
                  <QrCode className="h-8 w-8 mr-3" />
                  Abrir Scanner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Search */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Search className="h-5 w-5" />
              Busca Manual
            </CardTitle>
            <CardDescription>
              Busque por nome ou telefone do membro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-secondary border-border"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="uppercase tracking-wider text-xs"
              >
                {isSearching ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleMemberSelect(member)}
                    className="w-full p-4 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                    disabled={isLoading}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{member.nome}</p>
                        <p className="text-sm text-muted-foreground">{member.telefone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(member.status || 'LEAD')}
                        {member.access_type === 'CREDITS' && (
                          <span className="text-xs text-muted-foreground">
                            {member.credits_remaining || 0} créditos
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery && !isSearching ? (
              <div className="min-h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum membro encontrado
              </div>
            ) : (
              <div className="min-h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                Digite para buscar membros
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Check-ins */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Check-ins Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckins.length > 0 ? (
              <div className="space-y-2">
                {recentCheckins.map((checkin) => (
                  <div
                    key={checkin.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      checkin.result === 'ALLOWED' ? 'bg-green-500/10' : 'bg-destructive/10'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {checkin.result === 'ALLOWED' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {checkin.member?.nome || 'Membro não encontrado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {checkin.member?.telefone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(checkin.checked_in_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs uppercase tracking-wider">
                        {checkin.result === 'ALLOWED' ? 'OK' : checkin.result}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum check-in registrado hoje
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Member Modal */}
        <QuickMemberModal
          open={showQuickMember}
          onOpenChange={setShowQuickMember}
        />
      </div>
    </DashboardLayout>
  );
};

export default StaffCheckin;
