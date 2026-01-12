import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface CoachData {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  modalidade: string | null;
  fee_type: 'FIXED' | 'PERCENTAGE';
  fee_value: number;
  credits_balance: number;
  ativo: boolean;
}

interface CoachAuthContextType {
  user: User | null;
  session: Session | null;
  coach: CoachData | null;
  coachId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const CoachAuthContext = createContext<CoachAuthContextType | undefined>(undefined);

export const CoachAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoachData = async (userId: string) => {
    try {
      console.log('[CoachAuth] Fetching coach data for user:', userId);
      const { data, error } = await supabase
        .from('external_coaches')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        console.error('[CoachAuth] Error fetching coach data:', error);
        return null;
      }

      console.log('[CoachAuth] Coach data result:', data);
      return data as CoachData | null;
    } catch (error) {
      console.error('[CoachAuth] Error fetching coach data:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[CoachAuth] Auth state change:', event, currentSession?.user?.id);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          fetchCoachData(currentSession.user.id).then(coachData => {
            console.log('[CoachAuth] Setting coach data:', coachData?.nome);
            setCoach(coachData);
            setLoading(false);
          });
        } else {
          setCoach(null);
          setLoading(false);
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        const coachData = await fetchCoachData(initialSession.user.id);
        setCoach(coachData);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[CoachAuth] Attempting sign in for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[CoachAuth] Sign in error:', error);
        return { error };
      }

      console.log('[CoachAuth] Sign in success, user:', data.user?.id);
      return { error: null };
    } catch (error) {
      console.error('[CoachAuth] Sign in exception:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCoach(null);
  };

  const value = {
    user,
    session,
    coach,
    coachId: coach?.id ?? null,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user && !!coach,
  };

  return <CoachAuthContext.Provider value={value}>{children}</CoachAuthContext.Provider>;
};

export const useCoachAuth = () => {
  const context = useContext(CoachAuthContext);
  if (context === undefined) {
    throw new Error('useCoachAuth must be used within a CoachAuthProvider');
  }
  return context;
};
