import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
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
import ActivityLogs from "./pages/ActivityLogs";
import SiteHeader from "./components/SiteHeader";
import PageBackground from "./components/PageBackground";

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Home />}</Route>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
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
      <Route path="/admin/activities" component={ActivityLogs} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <PageBackground />
          <Toaster />
          <SiteHeader />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
