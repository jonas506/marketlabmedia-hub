import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import ClientDetail from "./pages/ClientDetail";
import StrategyBoards from "./pages/StrategyBoards";
import StrategyBoardEditor from "./pages/StrategyBoardEditor";
import SharedBoard from "./pages/SharedBoard";

import ClientApproval from "./pages/ClientApproval";
import TeamOverview from "./pages/TeamOverview";
import Checklists from "./pages/Checklists";
import SOPs from "./pages/SOPs";
import PromptLibrary from "./pages/PromptLibrary";
import ContentBase from "./pages/ContentBase";
import MarketingDashboard from "./pages/MarketingDashboard";
import CRMLeads from "./pages/crm/CRMLeads";
import CRMLeadDetail from "./pages/crm/CRMLeadDetail";
import CRMPipelines from "./pages/crm/CRMPipelines";
import CRMSettings from "./pages/crm/CRMSettings";

import ContractTimeline from "./pages/ContractTimeline";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

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
              <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
              
              <Route path="/team" element={<ProtectedRoute><TeamOverview /></ProtectedRoute>} />
              <Route path="/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
              <Route path="/sops" element={<ProtectedRoute><SOPs /></ProtectedRoute>} />
              <Route path="/prompts" element={<ProtectedRoute><PromptLibrary /></ProtectedRoute>} />
              <Route path="/content-base" element={<ProtectedRoute><ContentBase /></ProtectedRoute>} />
              <Route path="/marketing" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />
              <Route path="/strategy-boards" element={<ProtectedRoute><StrategyBoards /></ProtectedRoute>} />
              <Route path="/strategy-boards/:id" element={<ProtectedRoute><StrategyBoardEditor /></ProtectedRoute>} />
              <Route path="/shared/boards/:token" element={<SharedBoard />} />
              <Route path="/contracts" element={<ProtectedRoute><ContractTimeline /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRMLeads /></ProtectedRoute>} />
              <Route path="/crm/lead/:id" element={<ProtectedRoute><CRMLeadDetail /></ProtectedRoute>} />
              <Route path="/crm/pipelines" element={<ProtectedRoute><CRMPipelines /></ProtectedRoute>} />
              <Route path="/crm/settings" element={<ProtectedRoute><CRMSettings /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
