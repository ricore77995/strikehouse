import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface MemberData {
  nome: string;
  qr_code: string;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
}

const MemberQR = () => {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMember = async () => {
      if (!qrCode) {
        setError('QR Code inválido');
        setLoading(false);
        return;
      }

      try {
        // Import supabase client dynamically to avoid circular dependency
        const { supabase } = await import('@/integrations/supabase/client');

        // Fetch member data directly via Supabase (uses public RLS policy)
        const { data, error: fetchError } = await supabase
          .from('members')
          .select('nome, qr_code, status, access_type, access_expires_at')
          .eq('qr_code', qrCode)
          .single();

        if (fetchError || !data) {
          setError('QR Code não encontrado');
          setLoading(false);
          return;
        }

        setMember(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching member:', err);
        setError('Erro ao conectar com o servidor');
        setLoading(false);
      }
    };

    fetchMember();
  }, [qrCode]);

  // Helper to determine if member has active access
  const hasActiveAccess = () => {
    if (!member) return false;
    if (member.status !== 'ATIVO') return false;
    if (!member.access_type) return false;

    if (member.access_expires_at) {
      const expiresAt = new Date(member.access_expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return expiresAt >= today;
    }

    return true;
  };

  // Helper to get status display info
  const getStatusInfo = () => {
    if (!member) return null;

    const active = hasActiveAccess();

    if (active) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        text: 'Acesso Ativo',
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    } else {
      // LEAD never had access - show neutral waiting state
      if (member.status === 'LEAD') {
        return {
          icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
          text: 'Aguardando Primeiro Pagamento',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50'
        };
      }

      // Other statuses are actual errors (had access but lost it)
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        text: member.status === 'BLOQUEADO' ? 'Acesso Bloqueado' :
              member.status === 'CANCELADO' ? 'Acesso Cancelado' : 'Acesso Expirado',
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-card border-border">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-medium mb-2">QR Code Inválido</h2>
            <p className="text-sm text-muted-foreground">
              {error || 'Este QR code não foi encontrado'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardContent className="pt-6 text-center space-y-6">
          {/* Logo */}
          <div className="mx-auto">
            <div className="h-12 w-12 mx-auto bg-accent rounded-sm flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-xl">BM</span>
            </div>
          </div>

          {/* Member Name */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Membro
            </p>
            <h1 className="text-xl font-semibold tracking-wider uppercase">
              {member.nome}
            </h1>
          </div>

          {/* Status Badge */}
          {statusInfo && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.bgColor}`}>
              {statusInfo.icon}
              <span className={`text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
          )}

          {/* QR Code Display */}
          <div className="bg-white p-6 rounded-lg mx-auto w-fit shadow-sm">
            <QRCodeSVG
              value={member.qr_code}
              size={192}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* QR Code ID */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Código de Identificação
            </p>
            <p className="text-sm font-mono font-medium">
              {member.qr_code}
            </p>
          </div>

          {/* Access Info */}
          {member.access_type && member.access_expires_at && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {member.access_type === 'SUBSCRIPTION' ? 'Mensalidade' :
                 member.access_type === 'CREDITS' ? 'Créditos' : 'Passe Diário'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Válido até: {new Date(member.access_expires_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}

          {/* Instructions */}
          <p className="text-xs text-muted-foreground pt-2">
            Apresente este QR code na recepção para fazer check-in
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberQR;
