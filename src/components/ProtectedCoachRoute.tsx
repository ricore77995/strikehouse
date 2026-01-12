import { Navigate, useLocation } from 'react-router-dom';
import { useCoachAuth } from '@/hooks/useCoachAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedCoachRouteProps {
  children: React.ReactNode;
}

const ProtectedCoachRoute = ({ children }: ProtectedCoachRouteProps) => {
  const { isAuthenticated, coach, loading } = useCoachAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !coach) {
    return <Navigate to="/coach/login" state={{ from: location }} replace />;
  }

  // Check if coach is active
  if (!coach.ativo) {
    return <Navigate to="/coach/login" state={{ error: 'Conta desativada' }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedCoachRoute;
