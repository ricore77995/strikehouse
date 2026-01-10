import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, StaffRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: StaffRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, staff, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !staff) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    // Redirect to their appropriate dashboard
    const redirectPath = staff.role === 'OWNER' ? '/owner/dashboard' :
                         staff.role === 'ADMIN' ? '/admin/dashboard' :
                         staff.role === 'STAFF' ? '/staff/checkin' :
                         '/partner/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
