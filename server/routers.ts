import { COOKIE_NAME, ONE_YEAR_MS, PORTAL_ROLE } from "@shared/const";
import {
  MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ALLOWED_UPLOAD_EXTENSIONS, UPLOAD_MIME_BY_EXTENSION,
  base64DecodedSize, containsEmojis, getFileExtension, isAllowedUploadFile, isValidSchoolYear,
  EMOJI_TITLE_MESSAGE, SCHOOL_YEAR_MESSAGE,
  SCHOOL_ID_PATTERN, SCHOOL_ID_MESSAGE, PASSWORD_PATTERN, PASSWORD_MESSAGE,
  SCHOOL_EMAIL_PATTERN, SCHOOL_EMAIL_MESSAGE, NAME_PATTERN, NAME_MESSAGE, YEAR_SECTION_MESSAGE,
} from "@shared/validation";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure, protectedProcedure, router,
} from "./_core/trpc";
import {
  getAllUsers, getUserById, updateUserStatus, updateUserName, updateUserPassword, countActiveAdmins,
  getUserBySchoolId, getUserByName, createUserWithCredentials,
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory, countProjectsInCategory,
  getAllProjects, getApprovedProjects, getPendingProjects, getProjectById, getProjectsByUploader,
  searchProjects, createProject, updateProject, deleteProject,
  getUserBookmarks, toggleBookmark, getApprovedDownloadRequests, getUserDownloadRequests,
  createDownloadRequest, getAllDownloadRequests, getPendingDownloadRequests, updateDownloadRequest,
  createActivityLog, getAllActivityLogs, getRecentActivityLogs,
  getDashboardStats, getSchoolYears, getProjectCountsByCategory,
} from "./db";
import { storageDelete, storageGetBytes, storagePut } from "./storage";
import { z } from "zod";

/** Librarian/admin only. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

/** Capstone advisers and admins: may upload capstones. Students may only browse and search. */
const uploaderProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin' && ctx.user?.role !== 'adviser') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only capstone advisers and the librarian can upload or edit capstones' });
  }
  return next({ ctx });
});

const ROLE_LABELS = { student: 'Student', adviser: 'Adviser', admin: 'Admin/Librarian' } as const;
/** Matches the tab labels shown on the Login page. */
const PORTAL_TAB_LABELS = { student: 'Student', adviser: 'Adviser', admin: 'Librarian' } as const;

// ---------- Shared input rules ----------

const titleSchema = z.string().trim().min(1, "Project title is required").max(255)
  .refine(val => !containsEmojis(val), EMOJI_TITLE_MESSAGE);

const schoolYearSchema = z.string().trim().max(20)
  .refine(isValidSchoolYear, SCHOOL_YEAR_MESSAGE);

const fileDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().max(200),
  base64: z.string().min(1),
}).refine(f => isAllowedUploadFile(f.fileName), {
  message: `Only ${ALLOWED_UPLOAD_EXTENSIONS.join(", ").toUpperCase().replace(/\./g, "")} files are allowed`,
}).refine(f => base64DecodedSize(f.base64) <= MAX_UPLOAD_BYTES, {
  message: `File is too large. The maximum size is ${MAX_UPLOAD_MB} MB`,
});

const projectFieldsSchema = z.object({
  title: titleSchema,
  abstract: z.string().trim().min(1, "Abstract is required"),
  categoryId: z.number().int().positive(),
  adviser: z.string().trim().min(1, "Adviser is required").max(255),
  members: z.string().trim().min(1, "Team members are required"),
  features: z.string().optional(),
  research: z.string().optional(),
  schoolYear: schoolYearSchema,
});

/** Never send the password hash to the browser. */
function sanitizeUser<T extends { passwordHash?: string | null } | null | undefined>(user: T) {
  if (!user) return user;
  const { passwordHash, ...rest } = user;
  return rest;
}

