import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePasswordRequired from "./pages/ChangePasswordRequired";
import Browse from "./pages/Browse";
import ProjectDetail from "./pages/ProjectDetail";
import Upload from "./pages/Upload";
import MySubmissions from "./pages/MySubmissions";
import Scanner from "./pages/Scanner";
import Bookmarks from "./pages/Bookmarks";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import ArchiveManagement from "./pages/ArchiveManagement";
import CategoryManagement from "./pages/CategoryManagement";
import UserManagement from "./pages/UserManagement";
import DownloadRequests from "./pages/DownloadRequests";
import EditRequests from "./pages/EditRequests";
import PasswordResets from "./pages/PasswordResets";
import ActivityLogs from "./pages/ActivityLogs";
import SiteHeader from "./components/SiteHeader";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Home />}</Route>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/change-password" component={ChangePasswordRequired} />
      <Route path="/browse" component={Browse} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/upload" component={Upload} />
      <Route path="/my-submissions" component={MySubmissions} />
      <Route path="/bookmarks" component={Bookmarks} />
      <Route path="/profile" component={Profile} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin/archive" component={ArchiveManagement} />
      <Route path="/admin/scanner" component={Scanner} />
      <Route path="/admin/categories" component={CategoryManagement} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/admin/downloads" component={DownloadRequests} />
      <Route path="/admin/edit-requests" component={EditRequests} />
      <Route path="/password-resets" component={PasswordResets} />
      <Route path="/admin/activities" component={ActivityLogs} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * While `user.mustChangePassword` is set (the person signed in with an
 * admin/adviser-issued temporary password, see drizzle/schema.ts), they can
 * only reach /change-password — every other route bounces back there. The
 * flag clears itself the moment they successfully set their own new
 * password (ChangePasswordRequired.tsx), so this stops applying as soon as
 * that happens. Renders nothing; it only redirects.
 */
function RequirePasswordChange() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (user?.mustChangePassword && location !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user?.mustChangePassword, location, navigate]);

  return null;
}

function App() {
  const { isAuthenticated } = useAuth();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <RequirePasswordChange />
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex flex-1">
              {isAuthenticated && <Sidebar />}
              <div className={cn("flex-1 min-w-0 flex flex-col", isAuthenticated && "lg:pl-64")}>
                <main className="flex-1">
                  <Router />
                </main>
                <Footer />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
