import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";
import { sdk } from "./sdk";
import * as db from "../db";

// UPLOADS_DIR can be overridden (tests use a temporary folder).
const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // ENFORCE SERVER-SIDE ACCESS CONTROL & APPROVAL WORKFLOW
    try {
      // 1. Authenticate the request to find the logged-in user
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) {
        res.status(401).send("Unauthorized: Please sign in to access files.");
        return;
      }

      // 2. Look up the project related to this file key to check authorization rules
      const allProjects = await db.getAllProjects();
      const normalizedKey = key.replace(/^\/+/, "");

      const project = allProjects.find(p => {
        const fileKey = p.fileKey ? p.fileKey.replace(/^\/+/, "") : "";
        const fileUrl = p.fileUrl || "";
        return (fileKey !== "" && fileKey === normalizedKey) || fileUrl === `/manus-storage/${normalizedKey}`;
      });

      const isAdmin = user.role === 'admin';

      if (project) {
        // This raw file route is a true download of the original file. It is
        // open to: the librarian, the project's own uploader, and an adviser
        // who has an admin-approved download request for this project.
        // Students never get raw file bytes this way, even with an approved
        // request — they view the document through the app's protected
        // in-app viewer instead (see the `projects.viewDocument` tRPC
        // procedure), which never hands out a fetchable URL.
        const isOwner = user.id === project.uploadedBy;
        let isApprovedAdviser = false;
        if (!isAdmin && !isOwner && user.role === 'adviser') {
          const approved = await db.getApprovedDownloadRequests(user.id);
          isApprovedAdviser = approved.some(r => r.projectId === project.id);
        }

        if (!isAdmin && !isOwner && !isApprovedAdviser) {
          res.status(403).send("Forbidden: request download access from the librarian, or view the approved document through the in-app viewer.");
          return;
        }

        // Log successful access/download
        await db.createActivityLog({
          userId: user.id,
          action: 'document_accessed',
          description: `Accessing protected file: ${project.fileName || key} for project ${project.id}`,
          entityType: 'project',
          entityId: project.id,
        }).catch(err => console.error("[StorageProxy] Logging failed:", err));
      } else if (!isAdmin && (normalizedKey.startsWith("projects/") || normalizedKey.includes("/projects/"))) {
        // If file path is a project document but no matching project record found, block non-admins
        res.status(403).send("Forbidden: Download access requires approval from an administrator.");
        return;
      }
    } catch (authErr) {
      console.error("[StorageProxy] Authorization check failed:", authErr);
      res.status(500).send("Internal server error during authorization check.");
      return;
    }

    // Sanitize path to prevent directory traversal
    const localFilePath = path.resolve(UPLOADS_DIR, key.replace(/^\/+/, ""));

    // 1. If local file exists, serve directly from disk with anti-cache headers
    if (localFilePath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(localFilePath)) {
      res.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.sendFile(localFilePath);
      return;
    }

    // 2. Fallback: If file is missing locally, check Forge API if configured
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const forgeUrl = new URL(
          "v1/storage/presign/get",
          ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
        );
        forgeUrl.searchParams.set("path", key);

        const forgeResp = await fetch(forgeUrl, {
          headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        });

        if (forgeResp.ok) {
          const { url } = (await forgeResp.json()) as { url: string };
          if (url) {
            res.set("Cache-Control", "no-store");
            res.redirect(307, url);
            return;
          }
        }
      } catch (err) {
        console.error("[StorageProxy] Forge fallback error:", err);
      }
    }

    res.status(404).send("File not found");
  });
}
