import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public pages
import Index from "./pages/Index";
import TheTeam from "./pages/TheTeam";
import Membership from "./pages/Membership";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import MemberQR from "./pages/MemberQR";

// Owner pages
import OwnerDashboard from "./pages/owner/Dashboard";
import OwnerStaff from "./pages/owner/Staff";
import OwnerSettings from "./pages/owner/Settings";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import Plans from "./pages/admin/Plans";
import Members from "./pages/admin/Members";
import MemberForm from "./pages/admin/MemberForm";
import Coaches from "./pages/admin/Coaches";
import PendingPayments from "./pages/admin/PendingPayments";
import Billing from "./pages/admin/Billing";
import Areas from "./pages/admin/Areas";
import Rentals from "./pages/admin/Rentals";
import Products from "./pages/admin/Products";
import Audit from "./pages/admin/Audit";
import Finances from "./pages/admin/Finances";

// Staff pages
import StaffCheckin from "./pages/staff/Checkin";
import StaffGuestCheckin from "./pages/staff/GuestCheckin";
import StaffPayment from "./pages/staff/Payment";
import StaffSales from "./pages/staff/Sales";
import StaffCaixa from "./pages/staff/Caixa";

// Partner pages
import PartnerDashboard from "./pages/partner/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/team" element={<TheTeam />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/login" element={<Login />} />
            <Route path="/m/:qrCode" element={<MemberQR />} />

            {/* Owner routes */}
            <Route
              path="/owner/dashboard"
              element={
                <ProtectedRoute allowedRoles={['OWNER']}>
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/staff"
              element={
                <ProtectedRoute allowedRoles={['OWNER']}>
                  <OwnerStaff />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/settings"
              element={
                <ProtectedRoute allowedRoles={['OWNER']}>
                  <OwnerSettings />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/plans"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Plans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/members"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <Members />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/members/:id"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <MemberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coaches"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Coaches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finances/verify"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <PendingPayments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billing"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Billing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/areas"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Areas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rentals"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Rentals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Audit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finances"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <Finances />
                </ProtectedRoute>
              }
            />

            {/* Staff routes */}
            <Route
              path="/staff/checkin"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffCheckin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/guests"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffGuestCheckin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/payment"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffPayment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/sales"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/caixa"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffCaixa />
                </ProtectedRoute>
              }
            />

            {/* Partner routes */}
            <Route
              path="/partner/dashboard"
              element={
                <ProtectedRoute allowedRoles={['PARTNER']}>
                  <PartnerDashboard />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
