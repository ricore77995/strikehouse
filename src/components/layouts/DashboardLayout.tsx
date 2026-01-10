import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, StaffRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarDays,
  DollarSign,
  ClipboardList,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  QrCode,
  ShoppingCart,
  FileText,
  Shield,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: StaffRole[];
  children?: { title: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/owner/dashboard',
    icon: LayoutDashboard,
    roles: ['OWNER'],
  },
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN'],
  },
  {
    title: 'Check-in',
    href: '/staff/checkin',
    icon: QrCode,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Guests',
    href: '/staff/guests',
    icon: Users,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Membros',
    href: '/admin/members',
    icon: Users,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Planos',
    href: '/admin/plans',
    icon: CreditCard,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Pagamentos',
    href: '/staff/payment',
    icon: DollarSign,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Verificar Transf.',
    href: '/admin/finances/verify',
    icon: FileText,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Cobranças',
    href: '/admin/billing',
    icon: FileText,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Coaches',
    href: '/admin/coaches',
    icon: Users,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Áreas',
    href: '/admin/areas',
    icon: LayoutDashboard,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Rentals',
    href: '/admin/rentals',
    icon: CalendarDays,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Vendas',
    href: '/staff/sales',
    icon: ShoppingCart,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Produtos',
    href: '/admin/products',
    icon: Package,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Financeiro',
    href: '/admin/finances',
    icon: BarChart3,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Caixa',
    href: '/staff/caixa',
    icon: ClipboardList,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    title: 'Auditoria',
    href: '/admin/audit',
    icon: Shield,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    title: 'Equipe',
    href: '/owner/staff',
    icon: Users,
    roles: ['OWNER'],
  },
  {
    title: 'Configurações',
    href: '/owner/settings',
    icon: Settings,
    roles: ['OWNER'],
  },
  {
    title: 'Dashboard',
    href: '/partner/dashboard',
    icon: LayoutDashboard,
    roles: ['PARTNER'],
  },
  {
    title: 'Meus Rentals',
    href: '/partner/rentals',
    icon: CalendarDays,
    roles: ['PARTNER'],
  },
  {
    title: 'Recorrentes',
    href: '/partner/recurring',
    icon: CalendarDays,
    roles: ['PARTNER'],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { staff, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => staff && item.roles.includes(staff.role)
  );

  const getRoleLabel = (role: StaffRole) => {
    switch (role) {
      case 'OWNER': return 'Proprietário';
      case 'ADMIN': return 'Administrador';
      case 'STAFF': return 'Staff';
      case 'PARTNER': return 'Partner';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-accent rounded-sm flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">BM</span>
          </div>
          <span className="text-sm font-medium uppercase tracking-wider">BoxeMaster</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-border">
            <div className="h-8 w-8 bg-accent rounded-sm flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-sm">BM</span>
            </div>
            <span className="text-sm font-medium uppercase tracking-wider">BoxeMaster Pro</span>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-2 space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="uppercase tracking-wider text-xs">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User info & logout */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium">
                  {staff?.nome?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{staff?.nome}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {staff && getRoleLabel(staff.role)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="uppercase tracking-wider text-xs">Sair</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
