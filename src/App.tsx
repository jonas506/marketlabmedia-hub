import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import ClientDetail from "./pages/ClientDetail";

import ClientApproval from "./pages/ClientApproval";
import TeamOverview from "./pages/TeamOverview";
import Checklists from "./pages/Checklists";
import SOPs from "./pages/SOPs";
import PromptLibrary from "./pages/PromptLibrary";
import ContentBase from "./pages/ContentBase";
import MarketingDashboard from "./pages/MarketingDashboard";

import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

// CRM
import CrmLayout from "./crm/CrmLayout";
import CrmInbox from "./crm/pages/CrmInbox";
import CrmLeads from "./crm/pages/CrmLeads";
import CrmLeadDetail from "./crm/pages/CrmLeadDetail";
import CrmOpportunities from "./crm/pages/CrmOpportunities";
import CrmContacts from "./crm/pages/CrmContacts";
import CrmActivities from "./crm/pages/CrmActivities";
import CrmPlaceholder from "./crm/pages/CrmPlaceholder";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/approve/:token" element={<ClientApproval />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/client/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
              
              <Route path="/team" element={<ProtectedRoute><TeamOverview /></ProtectedRoute>} />
              <Route path="/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
              <Route path="/sops" element={<ProtectedRoute><SOPs /></ProtectedRoute>} />
              <Route path="/prompts" element={<ProtectedRoute><PromptLibrary /></ProtectedRoute>} />
              <Route path="/content-base" element={<ProtectedRoute><ContentBase /></ProtectedRoute>} />
              <Route path="/marketing" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />

              {/* CRM Routes */}
              <Route path="/crm" element={<ProtectedRoute><CrmLayout /></ProtectedRoute>}>
                <Route index element={<CrmInbox />} />
                <Route path="leads" element={<CrmLeads />} />
                <Route path="leads/:id" element={<CrmLeadDetail />} />
                <Route path="opportunities" element={<CrmOpportunities />} />
                <Route path="contacts" element={<CrmContacts />} />
                <Route path="activities" element={<CrmActivities />} />
                <Route path="conversations" element={<CrmPlaceholder title="Conversations" />} />
                <Route path="workflows" element={<CrmPlaceholder title="Workflows" />} />
                <Route path="reports" element={<CrmPlaceholder title="Reports" />} />
                <Route path="smart-views" element={<CrmPlaceholder title="Smart Views" />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
