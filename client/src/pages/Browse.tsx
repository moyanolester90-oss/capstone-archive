import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search, Calendar, User, FolderOpen, BookOpen, Loader2, FlaskConical, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Watermark from "@/components/Watermark";
import { useAuth } from "@/_core/hooks/useAuth";
import ContentProtection from "@/components/ContentProtection";

export default function Browse() {
  const { user } = useAuth();
  // Students get the copy/print/screenshot protection; advisers and the librarian don't.
  const isStudent = user?.role === "student";
  // The dashboard search box opens /browse?q=...
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [author, setAuthor] = useState("");
  const [adviser, setAdviser] = useState("");
  const [schoolYear, setSchoolYear] = useState<string>("");
  const [features, setFeatures] = useState("");
  const [research, setResearch] = useState("");

  const { data: projects, isLoading } = trpc.projects.search.useQuery({
    query: query || undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    author: author || undefined,
    adviser: adviser || undefined,
    schoolYear: schoolYear || undefined,
    features: features || undefined,
    research: research || undefined,
  }, { staleTime: 30000 });

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: schoolYears } = trpc.projects.schoolYears.useQuery();

  const searchParams = useMemo(() => ({
    query, categoryId, author, adviser, schoolYear, features, research,
  }), [query, categoryId, author, adviser, schoolYear, features, research]);

  const hasFilters = query || categoryId || author || adviser || schoolYear || features || research;

  const resetFilters = () => {
    setQuery(""); setCategoryId(""); setAuthor(""); setAdviser(""); setSchoolYear(""); setFeatures(""); setResearch("");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container">
        <ContentProtection enabled={isStudent}>
        <Watermark>
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Browse Capstone Projects</h1>
          <p className="text-muted-foreground">Search and filter archived capstone projects</p>
        </div>

        {/* Search & Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Keyword Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or keywords..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Row 1: Category, Author, Adviser, School Year */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Author / Member"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                />
                <Input
                  placeholder="Adviser"
                  value={adviser}
                  onChange={e => setAdviser(e.target.value)}
                />
                <Select value={schoolYear} onValueChange={setSchoolYear}>
                  <SelectTrigger className="gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="School Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears?.map(yr => (
                      <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: Features and Research */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by features (e.g., responsive, REST API, real-time)"
                    value={features}
                    onChange={e => setFeatures(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by research topic (e.g., machine learning, IoT)"
                    value={research}
                    onChange={e => setResearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const cat = categories?.find(c => c.id === project.categoryId);
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="no-underline">
                  <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {cat?.name || "Uncategorized"}
                        </span>
                        <span className="text-xs text-muted-foreground">{project.schoolYear}</span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{project.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{project.abstract}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{project.adviser}</span>
                        {project.features && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            <span className="line-clamp-1">{project.features}</span>
                          </span>
                        )}
                        {project.research && (
                          <span className="flex items-center gap-1">
                            <FlaskConical className="h-3 w-3" />
                            <span className="line-clamp-1">{project.research}</span>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No projects found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search filters</p>
          </div>
        )}
        </Watermark>
        </ContentProtection>
      </div>
    </div>
  );
}
