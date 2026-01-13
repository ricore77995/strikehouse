import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskAuth } from '@/hooks/useKioskAuth';
import { useCheckin, type CheckinResult } from '@/hooks/useCheckin';
import QRScanner from '@/components/QRScanner';
import KioskResultCard from '@/components/KioskResultCard';
import { Button } from '@/components/ui/button';
import { QrCode, LogOut } from 'lucide-react';

const KioskCheckin = () => {
  const { isAuthenticated, logout } = useKioskAuth();
  const { processQRCode } = useCheckin();
  const navigate = useNavigate();

  const [scanMode, setScanMode] = useState(true);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/kiosk', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle QR scan
  const handleQRScan = async (code: string) => {
    const result = await processQRCode(code, null);
    setCheckinResult(result);
  };

  // Handle result dismissal - restart scanner
  const handleDismiss = () => {
    setCheckinResult(null);
    setScanMode(true);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/kiosk', { replace: true });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
            <QrCode className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-lg uppercase tracking-widest font-light">Check-in</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {scanMode ? (
          <div className="w-full max-w-md">
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setScanMode(false)}
            />
            <p className="text-center text-xl text-foreground mt-6">
              Escaneie seu QR Code
            </p>
          </div>
        ) : (
          <div className="text-center">
            <QrCode className="h-24 w-24 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Scanner desativado</p>
            <Button onClick={() => setScanMode(true)} variant="outline">
              Ativar Scanner
            </Button>
          </div>
        )}
      </div>

      {/* Result overlay */}
      {checkinResult && (
        <KioskResultCard
          result={checkinResult}
          onDismiss={handleDismiss}
          autoDismissMs={3000}
          playSound={true}
        />
      )}
    </div>
  );
};

export default KioskCheckin;
