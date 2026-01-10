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

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import Plans from "./pages/admin/Plans";
import Members from "./pages/admin/Members";
import MemberForm from "./pages/admin/MemberForm";

// Staff pages
import StaffCheckin from "./pages/staff/Checkin";

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

            {/* Staff routes */}
            <Route
              path="/staff/checkin"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
                  <StaffCheckin />
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
