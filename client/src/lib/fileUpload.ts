import {
  ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, UPLOAD_MIME_BY_EXTENSION,
  getFileExtension, isAllowedUploadFile,
} from "@shared/validation";

export const UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.join(",");
export const UPLOAD_HINT = `PDF, DOCX, or ZIP (max ${MAX_UPLOAD_MB} MB)`;

/** Returns an error message if the file can't be uploaded, or null if it's fine. */
export function validateUploadFile(file: File): string | null {
  if (!isAllowedUploadFile(file.name)) return "Only PDF, DOCX, and ZIP files are allowed";
  if (file.size === 0) return "The selected file is empty";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum size is ${MAX_UPLOAD_MB} MB`;
  }
  return null;
}

/** Reads a file into the { fileName, fileType, base64 } shape the API expects. */
export function readFileForUpload(file: File): Promise<{ fileName: string; fileType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (!result) return reject(new Error("Could not read the selected file"));
      resolve({
        fileName: file.name,
        // Browsers report ZIP files differently (e.g. Windows uses application/x-zip-compressed),
        // so the type is decided from the extension.
        fileType: UPLOAD_MIME_BY_EXTENSION[getFileExtension(file.name)] || file.type || "application/octet-stream",
        base64: result.split(",")[1] ?? "",
      });
    };
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
