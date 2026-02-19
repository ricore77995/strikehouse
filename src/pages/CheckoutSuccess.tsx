import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle, Home, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [memberQrCode, setMemberQrCode] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // The webhook handles the actual processing
    // This page just shows confirmation
    if (sessionId) {
      // Give webhook time to process (it's async)
      const timer = setTimeout(async () => {
        setStatus('success');

        // Try to get the member QR code
        const pendingMemberId = localStorage.getItem('pending_member_id');
        if (pendingMemberId) {
          try {
            const { data: member } = await supabase
              .from('members')
              .select('qr_code')
              .eq('id', pendingMemberId)
              .single();

            if (member?.qr_code) {
              setMemberQrCode(member.qr_code);
            }

            // Clear the pending member ID
            localStorage.removeItem('pending_member_id');
          } catch (err) {
            console.error('Error fetching member QR:', err);
          }
        }
      }, 2500); // Wait a bit longer for webhook to complete
      return () => clearTimeout(timer);
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 mx-auto text-accent animate-spin" />
              <CardTitle className="mt-4">A processar pagamento...</CardTitle>
              <CardDescription>
                Aguarde enquanto confirmamos o seu pagamento.
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <CardTitle className="mt-4 text-green-600">Pagamento Confirmado!</CardTitle>
              <CardDescription>
                O seu pagamento foi processado com sucesso.
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
              <CardTitle className="mt-4 text-red-600">Erro</CardTitle>
              <CardDescription>
                Não foi possível verificar o pagamento.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">O que acontece agora?</p>
              <ul className="mt-2 space-y-1 text-green-600 dark:text-green-500">
                <li>• A sua subscrição foi activada</li>
                <li>• Pode fazer check-in com o QR code</li>
                <li>• Receberá confirmação por email</li>
              </ul>
            </div>
          )}

          {sessionId && (
            <p className="text-xs text-muted-foreground text-center break-all">
              Ref: {sessionId.slice(0, 20)}...
            </p>
          )}

          <div className="flex flex-col gap-2 pt-4">
            {memberQrCode && (
              <Button
                className="w-full"
                asChild
              >
                <Link to={`/m/${memberQrCode}`}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Ver Meu QR Code
                </Link>
              </Button>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Início
              </Button>
              {!memberQrCode && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/membership')}
                >
                  Voltar
                </Button>
              )}
            </div>
          </div>

          {status === 'success' && !memberQrCode && (
            <p className="text-xs text-muted-foreground text-center">
              O seu QR code estará disponível na recepção do ginásio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
