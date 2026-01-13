import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskAuth } from '@/hooks/useKioskAuth';
import { Button } from '@/components/ui/button';
import { Loader2, Delete, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const KioskPin = () => {
  const [pin, setPin] = useState('');
  const { isAuthenticated, isValidating, validatePin } = useKioskAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/kiosk/scan', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      toast({
        title: 'PIN inválido',
        description: 'O PIN deve ter 6 dígitos',
        variant: 'destructive',
      });
      return;
    }

    const isValid = await validatePin(pin);

    if (!isValid) {
      toast({
        title: 'PIN incorreto',
        description: 'Tente novamente',
        variant: 'destructive',
      });
      setPin('');
    }
    // If valid, the useEffect will redirect
  };

  // Auto-submit when PIN has 6 digits
  useEffect(() => {
    if (pin.length === 6) {
      // Small delay to show the digit
      const timeout = setTimeout(() => {
        handleSubmit();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [pin]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="h-16 w-16 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
          <QrCode className="h-8 w-8 text-accent-foreground" />
        </div>
        <h1 className="text-2xl uppercase tracking-widest font-light">Check-in</h1>
        <p className="text-muted-foreground text-sm mt-2">Digite o PIN para acessar</p>
      </div>

      {/* PIN Display */}
      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-mono ${
              pin[i] ? 'border-accent bg-accent/10' : 'border-border'
            }`}
          >
            {pin[i] ? '•' : ''}
          </div>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
        {digits.map((digit, i) => {
          if (digit === '') {
            return <div key={i} />;
          }

          if (digit === 'del') {
            return (
              <Button
                key={i}
                variant="outline"
                className="h-16 text-xl"
                onClick={handleDelete}
                disabled={isValidating || pin.length === 0}
              >
                <Delete className="h-6 w-6" />
              </Button>
            );
          }

          return (
            <Button
              key={i}
              variant="outline"
              className="h-16 text-2xl font-light"
              onClick={() => handleDigit(digit)}
              disabled={isValidating || pin.length >= 6}
            >
              {digit}
            </Button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {isValidating && (
        <div className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Verificando...</span>
        </div>
      )}

      {/* Clear button */}
      {pin.length > 0 && !isValidating && (
        <Button
          variant="ghost"
          className="mt-6 text-muted-foreground"
          onClick={handleClear}
        >
          Limpar
        </Button>
      )}
    </div>
  );
};

export default KioskPin;
