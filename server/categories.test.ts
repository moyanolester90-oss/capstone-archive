import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-test-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createStudentContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "student-test-user",
    email: "student@example.com",
    name: "Student User",
    loginMethod: "manus",
    role: "student",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthenticatedContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("categories", () => {
  it("list returns categories (public)", async () => {
    const { ctx } = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can create a category", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.create({
      name: `Test Category ${Date.now()}`,
      description: "A test category",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("student cannot create a category", async () => {
    const { ctx } = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.categories.create({ name: "Forbidden Category" })
    ).rejects.toThrow();
  });

  it("unauthenticated user cannot create a category", async () => {
    const { ctx } = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.categories.create({ name: "Forbidden Category" })
    ).rejects.toThrow();
  });
});

describe("projects", () => {
  it("list returns approved projects (public)", async () => {
    const { ctx } = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("student cannot access all projects (admin only)", async () => {
    const { ctx } = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.all()).rejects.toThrow();
  });

  it("admin can access all projects", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.all();
    expect(Array.isArray(result)).toBe(true);
  });

  it("student cannot approve projects", async () => {
    const { ctx } = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projects.approve({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("dashboard", () => {
  it("admin can access stats", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(result).toBeDefined();
    expect(result.totalUsers).toBeDefined();
    expect(result.totalProjects).toBeDefined();
    expect(result.pendingUploads).toBeDefined();
    expect(result.pendingDownloads).toBeDefined();
  });

  it("student cannot access dashboard stats", async () => {
    const { ctx } = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });
});

describe("activityLogs", () => {
  it("recent activity is private (visitors and students are refused)", async () => {
    await expect(appRouter.createCaller(createUnauthenticatedContext().ctx).activityLogs.recent()).rejects.toThrow();
    await expect(appRouter.createCaller(createStudentContext().ctx).activityLogs.recent()).rejects.toThrow();
  });

  it("admin can read recent activity", async () => {
    const result = await appRouter.createCaller(createAdminContext().ctx).activityLogs.recent();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can access all logs", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.activityLogs.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
