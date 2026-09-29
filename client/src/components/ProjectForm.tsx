import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Loader2, Upload as UploadIcon, X } from "lucide-react";
import { containsEmojis, EMOJI_TITLE_MESSAGE, isValidSchoolYear, SCHOOL_YEAR_MESSAGE } from "@shared/validation";
import { UPLOAD_ACCEPT, UPLOAD_HINT, formatFileSize, readFileForUpload, validateUploadFile } from "@/lib/fileUpload";

export type ProjectFormValues = {
  title: string;
  abstract: string;
  categoryId: number;
  adviser: string;
  members: string;
  features?: string;
  research?: string;
  schoolYear: string;
};

export type ProjectFileData = { fileName: string; fileType: string; base64: string };

type Props = {
  initial?: Partial<ProjectFormValues>;
  /** Name of the document already attached (when editing). */
  existingFileName?: string | null;
  /** A document to attach from the start (e.g. a PDF made in the Document Scanner). */
  initialFile?: File | null;
  submitLabel: string;
  submittingLabel?: string;
  onSubmit: (values: ProjectFormValues, fileData?: ProjectFileData) => Promise<unknown>;
};

/** The project details form used for new uploads and for fixing/resubmitting a project. */
export default function ProjectForm({ initial, existingFileName, initialFile, submitLabel, submittingLabel = "Uploading... Please wait", onSubmit }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [abstract, setAbstract] = useState(initial?.abstract ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ? String(initial.categoryId) : "");
  const [adviser, setAdviser] = useState(initial?.adviser ?? "");
  const [members, setMembers] = useState(initial?.members ?? "");
  const [features, setFeatures] = useState(initial?.features ?? "");
  const [research, setResearch] = useState(initial?.research ?? "");
  const [schoolYear, setSchoolYear] = useState(initial?.schoolYear ?? "");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [titleError, setTitleError] = useState("");
  const [schoolYearError, setSchoolYearError] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = trpc.categories.list.useQuery();

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setTitleError(containsEmojis(value) ? EMOJI_TITLE_MESSAGE : "");
  };

  const handleFileChange = (selected: File | null) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!selected) return;
    const error = validateUploadFile(selected);
    if (error) {
      setFile(null);
      setFileError(error);
      toast.error(error);
      return;
    }
    setFileError("");
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (containsEmojis(title)) {
      setTitleError(EMOJI_TITLE_MESSAGE);
      toast.error(EMOJI_TITLE_MESSAGE);
      return;
    }
    if (!categoryId || !title.trim() || !abstract.trim() || !adviser.trim() || !members.trim() || !schoolYear.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isValidSchoolYear(schoolYear)) {
      setSchoolYearError(SCHOOL_YEAR_MESSAGE);
      toast.error(SCHOOL_YEAR_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      const fileData = file ? await readFileForUpload(file) : undefined;
      await onSubmit({
        title: title.trim(),
        abstract: abstract.trim(),
        categoryId: Number(categoryId),
        adviser: adviser.trim(),
        members: members.trim(),
        features: features.trim() || undefined,
        research: research.trim() || undefined,
        schoolYear: schoolYear.trim(),
      }, fileData);
    } catch (err: any) {
      const message: string = err?.message || "Failed to submit project";
      if (message.toLowerCase().includes("emoji")) setTitleError(EMOJI_TITLE_MESSAGE);
      toast.error(message.includes("Unexpected token") || message.includes("JSON")
        ? "Upload failed. The file may be too large (maximum 50 MB)."
        : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Project Title *</Label>
        <Input
          id="title"
          placeholder="Enter your project title"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          required
          maxLength={255}
          disabled={isSubmitting}
          className={titleError ? "border-red-500" : ""}
        />
        {titleError && <p className="text-sm text-red-500">{titleError}</p>}
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
          <SelectTrigger aria-label="Category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories && categories.length > 0 ? (
              categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No categories yet. Ask an admin to add one.</div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adviser">Adviser *</Label>
        <Input id="adviser" placeholder="Enter adviser name" value={adviser} onChange={e => setAdviser(e.target.value)} required maxLength={255} disabled={isSubmitting} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="members">Team Members *</Label>
        <Textarea id="members" placeholder="List all team members (one per line)" rows={3} value={members} onChange={e => setMembers(e.target.value)} required disabled={isSubmitting} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Key Features</Label>
        <Textarea id="features" placeholder="e.g., Responsive design, REST API, Real-time chat, AI-powered search" rows={3} value={features} onChange={e => setFeatures(e.target.value)} disabled={isSubmitting} />
        <p className="text-xs text-muted-foreground">Optional — Describe the key features of your project</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="research">Research Topic / Area</Label>
        <Textarea id="research" placeholder="e.g., Machine Learning, IoT, Blockchain, Cloud Computing" rows={3} value={research} onChange={e => setResearch(e.target.value)} disabled={isSubmitting} />
        <p className="text-xs text-muted-foreground">Optional — Describe the research area or topic</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schoolYear">School Year *</Label>
        <Input
          id="schoolYear"
          placeholder="e.g., 2025-2026"
          value={schoolYear}
          onChange={e => { setSchoolYear(e.target.value); setSchoolYearError(""); }}
          onBlur={() => schoolYear.trim() && !isValidSchoolYear(schoolYear) && setSchoolYearError(SCHOOL_YEAR_MESSAGE)}
          required
          disabled={isSubmitting}
          className={schoolYearError ? "border-red-500" : ""}
        />
        {schoolYearError && <p className="text-sm text-red-500">{schoolYearError}</p>}
      </div>

      <div className="space-y-2">
        <Label>Document Attachment (PDF, DOCX, or ZIP)</Label>
        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${fileError ? "border-red-400" : "border-border hover:border-primary/50"}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
            disabled={isSubmitting}
            data-testid="file-input"
          />
          <FileUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          {file ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground break-all">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                  Change File
                </Button>
                <Button type="button" variant="ghost" size="sm" className="gap-1 text-red-600" onClick={() => setFile(null)} disabled={isSubmitting}>
                  <X className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <>
              {existingFileName && (
                <p className="text-sm text-foreground mb-2">
                  Current file: <span className="font-medium break-all">{existingFileName}</span>
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                {existingFileName ? "Replace File" : "Choose File"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">{UPLOAD_HINT}</p>
            </>
          )}
          {fileError && <p className="text-sm text-red-500 mt-2">{fileError}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" size="lg" disabled={isSubmitting || !!titleError}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {submittingLabel}
          </>
        ) : (
          <>
            <UploadIcon className="h-5 w-5" />
            {submitLabel}
          </>
        )}
      </Button>
    </form>
  );
}