/** Signs a session token for `user` and sets it as the browser's session cookie. */
async function setSessionCookie(ctx: TrpcContext, user: { openId: string; name: string | null }) {
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "User",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

/** Creates an account from the Sign Up form, logs it, and signs the new user in. */
async function signUpAndLogIn(ctx: TrpcContext, input: {
  schoolId: string; password: string; name: string; role: 'student' | 'adviser' | 'admin';
  yearSection: string | null; email: string | null;
}) {
  const passwordHash = await hashPassword(input.password);
  let created: { id: number; openId: string };
  try {
    created = await createUserWithCredentials({
      schoolId: input.schoolId, passwordHash, name: input.name, role: input.role,
      email: input.email, yearSection: input.yearSection,
    });
  } catch (error: any) {
    if (error?.message === 'SCHOOL_ID_TAKEN' || error?.message === 'NAME_TAKEN') {
      throw new TRPCError({ code: 'CONFLICT', message: 'You have an existing account.' });
    }
    throw error;
  }
  await createActivityLog({
    userId: created.id,
    action: 'user_signup',
    description: `New ${ROLE_LABELS[input.role]} account created: ${input.name} (${input.schoolId})`,
    entityType: 'user',
    entityId: created.id,
  });
  await setSessionCookie(ctx, { openId: created.openId, name: input.name });
  return { success: true } as const;
}

/**
 * Students never receive the raw document URL — only the librarian, the
 * project's own uploader, and an adviser with an admin-approved *download*
 * request may actually fetch the original file. Everyone else gets the
 * project without `fileUrl`/`fileKey`, so the only way to see the document
 * is the protected in-app viewer below. `fileKey` is stripped for everyone
 * but admin/owner regardless — the client never needs it directly, since
 * `projects.viewDocument` looks it up server-side by project id.
 *
 * `hasDocument` is always included (even when the URL itself is stripped)
 * so the UI can still show the "Request to View"/"Request to Download"
 * button for a project that has an attachment, without needing the URL.
 */
function sanitizeProjectFile<T extends { fileUrl: string | null; fileKey: string | null; uploadedBy: number }>(
  project: T, viewerId: number | undefined, isAdmin: boolean, hasApprovedDownload = false,
): T & { hasDocument: boolean } {
  const hasDocument = !!project.fileUrl;
  if (isAdmin || viewerId === project.uploadedBy) return { ...project, hasDocument };
  if (hasApprovedDownload) return { ...project, fileKey: null, hasDocument };
  return { ...project, fileUrl: null, fileKey: null, hasDocument };
}

/** Project ids the (adviser) viewer has an admin-approved download request for. Empty set for guests/students. */
async function getApprovedDownloadProjectIds(userId: number | undefined): Promise<Set<number>> {
  if (!userId) return new Set();
  const approved = await getApprovedDownloadRequests(userId);
  return new Set(approved.map(r => r.projectId));
}

async function assertCategoryExists(categoryId: number) {
  const category = await getCategoryById(categoryId);
  if (!category) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please choose a valid category' });
  }
}

/** Saves an uploaded document and returns the stored file details. */
async function saveProjectFile(userId: number, fileData: z.infer<typeof fileDataSchema>) {
  const buffer = Buffer.from(fileData.base64, 'base64');
  const ext = getFileExtension(fileData.fileName);
  const safeFileName = fileData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileType = UPLOAD_MIME_BY_EXTENSION[ext] || 'application/octet-stream';
  const s3Key = `projects/${userId}/${Date.now()}-${safeFileName}`;
  const result = await storagePut(s3Key, buffer, fileType);
  return { fileUrl: result.url, fileKey: result.key, fileName: fileData.fileName, fileType };
}

