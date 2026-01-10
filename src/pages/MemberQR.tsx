import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, QrCode } from 'lucide-react';

interface MemberData {
  nome: string;
  qr_code: string;
  status: string;
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
        // This is a public query - we need to create a function or adjust RLS
        // For now, we'll show the QR code based on the URL parameter
        // In production, this should fetch from a public endpoint or edge function
        
        setMember({
          nome: 'Membro',
          qr_code: qrCode,
          status: 'ATIVO'
        });
        setLoading(false);
      } catch (err) {
        setError('Erro ao carregar dados');
        setLoading(false);
      }
    };

    fetchMember();
  }, [qrCode]);

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
            <h1 className="text-xl tracking-wider uppercase">
              {member.nome}
            </h1>
          </div>

          {/* QR Code Display */}
          <div className="bg-white p-6 rounded-lg mx-auto w-fit">
            {/* In production, generate actual QR code image */}
            <div className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
              <div className="text-center">
                <QrCode className="h-24 w-24 mx-auto text-gray-800" />
                <p className="text-xs text-gray-600 mt-2 font-mono">
                  {member.qr_code}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code ID */}
          <p className="text-sm font-mono text-muted-foreground">
            {member.qr_code}
          </p>

          {/* Instructions */}
          <p className="text-xs text-muted-foreground">
            Apresente este QR code na recepção para fazer check-in
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberQR;
