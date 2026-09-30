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
  const canUpload = isAdmin || user?.role === 'adviser';

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-[#0b1830] via-[#153567] to-[#1a3a6b]">
        {/* Oversized, faint seal watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-1/2 top-1/2 h-[min(140vw,1400px)] w-[min(140vw,1400px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
          style={{
            backgroundImage: "url(/logo.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
            maskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
            filter: "grayscale(1) brightness(2.2)",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 h-96 w-96 rounded-full bg-[#c9a227]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#2a5599]/40 blur-3xl" />

        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-[#f3d77a] text-sm font-medium mb-6">
              <GraduationCap className="h-4 w-4" />
              BSIT Capstone Archive
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              Capstone Project{" "}
              <span className="text-[#f3d77a]">Archive</span> Management System
            </h1>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Discover, share, and archive capstone projects from BSIT students at Golden West Colleges, Inc.
              Browse through a growing collection of innovative research and development work.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/browse" className="no-underline">
                <Button size="lg" className="gap-2 bg-[#c9a227] hover:bg-[#b8931f] text-[#1a3a6b] font-semibold">
                  <Search className="h-5 w-5" />
                  Browse Projects
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {isAuthenticated ? (canUpload && (
                <Link href="/upload" className="no-underline">
                  <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">
                    <Upload className="h-5 w-5" />
                    Upload Project
                  </Button>
                </Link>
              )) : (
                <Link href="/login" className="no-underline">
                  <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">
                    <BookOpen className="h-5 w-5" />
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Gold decorative wave along the bottom edge */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 w-full"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          style={{ height: "56px" }}
        >
          <path fill="#c9a227" fillOpacity="0.9" d="M0,64 C240,118 480,4 720,34 C960,64 1200,118 1440,60 L1440,120 L0,120 Z" />
          <path fill="#f3d77a" fillOpacity="0.35" d="M0,88 C240,120 480,50 720,66 C960,82 1200,120 1440,90 L1440,120 L0,120 Z" />
        </svg>
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
              { icon: Upload, title: "Project Upload", desc: "Capstone advisers submit documents with full metadata; the librarian reviews them before publishing." },
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
      <section className="py-12 bg-gradient-to-r from-[#0b1830] via-[#153567] to-[#0b1830] text-white">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
              { icon: FileText, label: "Archived Projects", value: "100+" },
              { icon: Users, label: "Active Students", value: "50+" },
              { icon: FolderOpen, label: "Categories", value: "5" },
              { icon: GraduationCap, label: "School Years", value: "10+" },
            ].map((stat, i) => (
              <div key={i}>
                <stat.icon className="h-8 w-8 mx-auto mb-2 text-[#f3d77a]" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
