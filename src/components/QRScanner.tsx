import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

const QRScanner = ({ onScan, onClose }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {
            // Ignore scan failures
          }
        );
        setIsScanning(true);
        setError(null);
      } catch (err) {
        console.error('Scanner error:', err);
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current && isScanning) {
        try {
          await scannerRef.current.stop();
          scannerRef.current = null;
          setIsScanning(false);
        } catch (err) {
          console.error('Error stopping scanner:', err);
        }
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan]);

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    onClose();
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleClose}
          className="rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error ? (
        <div className="aspect-square bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border p-6">
          <div className="text-center">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div
            id="qr-reader"
            ref={containerRef}
            className="aspect-square bg-secondary rounded-lg overflow-hidden"
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-accent rounded-lg" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Posicione o QR code dentro do quadrado
          </p>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
