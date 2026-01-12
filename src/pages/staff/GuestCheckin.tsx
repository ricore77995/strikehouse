import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Clock, CheckCircle, UserPlus, Search, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TodayRental {
  id: string;
  coach_id: string;
  coach_nome: string;
  area_nome: string;
  modalidade: string | null;
  start_time: string;
  end_time: string;
  guest_count: number;
  status: string;
  area_capacidade: number;
}

interface CoachGuest {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface GuestCheckin {
  id: string;
  guest_name: string;
  checked_in_at: string;
  rental_id: string;
}

const GuestCheckinPage = () => {
  const { staffId } = useAuth();
  const [rentals, setRentals] = useState<TodayRental[]>([]);
  const [selectedRental, setSelectedRental] = useState<TodayRental | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentGuests, setRecentGuests] = useState<GuestCheckin[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastGuest, setLastGuest] = useState<{ name: string; rental: TodayRental } | null>(null);
  const [coachGuests, setCoachGuests] = useState<CoachGuest[]>([]);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');

  useEffect(() => {
    loadTodayRentals();
    loadRecentGuests();
  }, []);

  // Load coach guests when rental is selected
  useEffect(() => {
    if (selectedRental?.coach_id) {
      loadCoachGuests(selectedRental.coach_id);
    } else {
      setCoachGuests([]);
    }
  }, [selectedRental?.coach_id]);

  const loadTodayRentals = async () => {
    const { data, error } = await supabase
      .from('v_today_rentals')
      .select('*')
      .eq('status', 'SCHEDULED')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading rentals:', error);
      toast.error('Erro ao carregar rentals');
      return;
    }

