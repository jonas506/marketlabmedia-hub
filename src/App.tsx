import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import ClientDetail from "./pages/ClientDetail";
import LandingPageBuilder from "./pages/LandingPageBuilder";
import ClientApproval from "./pages/ClientApproval";
import TeamOverview from "./pages/TeamOverview";
import Checklists from "./pages/Checklists";
import SOPs from "./pages/SOPs";
import PromptLibrary from "./pages/PromptLibrary";
import Templates from "./pages/Templates";

import Login from "./pages/Login";
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
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/approve/:token" element={<ClientApproval />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/client/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/client/:id/landing-page" element={<ProtectedRoute><LandingPageBuilder /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamOverview /></ProtectedRoute>} />
            <Route path="/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
            <Route path="/sops" element={<ProtectedRoute><SOPs /></ProtectedRoute>} />
            <Route path="/prompts" element={<ProtectedRoute><PromptLibrary /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
