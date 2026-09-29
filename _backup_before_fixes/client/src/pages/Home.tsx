import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  BookOpen, Search, Upload, Star, Shield, GraduationCap,
  ArrowRight, FolderOpen, Users, FileText,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <GraduationCap className="h-4 w-4" />
              BSIT Capstone Archive
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Capstone Project{" "}
              <span className="text-primary">Archive</span> Management System
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover, share, and archive capstone projects from BSIT students at Golden West Colleges, Inc.
              Browse through a growing collection of innovative research and development work.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/browse" className="no-underline">
                <Button size="lg" className="gap-2">
                  <Search className="h-5 w-5" />
                  Browse Projects
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {isAuthenticated ? (
                <Link href="/upload" className="no-underline">
                  <Button size="lg" variant="outline" className="gap-2 border-primary/30">
                    <Upload className="h-5 w-5" />
                    Upload Project
                  </Button>
                </Link>
              ) : (
                <Link href="/login" className="no-underline">
                  <Button size="lg" variant="outline" className="gap-2 border-primary/30">
                    <BookOpen className="h-5 w-5" />
                    Login to Upload
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Key Features</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to manage and access capstone projects in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Search, title: "Advanced Search", desc: "Find projects by title, keywords, category, author, adviser, or school year." },
              { icon: Upload, title: "Project Upload", desc: "Submit your capstone documents with full metadata and file attachments." },
              { icon: Star, title: "Favorites", desc: "Bookmark your favorite projects for quick and easy access anytime." },
              { icon: FolderOpen, title: "Category Management", desc: "Organized by Web Dev, Mobile Dev, AI, Networking, and Database Systems." },
              { icon: Users, title: "Admin Controls", desc: "Full administrative dashboard for managing projects, users, and requests." },
              { icon: Shield, title: "Approval System", desc: "Quality-controlled archive with admin review and approval workflow." },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Project Categories</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Browse capstone projects across five key areas of Information Technology.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {[
              { name: "Web Development", icon: "🌐", color: "bg-blue-500" },
              { name: "Mobile Development", icon: "📱", color: "bg-green-500" },
              { name: "AI", icon: "🤖", color: "bg-purple-500" },
              { name: "Networking", icon: "🔗", color: "bg-orange-500" },
              { name: "Database Systems", icon: "🗄️", color: "bg-red-500" },
            ].map((cat, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-6 rounded-xl border border-border/50 bg-card hover:shadow-md transition-all"
              >
                <div className={`h-14 w-14 rounded-full ${cat.color} flex items-center justify-center text-2xl mb-3`}>
                  {cat.icon}
                </div>
                <span className="text-sm font-medium text-foreground text-center">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-primary text-primary-foreground">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
              { icon: FileText, label: "Archived Projects", value: "100+" },
              { icon: Users, label: "Active Students", value: "50+" },
              { icon: FolderOpen, label: "Categories", value: "5" },
              { icon: GraduationCap, label: "School Years", value: "10+" },
            ].map((stat, i) => (
              <div key={i}>
                <stat.icon className="h-8 w-8 mx-auto mb-2 opacity-80" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm opacity-80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Golden West Colleges, Inc. — Capstone Archive Management System</p>
          <p className="mt-1">BSIT Department</p>
        </div>
      </footer>
    </div>
  );
}
