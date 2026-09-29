import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

// UPLOADS_DIR can be overridden (tests use a temporary folder).
const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  // 1. If Forge API is configured, upload via Forge presigned S3 URL
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    try {
      const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
      const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
      presignUrl.searchParams.set("path", key);

      const presignResp = await fetch(presignUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (presignResp.ok) {
        const { url: s3Url } = (await presignResp.json()) as { url: string };
        if (s3Url) {
          const blob = typeof data === "string"
            ? new Blob([data], { type: contentType })
            : new Blob([data as any], { type: contentType });

          const uploadResp = await fetch(s3Url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: blob,
          });

          if (uploadResp.ok) {
            return { key, url: `/manus-storage/${key}` };
          }
        }
      }
    } catch (error) {
      console.warn("[Storage] Forge upload failed, falling back to local disk storage:", error);
    }
  }

  // 2. Default / Local Disk Storage: Save directly to ./uploads directory
  const filePath = path.join(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    throw new Error("Invalid storage path");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await fs.writeFile(filePath, buffer);

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

/**
 * Reads a stored file's raw bytes server-side (for the protected in-app
 * document viewer, which never hands the browser a directly-navigable URL).
 */
export async function storageGetBytes(relKey: string): Promise<Buffer | null> {
  const key = normalizeKey(relKey);
  const filePath = path.resolve(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR + path.sep) && filePath !== UPLOADS_DIR) return null;
  try {
    return await fs.readFile(filePath);
  } catch {
    // Not on local disk — try the optional Forge/S3 storage.
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const url = await storageGetSignedUrl(key);
        const resp = await fetch(url);
        if (resp.ok) return Buffer.from(await resp.arrayBuffer());
      } catch {
        /* fall through to null */
      }
    }
    return null;
  }
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    try {
      const getUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
      getUrl.searchParams.set("path", key);

      const resp = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (resp.ok) {
        const { url } = (await resp.json()) as { url: string };
        if (url) return url;
      }
    } catch {
      /* fallback to local proxy */
    }
  }

  return `/manus-storage/${key}`;
}


/**
 * Removes a stored file from local disk storage. Missing files are ignored.
 * (Files kept on the optional Forge/S3 storage are left in place.)
 */
export async function storageDelete(relKey: string | null | undefined): Promise<void> {
  if (!relKey) return;
  const key = normalizeKey(relKey);
  const filePath = path.resolve(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) return;
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      console.warn("[Storage] Could not delete file:", key, err?.message || err);
    }
  }
}
