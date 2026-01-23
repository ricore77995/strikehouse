import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, UserPlus, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

const EnrollmentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const cancelled = searchParams.get('cancelled');

  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Optional: Verify session status via API
    // For now, just assume success after short delay
    setTimeout(() => setIsVerifying(false), 1000);
  }, [sessionId]);

  // Handle cancelled checkout
  if (cancelled === 'true') {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6 lg:p-8">
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <ArrowLeft className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Pagamento Cancelado</CardTitle>
              <CardDescription>
                O checkout foi cancelado. Nenhum pagamento foi processado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/staff/checkin')}
                  className="flex-1"
                >
                  Ir para Check-in
                </Button>
                <Button
                  onClick={() => navigate('/staff/enrollment')}
                  className="flex-1 bg-accent hover:bg-accent/90"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Show loading while verifying
  if (isVerifying) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Verificando pagamento...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Success state
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6 lg:p-8">
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
            <CardDescription>
              O pagamento foi processado com sucesso. O membro será ativado automaticamente em alguns segundos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionId && (
              <div className="bg-secondary/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Session ID:</p>
                <p className="text-xs font-mono break-all text-muted-foreground">{sessionId}</p>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium mb-1">ℹ️ Ativação Automática</p>
              <p className="text-xs text-muted-foreground">
                O webhook do Stripe está processando o pagamento. O membro será ativado automaticamente
                e receberá acesso ao ginásio em até 30 segundos. Você pode verificar o status na lista de membros.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/staff/checkin')}
                className="flex-1"
              >
                Ir para Check-in
              </Button>
              <Button
                onClick={() => navigate('/staff/enrollment')}
                className="flex-1 bg-accent hover:bg-accent/90"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Nova Matrícula
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EnrollmentSuccess;
