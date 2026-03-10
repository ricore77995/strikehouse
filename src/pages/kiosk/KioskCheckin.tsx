import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskAuth } from '@/hooks/useKioskAuth';
import { useCheckin, type CheckinResult } from '@/hooks/useCheckin';
import { supabase } from '@/integrations/supabase/client';
import QRScanner from '@/components/QRScanner';
import KioskResultCard from '@/components/KioskResultCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode, LogOut, Clock, Users, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayClass {
  id: string;
  nome: string;
  modalidade: string;
  hora_inicio: string;
  duracao_min: number;
  capacidade: number;
  current_bookings: number;
  status: 'upcoming' | 'ongoing' | 'ended';
}

const KioskCheckin = () => {
  const { isAuthenticated, logout } = useKioskAuth();
  const { processQRCode } = useCheckin();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<TodayClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [selectedClass, setSelectedClass] = useState<TodayClass | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/kiosk', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Load today's classes
  useEffect(() => {
    loadTodayClasses();
    // Refresh every minute
    const interval = setInterval(loadTodayClasses, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadTodayClasses = async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
    const today = now.toISOString().split('T')[0];

    // Get classes for today
    const { data: classesData, error } = await supabase
      .from('classes')
      .select('id, nome, modalidade, hora_inicio, duracao_min, capacidade')
      .eq('dia_semana', dayOfWeek)
      .eq('ativo', true)
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('Error loading classes:', error);
      setIsLoadingClasses(false);
      return;
    }

    if (!classesData) {
      setClasses([]);
      setIsLoadingClasses(false);
      return;
    }

    // Get booking counts for each class
    const classesWithStatus: TodayClass[] = await Promise.all(
      classesData.map(async (cls) => {
        // Get booking count
        const { count } = await supabase
          .from('class_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('class_date', today)
          .in('status', ['BOOKED', 'CHECKED_IN']);

        // Calculate class end time
        const [hours, minutes] = cls.hora_inicio.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + (cls.duracao_min || 60);
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        // Determine status
        let status: 'upcoming' | 'ongoing' | 'ended';
        if (currentTime < cls.hora_inicio) {
          status = 'upcoming';
        } else if (currentTime >= cls.hora_inicio && currentTime < endTime) {
          status = 'ongoing';
        } else {
          status = 'ended';
        }

        return {
          ...cls,
          current_bookings: count || 0,
          status,
        };
      })
    );

    // Filter: show only upcoming and ongoing classes
    const availableClasses = classesWithStatus.filter(
      (cls) => cls.status === 'upcoming' || cls.status === 'ongoing'
    );

    setClasses(availableClasses);
    setIsLoadingClasses(false);
  };

  // Handle QR scan for selected class
  const handleQRScan = async (code: string) => {
    if (!selectedClass) return;

    // Process QR code with class context
    const result = await processQRCode(code, null, selectedClass.id);
    setCheckinResult(result);
  };

  // Handle result dismissal
  const handleDismiss = () => {
    setCheckinResult(null);
    setSelectedClass(null);
    // Refresh classes to update booking counts
    loadTodayClasses();
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/kiosk', { replace: true });
  };

  // Handle back to class selection
  const handleBack = () => {
    setSelectedClass(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          {selectedClass ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="mr-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
              <QrCode className="h-5 w-5 text-accent-foreground" />
            </div>
          )}
          <div>
            <span className="text-lg uppercase tracking-widest font-light">Check-in</span>
            {selectedClass && (
              <p className="text-sm text-muted-foreground">{selectedClass.nome}</p>
            )}
          </div>
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {selectedClass ? (
          // Scanner mode
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto">
            <Card className="w-full mb-6 bg-accent/10 border-accent/30">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-medium">{selectedClass.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedClass.hora_inicio.slice(0, 5)} • {selectedClass.modalidade}
                </p>
              </CardContent>
            </Card>

            <div className="w-full">
              <QRScanner
                onScan={handleQRScan}
                onClose={handleBack}
              />
              <p className="text-center text-lg text-foreground mt-6">
                Escaneie seu QR Code para fazer check-in
              </p>
            </div>
          </div>
        ) : (
          // Class selection mode
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-light tracking-wider mb-4 text-center">
              Selecione sua aula
            </h2>

            {isLoadingClasses ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma aula disponível no momento
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  As aulas de hoje já terminaram ou não há aulas programadas
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {classes.map((cls) => (
                  <Card
                    key={cls.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-accent',
                      cls.status === 'ongoing' && 'border-green-500/50 bg-green-500/5'
                    )}
                    onClick={() => setSelectedClass(cls)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-medium">{cls.nome}</h3>
                            {cls.status === 'ongoing' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 uppercase">
                                Em andamento
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {cls.modalidade}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-lg font-mono">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {cls.hora_inicio.slice(0, 5)}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {cls.current_bookings}/{cls.capacidade}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
