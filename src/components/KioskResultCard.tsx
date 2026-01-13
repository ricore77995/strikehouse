import { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, CreditCard, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckinResult } from '@/hooks/useCheckin';

interface KioskResultCardProps {
  result: CheckinResult;
  onDismiss: () => void;
  autoDismissMs?: number;
  playSound?: boolean;
}

const KioskResultCard = ({
  result,
  onDismiss,
  autoDismissMs = 3000,
  playSound = true,
}: KioskResultCardProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play feedback sound
  useEffect(() => {
    if (!playSound) return;

    const playBeep = (success: boolean) => {
      try {
        // Create or reuse AudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (success) {
          // Success: Two ascending tones
          oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
        } else {
          // Error: Two descending tones
          oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
          oscillator.frequency.setValueAtTime(349.23, ctx.currentTime + 0.15); // F4
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        }
      } catch (error) {
        // Silently fail if audio is not available
        console.log('Audio not available');
      }
    };

    playBeep(result.success);
  }, [result.success, playSound]);

  // Auto-dismiss after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  const getResultStyle = () => {
    switch (result.result) {
      case 'ALLOWED':
        return {
          icon: CheckCircle,
          bgClass: 'bg-green-500',
          textClass: 'text-white',
          title: 'BEM-VINDO!',
        };
      case 'BLOCKED':
        return {
          icon: XCircle,
          bgClass: 'bg-red-600',
          textClass: 'text-white',
          title: 'ACESSO BLOQUEADO',
        };
      case 'EXPIRED':
        return {
          icon: Clock,
          bgClass: 'bg-yellow-500',
          textClass: 'text-black',
          title: 'ACESSO EXPIRADO',
        };
      case 'NO_CREDITS':
        return {
          icon: CreditCard,
          bgClass: 'bg-orange-500',
          textClass: 'text-white',
          title: 'SEM CRÉDITOS',
        };
      case 'AREA_EXCLUSIVE':
        return {
          icon: Lock,
          bgClass: 'bg-purple-600',
          textClass: 'text-white',
          title: 'ÁREA EXCLUSIVA',
        };
      default:
        return {
          icon: AlertTriangle,
          bgClass: 'bg-gray-600',
          textClass: 'text-white',
          title: 'NÃO ENCONTRADO',
        };
    }
  };

  const style = getResultStyle();
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-200',
        style.bgClass
      )}
      onClick={onDismiss}
    >
      {/* Icon */}
      <Icon className={cn('h-32 w-32 mb-6', style.textClass)} strokeWidth={1.5} />

      {/* Title */}
      <h1 className={cn('text-4xl md:text-5xl font-light tracking-widest mb-4', style.textClass)}>
        {style.title}
      </h1>

      {/* Member info */}
      {result.member && (
        <div className={cn('text-center mb-6', style.textClass)}>
          <p className="text-2xl md:text-3xl font-medium mb-2">
            {result.member.nome?.split(' ')[0].toUpperCase()}
          </p>
          {result.member.access_type === 'CREDITS' && result.success && (
            <p className="text-lg opacity-90">
              {(result.member.credits_remaining || 1) - 1} créditos restantes
            </p>
          )}
          {result.member.access_expires_at && result.success && result.member.access_type !== 'CREDITS' && (
            <p className="text-lg opacity-90">
              Válido até {new Date(result.member.access_expires_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Exclusive area info */}
      {result.result === 'AREA_EXCLUSIVE' && result.rentalInfo && (
        <div className={cn('text-center mb-6 opacity-90', style.textClass)}>
          <p className="text-xl">{result.rentalInfo.areaName}</p>
          <p className="text-lg">Libera às {result.rentalInfo.endTime.slice(0, 5)}</p>
        </div>
      )}

      {/* Message for errors */}
      {!result.success && (
        <p className={cn('text-lg opacity-90 max-w-md text-center px-4', style.textClass)}>
          Procure a recepção para ajuda
        </p>
      )}

      {/* Tap to dismiss hint */}
      <p className={cn('absolute bottom-8 text-sm opacity-60', style.textClass)}>
        Toque para fechar
      </p>
    </div>
  );
};

export default KioskResultCard;
