import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Upload as UploadIcon, FileUp, Loader2, LogIn } from "lucide-react";

/**
 * Checks if a string contains emoji characters across both BMP and supplementary planes.
 * Returns true if emojis are found.
 */
function containsEmojis(str: string): boolean {
  // Check supplementary-plane codepoints (>= 0x1F000)
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    if (code !== undefined && code >= 0x1F000) return true;
  }
  // Check BMP-range emoji/symbol characters
  const BMP_SYMBOL_RANGES: Array<[number, number]> = [
    [0x2600, 0x26FF], // Misc Symbols
    [0x2700, 0x27BF], // Dingbats
    [0xFE00, 0xFE0F], // Variation Selectors
    [0x2500, 0x257F], // Box Drawing
    [0x25A0, 0x25FF], // Geometric Shapes
    [0x2400, 0x24FF], // Control Pictures
    [0x2800, 0x28FF], // Braille
    [0x3000, 0x303F], // CJK Symbols and Punctuation
  ];
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    for (const [start, end] of BMP_SYMBOL_RANGES) {
      if (cp >= start && cp <= end) return true;
    }
  }
  return false;
}

export default function UploadPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [adviser, setAdviser] = useState("");
  const [members, setMembers] = useState("");
  const [features, setFeatures] = useState("");
  const [research, setResearch] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [titleError, setTitleError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = trpc.categories.list.useQuery();

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      setIsSubmitting(false);
      toast.success("Project submitted for review!");
      navigate("/browse");
    },
    onError: (err) => {
      setIsSubmitting(false);
      // Show emoji validation error from server as a toast
      if (err.message.includes("emoji")) {
        toast.error(err.message);
        setTitleError("Project title must not contain emojis");
      } else {
        toast.error(err.message || "Failed to upload project");
      }
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to upload capstone projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/login")} className="gap-2">
              <LogIn className="h-4 w-4" /> Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate title does not contain emojis
    if (containsEmojis(title)) {
      setTitleError("Project title must not contain emojis");
      toast.error("Project title must not contain emojis");
      return;
    }
    setTitleError("");

    if (!categoryId || !title || !abstract || !adviser || !members || !schoolYear) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate School Year format: YYYY-YYYY
    const schoolYearRegex = /^\d{4}-\d{4}$/;
    if (!schoolYearRegex.test(schoolYear)) {
      toast.error("School Year must be in the format YYYY-YYYY (e.g., 2024-2025)");
      return;
    }

    setIsSubmitting(true);

    let fileData: { fileName: string; fileType: string; base64: string } | undefined;

    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only PDF, DOCX, and ZIP files are allowed");
        setIsSubmitting(false);
        return;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      fileData = { fileName: file.name, fileType: file.type, base64 };
    }

    createProject.mutate({
      title,
      abstract,
      categoryId: Number(categoryId),
      adviser,
      members,
      features: features || undefined,
      research: research || undefined,
      schoolYear,
      fileData,
    });
  };

  // Validate title on change
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (containsEmojis(value)) {
      setTitleError("Project title must not contain emojis");
    } else {
      setTitleError("");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Upload Capstone Project</h1>
        <p className="text-muted-foreground mb-8">Submit your capstone project for review and archiving.</p>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Fill in all required fields and attach your document.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter your project title"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className={titleError ? "border-red-500" : ""}
                />
                {titleError && (
                  <p className="text-sm text-red-500">{titleError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="abstract">Abstract *</Label>
                <Textarea
                  id="abstract"
                  placeholder="Write a brief abstract of your project"
                  rows={5}
                  value={abstract}
                  onChange={e => setAbstract(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={categoryId} onValueChange={setCategoryId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories && categories.length > 0 ? (
                      categories.map(cat => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none">No categories available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adviser">Adviser *</Label>
                <Input
                  id="adviser"
                  placeholder="Enter adviser name"
                  value={adviser}
                  onChange={e => setAdviser(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="members">Team Members *</Label>
                <Textarea
                  id="members"
                  placeholder="List all team members (one per line)"
                  rows={3}
                  value={members}
                  onChange={e => setMembers(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Key Features</Label>
                <Textarea
                  id="features"
                  placeholder="e.g., Responsive design, REST API, Real-time chat, AI-powered search"
                  rows={3}
                  value={features}
                  onChange={e => setFeatures(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">Optional — Describe the key features of your project</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="research">Research Topic / Area</Label>
                <Textarea
                  id="research"
                  placeholder="e.g., Machine Learning, IoT, Blockchain, Cloud Computing"
                  rows={3}
                  value={research}
                  onChange={e => setResearch(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">Optional — Describe the research area or topic</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolYear">School Year *</Label>
                <Input
                  id="schoolYear"
                  placeholder="e.g., 2025-2026"
                  value={schoolYear}
                  onChange={e => setSchoolYear(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Document Attachment (PDF, DOCX, or ZIP)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.zip"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <FileUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  {file ? (
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                        Choose File
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, or ZIP (max 50MB)</p>
                    </>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isSubmitting || !!titleError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploading... Please wait
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-5 w-5" />
                    Submit Project for Review
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
