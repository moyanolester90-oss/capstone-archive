import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure, protectedProcedure, router,
} from "./_core/trpc";
import {
  getAllUsers, getUserById, updateUserStatus, updateUserRole,
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getAllProjects, getApprovedProjects, getPendingProjects, getProjectById,
  searchProjects, createProject, updateProject, deleteProject,
  getUserBookmarks, toggleBookmark, getApprovedDownloadRequests, getUserDownloadRequests,
  createDownloadRequest, getAllDownloadRequests, getPendingDownloadRequests, updateDownloadRequest,
  createActivityLog, getAllActivityLogs, getRecentActivityLogs,
  getDashboardStats, getSchoolYears, getProjectCountsByCategory, upsertUser, getUserByOpenId,
} from "./db";
import { storagePut } from "./storage";
import { z } from "zod";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ CATEGORIES ============
  categories: router({
    list: publicProcedure.query(() => getAllCategories()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getCategoryById(input.id)),
    create: adminProcedure.input(z.object({
      name: z.string().min(1, "Category name cannot be empty").max(100),
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
      id: z.number(), name: z.string().min(1, "Category name cannot be empty").max(100), description: z.string().max(500).optional(),
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
      await deleteCategory(input.id);
      await createActivityLog({ userId: ctx.user!.id, action: 'category_deleted', description: `Deleted category id: ${input.id}`, entityType: 'category', entityId: input.id });
      return { success: true };
    }),
  }),

  // ============ PROJECTS ============
  projects: router({
    list: publicProcedure.query(() => getApprovedProjects()),
    all: adminProcedure.query(() => getAllProjects()),
    pending: adminProcedure.query(() => getPendingProjects()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) return undefined;
      // Only approved projects are visible to the public; admins and the uploader can see all
      if (project.status === 'approved') return project;
      if (ctx.user && (ctx.user.role === 'admin' || ctx.user.id === project.uploadedBy)) return project;
      return undefined;
    }),
    search: publicProcedure.input(z.object({
      query: z.string().optional(),
      categoryId: z.number().optional(),
      author: z.string().optional(),
      adviser: z.string().optional(),
      schoolYear: z.string().optional(),
      features: z.string().optional(),
      research: z.string().optional(),
    })).query(({ input }) => searchProjects(input.query, input.categoryId, input.author, input.adviser, input.schoolYear, input.features, input.research)),
    create: protectedProcedure.input(z.object({
      title: z.string().min(1).max(255).refine(
        (val) => {
          // Reject any character outside BMP that looks like an emoji
          for (let i = 0; i < val.length; i++) {
            const code = val.codePointAt(i);
            if (code !== undefined && code >= 0x1F000) return false;
          }
          // Reject BMP-range emoji/symbol characters:
          // Misc Symbols (2600-26FF), Dingbats (2700-27BF), Var Selectors (FE00-FEFF),
          // Enclosed Characters (2400-24FF), Block Elements (2500-257F),
          // Geometric Shapes (25A0-25FF), Braille (2800-28FF), CJK Symbols (3000-303F)
          const BMP_SYMBOL_RANGES: Array<[number, number]> = [
            [0x2600, 0x26FF], // Misc Symbols
            [0x2700, 0x27BF], // Dingbats
            [0xFE00, 0xFE0F], // Variation Selectors (emoji presentation)
            [0x2500, 0x257F], // Box Drawing
            [0x25A0, 0x25FF], // Geometric Shapes
            [0x2400, 0x24FF], // Control Pictures
            [0x2800, 0x28FF], // Braille
            [0x3000, 0x303F], // CJK Symbols and Punctuation
          ];
          for (const char of val) {
            const cp = char.codePointAt(0);
            if (cp === undefined) continue;
            for (const [start, end] of BMP_SYMBOL_RANGES) {
              if (cp >= start && cp <= end) return false;
            }
          }
          return true;
        },
        "Project title must not contain emojis"
      ),
      abstract: z.string().min(1),
      categoryId: z.number(),
      adviser: z.string().min(1).max(255),
      members: z.string().min(1),
      features: z.string().optional(),
      research: z.string().optional(),
      schoolYear: z.string().min(1).max(20).refine(val => /^\d{4}-\d{4}$/.test(val), "School Year must be in the format YYYY-YYYY (e.g., 2024-2025)"),
      fileData: z.object({
        fileName: z.string(),
        fileType: z.string(),
        base64: z.string(),
      }).optional(),
    })).mutation(async ({ ctx, input }) => {
      let fileUrl: string | undefined;
      let fileKey: string | undefined;
      let fileName: string | undefined;
      let fileType: string | undefined;

      if (input.fileData) {
        const buffer = Buffer.from(input.fileData.base64, 'base64');
        const safeFileName = input.fileData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const s3Key = `projects/${ctx.user!.id}/${Date.now()}-${safeFileName}`;
        const result = await storagePut(s3Key, buffer, input.fileData.fileType);
        fileUrl = result.url;
        fileKey = result.key;
        fileName = input.fileData.fileName;
        fileType = input.fileData.fileType;
      }

      const projectId = await createProject({
        title: input.title,
        abstract: input.abstract,
        categoryId: input.categoryId,
        adviser: input.adviser,
        members: input.members,
        features: input.features,
        research: input.research,
        schoolYear: input.schoolYear,
        fileUrl, fileKey, fileName, fileType,
        uploadedBy: ctx.user!.id,
      });

      await createActivityLog({
        userId: ctx.user!.id,
        action: 'project_uploaded',
        description: `Uploaded project: ${input.title}`,
        entityType: 'project',
        entityId: projectId,
      });

      return { success: true, projectId };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      abstract: z.string().optional(),
      categoryId: z.number().optional(),
      adviser: z.string().max(255).optional(),
      members: z.string().optional(),
      features: z.string().optional(),
      research: z.string().optional(),
      schoolYear: z.string().max(20).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateProject(id, data);
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_updated',
        description: `Updated project: ${input.title || 'id:' + id}`,
        entityType: 'project', entityId: id,
      });
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      await deleteProject(input.id);
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_deleted',
        description: `Deleted project: ${project?.title || 'id:' + input.id}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true };
    }),
    approve: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await updateProject(input.id, { status: 'approved', rejectionReason: undefined });
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_approved',
        description: `Approved project: ${input.id}`,
        entityType: 'project', entityId: input.id,
      });
      return { success: true };
    }),
    reject: adminProcedure.input(z.object({
      id: z.number(), reason: z.string().min(1).max(500),
    })).mutation(async ({ ctx, input }) => {
      await updateProject(input.id, { status: 'rejected', rejectionReason: input.reason });
      await createActivityLog({
        userId: ctx.user!.id, action: 'project_rejected',
        description: `Rejected project: ${input.id} - ${input.reason}`,
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
      const isBookmarked = await toggleBookmark(ctx.user!.id, input.projectId);
      await createActivityLog({
        userId: ctx.user!.id,
        action: isBookmarked ? 'bookmark_added' : 'bookmark_removed',
        description: `${isBookmarked ? 'Bookmarked' : 'Unbookmarked'} project: ${input.projectId}`,
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
      const id = await createDownloadRequest(ctx.user!.id, input.projectId);
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_requested',
        description: `Requested download for project: ${input.projectId}`,
        entityType: 'download_request', entityId: id,
      });
      return { success: true, id };
    }),
    approve: adminProcedure.input(z.object({
      id: z.number(), adminNote: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await updateDownloadRequest(input.id, 'approved', input.adminNote);
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_approved',
        description: `Approved download request: ${input.id}`,
        entityType: 'download_request', entityId: input.id,
      });
      return { success: true };
    }),
    reject: adminProcedure.input(z.object({
      id: z.number(), adminNote: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await updateDownloadRequest(input.id, 'rejected', input.adminNote);
      await createActivityLog({
        userId: ctx.user!.id, action: 'download_rejected',
        description: `Rejected download request: ${input.id}`,
        entityType: 'download_request', entityId: input.id,
      });
      return { success: true };
    }),
  }),

  // ============ ACTIVITY LOGS ============
  activityLogs: router({
    list: adminProcedure.query(() => getAllActivityLogs()),
    recent: publicProcedure.query(() => getRecentActivityLogs(10)),
  }),

  // ============ USERS (ADMIN) ============
  users: router({
    list: adminProcedure.query(() => getAllUsers()),
    get: adminProcedure.input(z.object({ id: z.number() })).query(({ input }) => getUserById(input.id)),
    updateStatus: adminProcedure.input(z.object({
      userId: z.number(), status: z.enum(['active', 'inactive', 'suspended']),
    })).mutation(async ({ ctx, input }) => {
      await updateUserStatus(input.userId, input.status);
      await createActivityLog({
        userId: ctx.user!.id, action: 'user_status_updated',
        description: `Updated user status for user ${input.userId} to ${input.status}`,
        entityType: 'user', entityId: input.userId,
      });
      return { success: true };
    }),
    updateRole: adminProcedure.input(z.object({
      userId: z.number(), role: z.enum(['user', 'admin']),
    })).mutation(async ({ ctx, input }) => {
      await updateUserRole(input.userId, input.role);
      await createActivityLog({
        userId: ctx.user!.id, action: 'user_role_updated',
        description: `Updated role for user ${input.userId} to ${input.role}`,
        entityType: 'user', entityId: input.userId,
      });
      return { success: true };
    }),
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
    logSuspiciousActivity: protectedProcedure.input(z.object({
      projectId: z.number().optional(),
      reason: z.string(),
    })).mutation(async ({ ctx, input }) => {
      await createActivityLog({
        userId: ctx.user!.id,
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
