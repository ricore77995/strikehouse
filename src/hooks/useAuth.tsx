import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type StaffRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'PARTNER';

interface StaffData {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: StaffRole;
  coach_id: string | null;
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  staff: StaffData | null;
  staffId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStaffData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching staff data:', error);
        return null;
      }

      return data as StaffData | null;
    } catch (error) {
      console.error('Error fetching staff data:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            const staffData = await fetchStaffData(currentSession.user.id);
            setStaff(staffData);
            setLoading(false);
          }, 0);
        } else {
          setStaff(null);
          setLoading(false);
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        const staffData = await fetchStaffData(initialSession.user.id);
        setStaff(staffData);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setStaff(null);
  };

  const value = {
    user,
    session,
    staff,
    staffId: staff?.id ?? null,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user && !!staff,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper to get redirect path based on role
export const getRedirectPath = (role: StaffRole): string => {
  switch (role) {
    case 'OWNER':
      return '/owner/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'STAFF':
      return '/staff/checkin';
    case 'PARTNER':
      return '/partner/dashboard';
    default:
      return '/login';
  }
};