    setRentals((data || []) as TodayRental[]);
  };

  const loadRecentGuests = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('check_ins')
      .select('id, guest_name, checked_in_at, rental_id')
      .eq('type', 'GUEST')
      .gte('checked_in_at', today.toISOString())
      .order('checked_in_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading guests:', error);
      return;
    }

    setRecentGuests((data || []) as GuestCheckin[]);
  };

  const loadCoachGuests = async (coachId: string) => {
    const { data, error } = await supabase
      .from('coach_guests')
      .select('id, nome, telefone, email')
      .eq('coach_id', coachId)
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Error loading coach guests:', error);
      return;
    }

    setCoachGuests((data || []) as CoachGuest[]);
  };

  const selectCoachGuest = (guest: CoachGuest) => {
    setSelectedGuestId(guest.id);
    setGuestName(guest.nome);
    setGuestSearchQuery('');
  };

  const clearGuestSelection = () => {
    setSelectedGuestId(null);
    setGuestName('');
    setGuestSearchQuery('');
  };

  const filteredCoachGuests = coachGuests.filter(g =>
    g.nome.toLowerCase().includes(guestSearchQuery.toLowerCase())
  );

  const handleCheckin = async () => {
    if (!selectedRental || !guestName.trim() || !staffId) {
      toast.error('Selecione um rental e digite o nome do guest');
      return;
    }

    // Check capacity
    const currentGuests = selectedRental.guest_count || 0;
    const maxCapacity = selectedRental.area_capacidade || 1;
    
    if (currentGuests >= maxCapacity) {
      toast.error(`Capacidade máxima atingida (${maxCapacity} guests)`);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Insert check-in record
      const { error: checkinError } = await supabase
        .from('check_ins')
        .insert({
          type: 'GUEST',
          result: 'ALLOWED',
          guest_name: guestName.trim(),
          guest_id: selectedGuestId, // Link to registered guest if selected
          rental_id: selectedRental.id,
          checked_in_by: staffId,
        });

      if (checkinError) {
        throw checkinError;
      }

      // 2. Increment guest_count on rental
      const { error: updateError } = await supabase
        .from('rentals')
        .update({ guest_count: (selectedRental.guest_count || 0) + 1 })
        .eq('id', selectedRental.id);

      if (updateError) {
        throw updateError;
      }

      // Show success
      setLastGuest({ name: guestName.trim(), rental: selectedRental });
      setShowSuccess(true);
      setGuestName('');
      setSelectedGuestId(null);
      setGuestSearchQuery('');

      // Update local state
      setRentals(prev => prev.map(r =>
        r.id === selectedRental.id
          ? { ...r, guest_count: (r.guest_count || 0) + 1 }
          : r
      ));
      setSelectedRental(prev => prev ? { ...prev, guest_count: (prev.guest_count || 0) + 1 } : null);

      loadRecentGuests();

      // Auto-dismiss after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Erro ao registrar check-in');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const dismissSuccess = () => {
    setShowSuccess(false);
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">CHECK-IN GUESTS</h1>
          <p className="text-muted-foreground text-sm">
            Registrar entrada de visitantes em rentals
          </p>
        </div>

        {/* Success Modal */}
        {showSuccess && lastGuest && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
              <Card className="border-green-500/50 bg-green-500/10">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold uppercase tracking-wider text-green-400">
                        ENTRADA PERMITIDA
                      </h2>
                      <p className="text-lg font-medium mt-2">{lastGuest.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lastGuest.rental.coach_nome} • {lastGuest.rental.area_nome}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(lastGuest.rental.start_time)} - {formatTime(lastGuest.rental.end_time)}
                      </p>
                    </div>
                    <Button onClick={dismissSuccess} className="uppercase tracking-wider">
                      OK
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Select Rental */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rentals de Hoje
            </CardTitle>
            <CardDescription>
              Selecione o rental para registrar o guest
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rentals.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {rentals.map((rental) => (
                  <button
                    key={rental.id}
                    onClick={() => setSelectedRental(rental)}
                    className={cn(
                      'p-4 rounded-lg text-left transition-all border-2',
                      selectedRental?.id === rental.id
                        ? 'bg-accent/20 border-accent'
                        : 'bg-secondary hover:bg-secondary/80 border-transparent'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{rental.coach_nome}</p>
                        <p className="text-sm text-muted-foreground">{rental.area_nome}</p>
                        {rental.modalidade && (
                          <p className="text-xs text-muted-foreground mt-1">{rental.modalidade}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">
                          {formatTime(rental.start_time)} - {formatTime(rental.end_time)}
                        </p>
                        <p className={cn(
                          'text-xs mt-1',
                          (rental.guest_count || 0) >= rental.area_capacidade 
                            ? 'text-destructive font-medium' 
                            : 'text-muted-foreground'
                        )}>
                          {rental.guest_count || 0} / {rental.area_capacidade} guests
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="min-h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum rental agendado para hoje
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guest Name Input */}
        {selectedRental && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Registrar Guest
              </CardTitle>
              <CardDescription>
                Rental: <span className="font-medium">{selectedRental.coach_nome}</span> • {selectedRental.area_nome}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coach Guests List */}
              {coachGuests.length > 0 && !selectedGuestId && (
                <div className="space-y-2">
                  <Label>Alunos do Coach</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar aluno..."
                      value={guestSearchQuery}
                      onChange={(e) => setGuestSearchQuery(e.target.value)}
                      className="pl-10 bg-secondary"
                    />
                  </div>
                  <ScrollArea className="h-40 border border-border rounded-lg">
                    <div className="p-2 space-y-1">
                      {filteredCoachGuests.map((guest) => (
                        <button
                          key={guest.id}
                          onClick={() => selectCoachGuest(guest)}
                          className="w-full p-2 text-left rounded-md hover:bg-accent/20 transition-colors flex items-center gap-2"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{guest.nome}</p>
                            {guest.telefone && (
                              <p className="text-xs text-muted-foreground">{guest.telefone}</p>
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredCoachGuests.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum aluno encontrado
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">ou digite um nome avulso abaixo</span>
                  </div>
                </div>
              )}

              {/* Selected Guest Display */}
              {selectedGuestId && (
                <div className="p-3 bg-accent/20 border border-accent/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium">{guestName}</p>
                      <p className="text-xs text-muted-foreground">Aluno cadastrado</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearGuestSelection}>
                    Alterar
                  </Button>
                </div>
              )}

              {/* Manual Guest Name Input */}
              {!selectedGuestId && (
                <div className="space-y-2">
                  <Label htmlFor="guestName">Nome do Guest</Label>
                  <Input
                    id="guestName"
                    placeholder="Digite o nome completo..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckin()}
                    className="bg-secondary border-border text-lg h-12"
                    autoFocus={coachGuests.length === 0}
                  />
                </div>
              )}

              <Button
                onClick={handleCheckin}
                disabled={isLoading || !guestName.trim()}
                className="w-full h-14 bg-accent hover:bg-accent/90 text-accent-foreground uppercase tracking-wider text-base"
              >
                {isLoading ? 'Registrando...' : 'Registrar Entrada'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Guests */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Guests de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentGuests.length > 0 ? (
              <div className="space-y-2">
                {recentGuests.map((guest) => {
                  const rental = rentals.find(r => r.id === guest.rental_id);
                  return (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-green-500/10"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{guest.guest_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rental ? `${rental.coach_nome} • ${rental.area_nome}` : 'Rental'}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(guest.checked_in_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum guest registrado hoje
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GuestCheckinPage;
