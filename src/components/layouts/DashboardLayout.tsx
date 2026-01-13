import { useState, useEffect } from 'react';
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
  UserCheck,
  UserPlus,
  GraduationCap,
  UsersRound,
  MapPin,
  Wallet,
  Cog,
  FileCheck,
  Activity,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles?: StaffRole[];
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  roles: StaffRole[];
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  // Dashboard - OWNER & ADMIN
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['OWNER', 'ADMIN'],
    defaultOpen: true,
    items: [
      {
        title: 'Visão Geral',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN'],
      },
      {
        title: 'Visão Executiva',
        href: '/owner/dashboard',
        icon: LayoutDashboard,
        roles: ['OWNER'],
      },
    ],
  },

  // Operações Diárias - ALL
  {
    title: 'Operações Diárias',
    icon: Activity,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
    defaultOpen: true,
    items: [
      {
        title: 'Check-in',
        href: '/staff/checkin',
        icon: QrCode,
      },
      {
        title: 'Guests',
        href: '/staff/guests',
        icon: UserPlus,
      },
      {
        title: 'Novo Membro',
        href: '/staff/members/new',
        icon: UserCheck,
      },
      {
        title: 'Matrícula',
        href: '/staff/enrollment',
        icon: UserPlus,
      },
      {
        title: 'Horários',
        href: '/admin/schedule',
        icon: CalendarDays,
        roles: ['OWNER', 'ADMIN'],
      },
    ],
  },

  // Membros - ALL
  {
    title: 'Membros',
    icon: Users,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
    defaultOpen: false,
    items: [
      {
        title: 'Todos os Membros',
        href: '/admin/members',
        icon: Users,
      },
      {
        title: 'Planos',
        href: '/admin/plans',
        icon: CreditCard,
        roles: ['OWNER', 'ADMIN'],
      },
    ],
  },

  // Financeiro - ALL
  {
    title: 'Financeiro',
    icon: DollarSign,
    roles: ['OWNER', 'ADMIN', 'STAFF'],
    defaultOpen: false,
    items: [
      {
        title: 'Pagamentos',
        href: '/staff/payment',
        icon: DollarSign,
      },
      {
        title: 'Verificar Transf.',
        href: '/admin/finances/verify',
        icon: FileCheck,
        roles: ['OWNER', 'ADMIN'],
      },
      {
        title: 'Vendas',
        href: '/staff/sales',
        icon: ShoppingCart,
      },
      {
        title: 'Caixa',
        href: '/staff/caixa',
        icon: Wallet,
      },
      {
        title: 'Relatório Financeiro',
        href: '/admin/finances',
        icon: BarChart3,
        roles: ['OWNER', 'ADMIN'],
      },
      {
        title: 'Cobranças',
        href: '/admin/billing',
        icon: FileText,
        roles: ['OWNER', 'ADMIN'],
      },
    ],
  },

  // Rentals & Parceiros - OWNER & ADMIN
  {
    title: 'Rentals & Parceiros',
    icon: CalendarDays,
    roles: ['OWNER', 'ADMIN'],
    defaultOpen: false,
    items: [
      {
        title: 'Coaches Externos',
        href: '/admin/coaches',
        icon: GraduationCap,
      },
      {
        title: 'Rentals',
        href: '/admin/rentals',
        icon: CalendarDays,
      },
      {
        title: 'Áreas',
        href: '/admin/areas',
        icon: MapPin,
      },
    ],
  },

  // Produtos - OWNER & ADMIN
  {
    title: 'Produtos',
    icon: Package,
    roles: ['OWNER', 'ADMIN'],
    defaultOpen: false,
    items: [
      {
        title: 'Catálogo',
        href: '/admin/products',
        icon: Package,
      },
    ],
  },

  // Gestão - OWNER & ADMIN
  {
    title: 'Gestão',
    icon: Settings,
    roles: ['OWNER', 'ADMIN'],
    defaultOpen: false,
    items: [
      {
        title: 'Equipe',
        href: '/owner/staff',
        icon: UsersRound,
      },
      {
        title: 'Configurações',
        href: '/owner/settings',
        icon: Settings,
      },
    ],
  },

  // Auditoria - OWNER & ADMIN
  {
    title: 'Auditoria',
    icon: Shield,
    roles: ['OWNER', 'ADMIN'],
    defaultOpen: false,
    items: [
      {
        title: 'Logs',
        href: '/admin/audit',
        icon: Shield,
      },
      {
        title: 'Jobs',
        href: '/admin/jobs',
        icon: Cog,
      },
    ],
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

  const getRoleLabel = (role: StaffRole) => {
    switch (role) {
      case 'OWNER': return 'Proprietário';
      case 'ADMIN': return 'Administrador';
      case 'STAFF': return 'Staff';
      default: return role;
    }
  };

  // Filter groups by role
  const filteredNavGroups = navGroups.filter(
    (group) => staff && group.roles.includes(staff.role)
  );

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
            <nav className="px-2 space-y-2">
              {filteredNavGroups.map((group) => (
                <NavGroup
                  key={group.title}
                  group={group}
                  staff={staff!}
                  setSidebarOpen={setSidebarOpen}
                />
              ))}
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

// NavGroup Component
interface NavGroupProps {
  group: NavGroup;
  staff: NonNullable<ReturnType<typeof useAuth>['staff']>;
  setSidebarOpen: (open: boolean) => void;
}

const NavGroup = ({ group, staff, setSidebarOpen }: NavGroupProps) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(group.defaultOpen ?? false);

  // Check if any child is active
  const hasActiveChild = group.items.some(
    (item) =>
      (!item.roles || item.roles.includes(staff.role)) &&
      (location.pathname === item.href || location.pathname.startsWith(item.href + '/'))
  );

  // Auto-expand if active child
  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  const Icon = group.icon;

  // Filter items by role
  const visibleItems = group.items.filter(
    (item) => !item.roles || item.roles.includes(staff.role)
  );

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3 py-2 text-sm rounded-sm transition-colors',
          hasActiveChild
            ? 'bg-sidebar-accent/30 text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          <span className="uppercase tracking-wider text-xs font-medium">
            {group.title}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="pl-4 space-y-1">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon;
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
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground'
                )}
              >
                <ItemIcon className="h-3.5 w-3.5" />
                <span className="text-xs">{item.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