/** Stops an admin from demoting, suspending or deactivating the last active admin (or themselves). */
async function assertAdminChangeAllowed(actingUserId: number, targetUserId: number, removesAdminAccess: boolean) {
  if (!removesAdminAccess) return;
  if (actingUserId === targetUserId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot remove your own admin access or deactivate your own account' });
  }
  const target = await getUserById(targetUserId);
  if (target?.role === 'admin' && (target.status ?? 'active') === 'active' && (await countActiveAdmins()) <= 1) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one active admin account is required' });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Lets the sign-up form warn the person before they submit, so they
     * don't fill out the whole form only to be rejected at the end. This is
     * a convenience check only — createUserWithCredentials (via signUpAndLogIn)
     * is the actual, authoritative check the submit itself relies on, so a
     * race between two people signing up at once is still caught correctly.
     */
    checkAvailability: publicProcedure.input(z.object({
      schoolId: z.string().trim().optional(),
      name: z.string().trim().optional(),
    })).query(async ({ input }) => {
      const [schoolIdTaken, nameTaken] = await Promise.all([
        input.schoolId ? getUserBySchoolId(input.schoolId).then(u => !!u) : Promise.resolve(false),
        input.name ? getUserByName(input.name).then(u => !!u) : Promise.resolve(false),
      ]);
      return { available: !schoolIdTaken && !nameTaken, schoolIdTaken, nameTaken };
    }),

    /** Student sign-up: School ID, password, Name, Year & Section. Logs the new account in. */
    signupStudent: publicProcedure.input(z.object({
      schoolId: z.string().trim().regex(SCHOOL_ID_PATTERN, SCHOOL_ID_MESSAGE),
      password: z.string().regex(PASSWORD_PATTERN, PASSWORD_MESSAGE),
      name: z.string().trim().regex(NAME_PATTERN, NAME_MESSAGE).max(255),
      yearSection: z.string().trim().min(1, YEAR_SECTION_MESSAGE).max(100),
    })).mutation(({ ctx, input }) => signUpAndLogIn(ctx, {
      schoolId: input.schoolId, password: input.password, name: input.name,
      role: 'student', yearSection: input.yearSection, email: null,
    })),

    /**
     * Adviser/Librarian sign-up: same fields, plus a school email and which of
     * the two roles the signer-upper is. Whichever role they pick on the form
     * (Adviser or Librarian/Admin) is exactly what gets saved — sign-up never
     * silently changes the chosen role.
     */
    signupStaff: publicProcedure.input(z.object({
      schoolId: z.string().trim().regex(SCHOOL_ID_PATTERN, SCHOOL_ID_MESSAGE),
      password: z.string().regex(PASSWORD_PATTERN, PASSWORD_MESSAGE),
      name: z.string().trim().regex(NAME_PATTERN, NAME_MESSAGE).max(255),
      email: z.string().trim().toLowerCase().regex(SCHOOL_EMAIL_PATTERN, SCHOOL_EMAIL_MESSAGE),
      role: z.enum(['adviser', 'admin']),
    })).mutation(async ({ ctx, input }) => {
      return signUpAndLogIn(ctx, {
        schoolId: input.schoolId, password: input.password, name: input.name,
        role: input.role, yearSection: null, email: input.email,
      });
    }),

    /** Credential sign-in: School ID + password, checked against the chosen portal's role. */
    login: publicProcedure.input(z.object({
      schoolId: z.string().trim().min(1, "School ID is required"),
      password: z.string().min(1, "Password is required"),
      portal: z.enum(['student', 'adviser', 'admin']),
    })).mutation(async ({ ctx, input }) => {
      const GENERIC_ERROR = 'Incorrect School ID or password';
      const user = await getUserBySchoolId(input.schoolId);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: GENERIC_ERROR });
      }
      if (user.status !== 'active') {
        throw new TRPCError({ code: 'FORBIDDEN', message: `Your account is ${user.status}. Please contact the librarian.` });
      }
      if (user.role !== PORTAL_ROLE[input.portal]) {
        const actualLabel = ROLE_LABELS[user.role];
        const tabLabel = PORTAL_TAB_LABELS[user.role];
        const article = /^[aeiou]/i.test(actualLabel) ? 'an' : 'a';
        await createActivityLog({
          userId: user.id, action: 'login_wrong_portal',
          description: `${user.name || user.schoolId} (${actualLabel}) tried the ${input.portal} login`,
          entityType: 'user', entityId: user.id,
        });
        throw new TRPCError({ code: 'FORBIDDEN', message: `Your account is ${article} ${actualLabel} account. Please use the ${tabLabel} tab to sign in.` });
      }
      await createActivityLog({
        userId: user.id, action: 'user_login',
        description: `User logged in: ${user.name || user.schoolId}`,
        entityType: 'user', entityId: user.id,
      });
      await setSessionCookie(ctx, { openId: user.openId, name: user.name });
      return { success: true } as const;
    }),

    /** Any signed-in user (Student, Adviser or Admin/Librarian) may rename their own account. */
    updateName: protectedProcedure.input(z.object({
      name: z.string().trim().regex(NAME_PATTERN, NAME_MESSAGE).max(255),
    })).mutation(async ({ ctx, input }) => {
      await updateUserName(ctx.user!.id, input.name);
      await createActivityLog({
        userId: ctx.user!.id, action: 'profile_updated',
        description: `${ctx.user!.name || ctx.user!.schoolId} updated their name to ${input.name}`,
        entityType: 'user', entityId: ctx.user!.id,
      });
      return { success: true } as const;
    }),

    /** Any signed-in user (Student, Adviser or Admin/Librarian) may change their own password. */
    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().regex(PASSWORD_PATTERN, PASSWORD_MESSAGE),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user!.id);
      if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }
      const passwordHash = await hashPassword(input.newPassword);
      await updateUserPassword(ctx.user!.id, passwordHash);
      await createActivityLog({
        userId: ctx.user!.id, action: 'password_changed',
        description: `${user.name || user.schoolId} changed their password`,
        entityType: 'user', entityId: ctx.user!.id,
      });
      return { success: true } as const;
    }),
  }),

  // ============ CATEGORIES ============
  categories: router({
    list: publicProcedure.query(() => getAllCategories()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getCategoryById(input.id)),
    create: adminProcedure.input(z.object({
      name: z.string().trim().min(1, "Category name cannot be empty").max(100),
      description: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const id = await createCategory(input.name.trim(), input.description?.trim());
        await createActivityLog({ userId: ctx.user!.id, action: 'category_created', description: `Created category: ${input.name}`, entityType: 'category', entityId: id });
        return { success: true, id };
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("already exists") || err.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: 'CONFLICT', message: 'Category with this name already exists' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to create category' });
      }
    }),
    update: adminProcedure.input(z.object({
      id: z.number(), name: z.string().trim().min(1, "Category name cannot be empty").max(100), description: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        await updateCategory(input.id, input.name.trim(), input.description?.trim());
        await createActivityLog({ userId: ctx.user!.id, action: 'category_updated', description: `Updated category: ${input.name}`, entityType: 'category', entityId: input.id });
        return { success: true };
      } catch (err: any) {
        if (err.message?.toLowerCase().includes("already exists") || err.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: 'CONFLICT', message: 'Category with this name already exists' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to update category' });
      }
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const inUse = await countProjectsInCategory(input.id);
      if (inUse > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `This category is used by ${inUse} project${inUse === 1 ? '' : 's'}. Move ${inUse === 1 ? 'it' : 'them'} to another category first.`,
        });
      }
      const category = await getCategoryById(input.id);
      await deleteCategory(input.id);
      await createActivityLog({ userId: ctx.user!.id, action: 'category_deleted', description: `Deleted category: ${category?.name || 'id:' + input.id}`, entityType: 'category', entityId: input.id });
      return { success: true };
    }),
  }),

  // ============ PROJECTS ============
  projects: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const projects = await getApprovedProjects();
      const approvedIds = await getApprovedDownloadProjectIds(ctx.user?.id);
      const isAdviser = ctx.user?.role === 'adviser';
      return projects.map(p => sanitizeProjectFile(p, ctx.user?.id, ctx.user?.role === 'admin', isAdviser && approvedIds.has(p.id)));
    }),
    all: adminProcedure.query(() => getAllProjects()),
    pending: adminProcedure.query(() => getPendingProjects()),
    /** The signed-in adviser's own uploads, with their review status. */
    mine: uploaderProcedure.query(({ ctx }) => getProjectsByUploader(ctx.user!.id)),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) return null;
      const isAdmin = ctx.user?.role === 'admin';
      // Only approved projects are visible to the public; admins and the uploader can see all
      if (project.status === 'approved') {
        const approvedIds = await getApprovedDownloadProjectIds(ctx.user?.id);
        const isAdviser = ctx.user?.role === 'adviser';
        return sanitizeProjectFile(project, ctx.user?.id, isAdmin, isAdviser && approvedIds.has(project.id));
      }
      if (ctx.user && (isAdmin || ctx.user.id === project.uploadedBy)) return { ...project, hasDocument: !!project.fileUrl };
      return null;
    }),
    search: publicProcedure.input(z.object({
      query: z.string().optional(),
      categoryId: z.number().optional(),
      author: z.string().optional(),
      adviser: z.string().optional(),
      schoolYear: z.string().optional(),
      features: z.string().optional(),
      research: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      const projects = await searchProjects(input.query, input.categoryId, input.author, input.adviser, input.schoolYear, input.features, input.research);
      const approvedIds = await getApprovedDownloadProjectIds(ctx.user?.id);
      const isAdviser = ctx.user?.role === 'adviser';
      return projects.map(p => sanitizeProjectFile(p, ctx.user?.id, ctx.user?.role === 'admin', isAdviser && approvedIds.has(p.id)));
    }),
    /**
     * View-only access for the protected in-app document viewer: returns the
     * file's raw bytes as base64 (never a fetchable URL) to the librarian, the
     * project's own uploader, or a student with an approved view request.
     * Only PDFs can be rendered in the viewer; other file types are refused
     * here (the librarian/uploader still has the ordinary download for those).
     */
    viewDocument: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.status !== 'approved') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (!project.fileKey) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This project has no document to view' });
      }
      const isAdmin = ctx.user!.role === 'admin';
      const isOwner = ctx.user!.id === project.uploadedBy;
      if (!isAdmin && !isOwner) {
        const approved = await getApprovedDownloadRequests(ctx.user!.id);
        const hasApproval = approved.some(r => r.projectId === project.id);
        if (!hasApproval) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'View access requires approval from the librarian' });
        }
      }
      if (project.fileType !== 'application/pdf') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'In-browser preview is only available for PDF documents' });
      }
      const bytes = await storageGetBytes(project.fileKey);
      if (!bytes) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'The stored document could not be found' });
      }
      await createActivityLog({
        userId: ctx.user!.id, action: 'document_viewed',
        description: `Viewed document for project: ${project.title}`,
        entityType: 'project', entityId: project.id,
      });
      return { fileName: project.fileName, base64: bytes.toString('base64') };
    }),
    create: uploaderProcedure.input(projectFieldsSchema.extend({
      fileData: fileDataSchema.optional(),
    })).mutation(async ({ ctx, input }) => {
      await assertCategoryExists(input.categoryId);
      const file = input.fileData ? await saveProjectFile(ctx.user!.id, input.fileData) : undefined;
      // Adviser uploads wait for the librarian's approval; the librarian's own uploads are published directly.
      const isAdmin = ctx.user!.role === 'admin';

      const projectId = await createProject({
        title: input.title,
        abstract: input.abstract,
        categoryId: input.categoryId,
        adviser: input.adviser,
        members: input.members,
        features: input.features,
        research: input.research,
        schoolYear: input.schoolYear.trim(),
        ...file,
        uploadedBy: ctx.user!.id,
        status: isAdmin ? 'approved' : 'pending',
      });

      await createActivityLog({
        userId: ctx.user!.id,
        action: 'project_uploaded',
        description: `Uploaded project${isAdmin ? '' : ' for review'}: ${input.title}`,
        entityType: 'project',
        entityId: projectId,
      });

      return { success: true, projectId, status: isAdmin ? 'approved' as const : 'pending' as const };
    }),
    /**
     * Lets a capstone adviser update a capstone they uploaded (fix a rejected one,
     * or update an approved one). The change goes back to the librarian for review.
     */
    resubmit: uploaderProcedure.input(projectFieldsSchema.extend({
      id: z.number(),
      fileData: fileDataSchema.optional(),
    })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.uploadedBy !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      await assertCategoryExists(input.categoryId);
      const isAdmin = ctx.user!.role === 'admin';

      const file = input.fileData ? await saveProjectFile(ctx.user!.id, input.fileData) : undefined;
      const { id, fileData, ...fields } = input;
      await updateProject(id, {
        ...fields,
        schoolYear: fields.schoolYear.trim(),
        features: fields.features ?? '',
        research: fields.research ?? '',
        ...file,
        status: isAdmin ? 'approved' : 'pending',
        rejectionReason: null,
      });
      if (file && project.fileKey) await storageDelete(project.fileKey);

      await createActivityLog({
        userId: ctx.user!.id, action: project.status === 'approved' ? 'project_updated' : 'project_resubmitted',
        description: `${project.status === 'approved' ? 'Updated' : 'Resubmitted'} project${isAdmin ? '' : ' for review'}: ${input.title}`,
        entityType: 'project', entityId: id,
      });
      return { success: true };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      title: titleSchema.optional(),
      abstract: z.string().trim().min(1).optional(),
      categoryId: z.number().int().positive().optional(),
      adviser: z.string().trim().min(1).max(255).optional(),
      members: z.string().trim().min(1).optional(),
      features: z.string().optional(),
      research: z.string().optional(),
      schoolYear: schoolYearSchema.optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await getProjectById(id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      if (data.categoryId !== undefined) await assertCategoryExists(data.categoryId);
      await updateProject(id, data);
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_updated',
        description: `Updated project: ${input.title || project.title}`,
        entityType: 'project', entityId: id,
      });
      return { success: true };
    }),
    /**
     * Admin/librarian only: replace a capstone's document, e.g. with a PDF made
     * from a scanned hard copy in the Document Scanner.
     */
    replaceFile: adminProcedure.input(z.object({
      id: z.number(),
      fileData: fileDataSchema,
      source: z.enum(['scanner', 'upload']).default('upload'),
    })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      const file = await saveProjectFile(ctx.user!.id, input.fileData);
      await updateProject(input.id, file);
      if (project.fileKey && project.fileKey !== file.fileKey) await storageDelete(project.fileKey);
      await createActivityLog({
        userId: ctx.user!.id, action: input.source === 'scanner' ? 'document_scanned' : 'project_file_replaced',
        description: `${input.source === 'scanner' ? 'Attached scanned PDF to' : 'Replaced document of'}: ${project.title}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true, fileName: file.fileName };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      await deleteProject(input.id);
      await storageDelete(project.fileKey);
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_deleted',
        description: `Deleted project: ${project.title}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true };
    }),
    approve: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      await updateProject(input.id, { status: 'approved', rejectionReason: null });
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_approved',
        description: `Approved project: ${project.title}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true };
    }),
    reject: adminProcedure.input(z.object({
      id: z.number(), reason: z.string().trim().min(1, "Please give a reason").max(500),
    })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      await updateProject(input.id, { status: 'rejected', rejectionReason: input.reason });
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_rejected',
        description: `Rejected project: ${project.title} - ${input.reason}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true };
    }),
    schoolYears: publicProcedure.query(() => getSchoolYears()),
  }),

  // ============ BOOKMARKS ============
  bookmarks: router({
    list: protectedProcedure.query(({ ctx }) => getUserBookmarks(ctx.user!.id)),
    toggle: protectedProcedure.input(z.object({ projectId: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.status !== 'approved') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Only approved projects can be saved to favorites' });
      }
      const isBookmarked = await toggleBookmark(ctx.user!.id, input.projectId);
      await createActivityLog({
        userId: ctx.user!.id,
        action: isBookmarked ? 'bookmark_added' : 'bookmark_removed',
        description: `${isBookmarked ? 'Bookmarked' : 'Unbookmarked'} project: ${project.title}`,
        entityType: 'project', entityId: input.projectId,
      });
      return { isBookmarked };
    }),
    isBookmarked: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ ctx, input }) => {
      const bm = await getUserBookmarks(ctx.user!.id);
      return bm.some(p => p.id === input.projectId);
    }),
  }),

  // ============ DOWNLOAD REQUESTS ============
  downloadRequests: router({
    list: adminProcedure.query(() => getAllDownloadRequests()),
    pending: adminProcedure.query(() => getPendingDownloadRequests()),
    myApproved: protectedProcedure.query(({ ctx }) => getApprovedDownloadRequests(ctx.user!.id)),
    myRequests: protectedProcedure.query(({ ctx }) => getUserDownloadRequests(ctx.user!.id)),
    create: protectedProcedure.input(z.object({ projectId: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.status !== 'approved') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (!project.fileUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This project has no document available' });
      }
      if (project.uploadedBy === ctx.user!.id || ctx.user!.role === 'admin') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You already have access to this document' });
      }
      // Students may only ever request to VIEW a document in the protected
      // in-app viewer; advisers (who are not the project's own uploader) may
      // request an actual DOWNLOAD of the original file. Both share the same
      // approval queue/table — what the approval unlocks is decided by the
      // requester's fixed role at read time (see storageProxy.ts and
      // projects.viewDocument), never by anything the client sends.
      const id = await createDownloadRequest(ctx.user!.id, input.projectId);
      const requestKind = ctx.user!.role === 'adviser' ? 'download' : 'view';
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_requested',
        description: `Requested to ${requestKind} project: ${project.title}`,
        entityType: 'download_request', entityId: id,
      });
      return { success: true, id };
    }),
    approve: adminProcedure.input(z.object({
      id: z.number(), adminNote: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      await updateDownloadRequest(input.id, 'approved', input.adminNote);
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_approved',
        description: `Approved request #${input.id}`,
        entityType: 'download_request', entityId: input.id,
      });
      return { success: true };
    }),
    reject: adminProcedure.input(z.object({
      id: z.number(), adminNote: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      await updateDownloadRequest(input.id, 'rejected', input.adminNote);
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_rejected',
        description: `Rejected request #${input.id}`,
        entityType: 'download_request', entityId: input.id,
      });
      return { success: true };
    }),
  }),

  // ============ NOTIFICATIONS ============
  notifications: router({
    /**
     * In-app notifications, built from the current state of the user's
     * submissions and requests (students) or from the review queues (admins).
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user!;
      type Notification = {
        id: string;
        kind: 'success' | 'error' | 'info';
        title: string;
        message: string;
        href: string;
        createdAt: Date;
      };
      const items: Notification[] = [];

      if (user.role === 'admin') {
        const [pendingProjects, pendingDownloads] = await Promise.all([
          getPendingProjects(), getPendingDownloadRequests(),
        ]);
        for (const p of pendingProjects) {
          items.push({
            id: `review-project-${p.id}-${new Date(p.updatedAt).getTime()}`,
            kind: 'info',
            title: 'New project to review',
            message: p.title,
            href: '/admin/archive',
            createdAt: new Date(p.updatedAt),
          });
        }
        for (const d of pendingDownloads) {
          items.push({
            id: `review-download-${d.id}-${new Date(d.updatedAt).getTime()}`,
            kind: 'info',
            title: 'New download request',
            message: `Request #${d.id} is waiting for approval`,
            href: '/admin/downloads',
            createdAt: new Date(d.updatedAt),
          });
        }
      }

      const [myProjects, myRequests, allProjects] = await Promise.all([
        getProjectsByUploader(user.id), getUserDownloadRequests(user.id), getApprovedProjects(),
      ]);
      for (const p of myProjects) {
        if (p.status === 'pending') continue;
        const approved = p.status === 'approved';
        items.push({
          id: `project-${p.id}-${p.status}-${new Date(p.updatedAt).getTime()}`,
          kind: approved ? 'success' : 'error',
          title: approved ? 'Your project was approved' : 'Your project was not approved',
          message: approved ? p.title : `${p.title}${p.rejectionReason ? ` — ${p.rejectionReason}` : ''}`,
          href: approved ? `/projects/${p.id}` : '/my-submissions',
          createdAt: new Date(p.updatedAt),
        });
      }
      for (const r of myRequests) {
        if (r.status === 'pending') continue;
        const approved = r.status === 'approved';
        const title = allProjects.find(p => p.id === r.projectId)?.title || `Project #${r.projectId}`;
        items.push({
          id: `download-${r.id}-${r.status}-${new Date(r.updatedAt).getTime()}`,
          kind: approved ? 'success' : 'error',
          title: approved ? 'Download request approved' : 'Download request declined',
          message: `${title}${!approved && r.adminNote ? ` — ${r.adminNote}` : ''}`,
          href: `/projects/${r.projectId}`,
          createdAt: new Date(r.updatedAt),
        });
      }

      return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 30);
    }),
  }),

  // ============ ACTIVITY LOGS ============
  activityLogs: router({
    list: adminProcedure.query(() => getAllActivityLogs()),
    recent: adminProcedure.query(() => getRecentActivityLogs(10)),
  }),

  // ============ USERS (ADMIN) ============
  users: router({
    list: adminProcedure.query(async () => (await getAllUsers()).map(sanitizeUser)),
    get: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => sanitizeUser(await getUserById(input.id))),
    updateStatus: adminProcedure.input(z.object({
      userId: z.number(), status: z.enum(['active', 'inactive', 'suspended']),
    })).mutation(async ({ ctx, input }) => {
      await assertAdminChangeAllowed(ctx.user!.id, input.userId, input.status !== 'active');
      await updateUserStatus(input.userId, input.status);
      const target = await getUserById(input.userId);
      await createActivityLog({
        userId: ctx.user!.id, action: 'user_status_updated',
        description: `Set ${target?.name || 'user ' + input.userId} to ${input.status}`,
        entityType: 'user', entityId: input.userId,
      });
      return { success: true };
    }),
    // Role is fixed at sign-up (Student, Adviser, or Admin/Librarian) and can never
    // be changed afterward — not even by an admin. There is intentionally no
    // updateRole endpoint here; a user's role stays as it was created.
  }),

  // ============ DASHBOARD ============
  dashboard: router({
    stats: adminProcedure.query(() => getDashboardStats()),
    categoryStats: adminProcedure.query(async () => {
      const counts = await getProjectCountsByCategory();
      const allCats = await getAllCategories();
      return allCats.map(cat => {
        const countEntry = counts.find(c => c.categoryId === cat.id);
        return { name: cat.name, value: countEntry?.count || 0 };
      });
    }),
  }),

  // ============ PROTECTION ============
  protection: router({
    // Public so the warning also works for visitors who aren't signed in (they are logged without a user).
    logSuspiciousActivity: publicProcedure.input(z.object({
      projectId: z.number().optional(),
      reason: z.string().max(300),
    })).mutation(async ({ ctx, input }) => {
      await createActivityLog({
        userId: ctx.user?.id,
        action: 'suspicious_activity',
        description: `Suspicious activity detected: ${input.reason}`,
        entityType: input.projectId ? 'project' : undefined,
        entityId: input.projectId,
      });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
