import { eq, and, desc, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, categories, projects, bookmarks, downloadRequests, activityLogs,
  type Category, type Project, type Bookmark, type DownloadRequest, type ActivityLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import fs from "node:fs";
import path from "node:path";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// =============================================================================
// FILE-BACKED LOCAL JSON STORE FALLBACK FOR LOCALHOST TESTING
// =============================================================================
const JSON_DB_PATH = path.resolve(process.cwd(), "local_db.json");

interface LocalDbSchema {
  users: any[];
  categories: any[];
  projects: any[];
  bookmarks: any[];
  downloadRequests: any[];
  activityLogs: any[];
}

// In-memory cache to prevent constant disk I/O and Windows file locking issues
let memoryDb: LocalDbSchema | null = null;

function loadLocalDb(): LocalDbSchema {
  if (memoryDb) return memoryDb;

  if (!fs.existsSync(JSON_DB_PATH)) {
    const initialDb: LocalDbSchema = {
      users: [],
      categories: [
        { id: 1, name: "Research", description: "Academic research projects", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 2, name: "Software Engineering", description: "Software development artifacts", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      projects: [],
      bookmarks: [],
      downloadRequests: [],
      activityLogs: []
    };
    try {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
    } catch (err) {
      console.error("[Database] Failed to create local_db.json:", err);
    }
    memoryDb = initialDb;
    return initialDb;
  }

  try {
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, "utf-8"));
    memoryDb = data;
    return data;
  } catch (err) {
    console.error("[Database] Failed to read local_db.json, using empty state:", err);
    const fallback = { users: [], categories: [], projects: [], bookmarks: [], downloadRequests: [], activityLogs: [] };
    memoryDb = fallback;
    return fallback;
  }
}

function saveLocalDb() {
  if (!memoryDb) return;
  try {
    // Using synchronous write for simplicity in this fallback layer
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (err) {
    console.error("[Database] Failed to save to local_db.json:", err);
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!u) return undefined;
    return { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) };
  }
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    let existing = data.users.find(u => u.openId === user.openId);
    if (!existing && user.email) {
      existing = data.users.find(u => u.email && u.email.toLowerCase() === user.email?.toLowerCase());
    }

    const signedInAt = user.lastSignedIn ? new Date(user.lastSignedIn).toISOString() : new Date().toISOString();

    let role = user.role;
    if (role === undefined) {
      const isFirstUser = data.users.length === 0;
      if (user.openId === ENV.ownerOpenId || user.openId === "dev-admin-openid" || isFirstUser) {
        role = 'admin';
      } else if (existing) {
        role = existing.role;
      } else {
        role = 'user';
      }
    }

    if (existing) {
      if (user.openId) existing.openId = user.openId;
      if (user.name !== undefined && user.name !== null) existing.name = user.name;
      if (user.email !== undefined && user.email !== null) existing.email = user.email;
      if (user.loginMethod !== undefined && user.loginMethod !== null) existing.loginMethod = user.loginMethod;
      existing.lastSignedIn = signedInAt;
      if (role !== undefined) existing.role = role;
      if (user.status !== undefined) existing.status = user.status;
      existing.updatedAt = new Date().toISOString();
    } else {
      const id = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id,
        openId: user.openId,
        name: user.name ?? "Google User",
        email: user.email ?? "",
        loginMethod: user.loginMethod ?? "google",
        role: role || 'user',
        status: user.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: signedInAt
      };
      data.users.push(newUser);
    }
    saveLocalDb();
    return;
  }

  try {
    const existingByOpenId = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    let existingUser = existingByOpenId[0];
    if (!existingUser && user.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
      existingUser = existingByEmail[0];
    }

    const signedInAt = user.lastSignedIn ? new Date(user.lastSignedIn) : new Date();

    if (existingUser) {
      const updateData: Record<string, any> = {
        openId: user.openId,
        lastSignedIn: signedInAt,
        updatedAt: new Date(),
      };
      if (user.name !== undefined && user.name !== null) updateData.name = user.name;
      if (user.email !== undefined && user.email !== null) updateData.email = user.email;
      if (user.loginMethod !== undefined && user.loginMethod !== null) updateData.loginMethod = user.loginMethod;
      if (user.role !== undefined) updateData.role = user.role;
      if (user.status !== undefined) updateData.status = user.status;

      await db.update(users).set(updateData).where(eq(users.id, existingUser.id));
    } else {
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const isFirstUser = userCount[0]?.count === 0;

      let role = user.role;
      if (!role) {
        role = (user.openId === ENV.ownerOpenId || isFirstUser) ? 'admin' : 'user';
      }

      await db.insert(users).values({
        openId: user.openId,
        name: user.name ?? "Google User",
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? "google",
        role: role,
        status: user.status || 'active',
        lastSignedIn: signedInAt,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.openId === openId);
    if (!u) return undefined;
    return { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) };
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.users.map(u => ({ ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.id === id);
    if (!u) return undefined;
    return { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) };
  }
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserStatus(userId: number, status: 'active' | 'inactive' | 'suspended') {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.id === userId);
    if (u) {
      u.status = status;
      u.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.id === userId);
    if (u) {
      u.role = role;
      u.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

// Categories
export async function getAllCategories() {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.categories.map(c => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const c = data.categories.find(c => c.id === id);
    if (!c) return undefined;
    return { ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) };
  }
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(name: string, description?: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    if (data.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Category already exists");
    }
    const id = data.categories.length > 0 ? Math.max(...data.categories.map(c => c.id)) + 1 : 1;
    data.categories.push({
      id,
      name,
      description: description || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveLocalDb();
    return id;
  }
  const result = await db.insert(categories).values({ name, description: description || null }).$returningId();
  return result[0]?.id;
}

export async function updateCategory(id: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const c = data.categories.find(c => c.id === id);
    if (c) {
      if (data.categories.some(o => o.id !== id && o.name.toLowerCase() === name.toLowerCase())) {
        throw new Error("Category name already exists");
      }
      c.name = name;
      c.description = description || null;
      c.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(categories).set({ name, description: description || null, updatedAt: new Date() }).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    data.categories = data.categories.filter(c => c.id !== id);
    saveLocalDb();
    return;
  }
  await db.delete(categories).where(eq(categories.id, id));
}

// Projects
export async function getAllProjects() {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.projects.map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getApprovedProjects() {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.projects.filter(p => p.status === 'approved').map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(projects).where(eq(projects.status, 'approved')).orderBy(desc(projects.createdAt));
}

export async function getPendingProjects() {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.projects.filter(p => p.status === 'pending').map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(projects).where(eq(projects.status, 'pending')).orderBy(desc(projects.createdAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const p = data.projects.find(p => p.id === id);
    if (!p) return undefined;
    return { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) };
  }
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function searchProjects(query?: string, categoryId?: number, author?: string, adviser?: string, schoolYear?: string, features?: string, research?: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    let res = data.projects.filter(p => p.status === 'approved');
    if (query) {
      const q = query.toLowerCase();
      res = res.filter(p => p.title.toLowerCase().includes(q) || (p.abstract && p.abstract.toLowerCase().includes(q)));
    }
    if (categoryId) res = res.filter(p => p.categoryId === categoryId);
    if (author) res = res.filter(p => p.members && p.members.toLowerCase().includes(author.toLowerCase()));
    if (adviser) res = res.filter(p => p.adviser && p.adviser.toLowerCase().includes(adviser.toLowerCase()));
    if (schoolYear) res = res.filter(p => p.schoolYear === schoolYear);
    if (features) res = res.filter(p => p.features && p.features.toLowerCase().includes(features.toLowerCase()));
    if (research) res = res.filter(p => p.research && p.research.toLowerCase().includes(research.toLowerCase()));
    return res.map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })).sort((a, b) => b.id - a.id);
  }

  let conditions = [eq(projects.status, 'approved')];
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      sql`(LOWER(${projects.title}) LIKE ${pattern} OR LOWER(${projects.abstract}) LIKE ${pattern})`
    );
  }
  if (categoryId) conditions.push(eq(projects.categoryId, categoryId));
  if (author) conditions.push(sql`LOWER(${projects.members}) LIKE ${`%${author.toLowerCase()}%`}`);
  if (adviser) conditions.push(sql`LOWER(${projects.adviser}) LIKE ${`%${adviser.toLowerCase()}%`}`);
  if (schoolYear) conditions.push(eq(projects.schoolYear, schoolYear));
  if (features) conditions.push(sql`LOWER(${projects.features}) LIKE ${`%${features.toLowerCase()}%`}`);
  if (research) conditions.push(sql`LOWER(${projects.research}) LIKE ${`%${research.toLowerCase()}%`}`);
  return db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt));
}

export async function createProject(data: {
  title: string; abstract: string; categoryId: number; adviser: string;
  members: string; features?: string; research?: string; schoolYear: string;
  fileUrl?: string; fileKey?: string; fileName?: string; fileType?: string; uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const id = store.projects.length > 0 ? Math.max(...store.projects.map(p => p.id)) + 1 : 1;
    store.projects.push({
      id,
      title: data.title,
      abstract: data.abstract,
      categoryId: data.categoryId,
      adviser: data.adviser,
      members: data.members,
      features: data.features || null,
      research: data.research || null,
      schoolYear: data.schoolYear,
      fileUrl: data.fileUrl || null,
      fileKey: data.fileKey || null,
      fileName: data.fileName || null,
      fileType: data.fileType || null,
      uploadedBy: data.uploadedBy,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveLocalDb();
    return id;
  }

  const result = await db.insert(projects).values({
    title: data.title,
    abstract: data.abstract,
    categoryId: data.categoryId,
    adviser: data.adviser,
    members: data.members,
    features: data.features || null,
    research: data.research || null,
    schoolYear: data.schoolYear,
    fileUrl: data.fileUrl || null,
    fileKey: data.fileKey || null,
    fileName: data.fileName || null,
    fileType: data.fileType || null,
    uploadedBy: data.uploadedBy,
    status: 'pending',
  }).$returningId();
  return result[0]?.id;
}

export async function updateProject(id: number, data: Partial<{
  title: string; abstract: string; categoryId: number; adviser: string;
  members: string; features: string; research: string; schoolYear: string; fileUrl: string; fileKey: string;
  fileName: string; fileType: string; status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string;
}>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const p = store.projects.find(p => p.id === id);
    if (p) {
      Object.assign(p, data);
      p.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    store.projects = store.projects.filter(p => p.id !== id);
    saveLocalDb();
    return;
  }
  await db.delete(projects).where(eq(projects.id, id));
}

// Bookmarks
export async function getUserBookmarks(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const projectIds = store.bookmarks.filter(b => b.userId === userId).map(b => b.projectId);
    return store.projects.filter(p => projectIds.includes(p.id)).map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) }));
  }
  const bms = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
  const projectIds = bms.map(b => b.projectId);
  if (projectIds.length === 0) return [];
  return db.select().from(projects).where(sql`${projects.id} IN (${sql.join(projectIds.map(id => sql.raw(String(id))), sql`, `)})`);
}

export async function getBookmark(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const b = store.bookmarks.find(b => b.userId === userId && b.projectId === projectId);
    if (!b) return undefined;
    return { ...b, createdAt: new Date(b.createdAt) };
  }
  const result = await db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.projectId, projectId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function toggleBookmark(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const idx = store.bookmarks.findIndex(b => b.userId === userId && b.projectId === projectId);
    if (idx !== -1) {
      store.bookmarks.splice(idx, 1);
      saveLocalDb();
      return false;
    }
    const id = store.bookmarks.length > 0 ? Math.max(...store.bookmarks.map(b => b.id)) + 1 : 1;
    store.bookmarks.push({ id, userId, projectId, createdAt: new Date().toISOString() });
    saveLocalDb();
    return true;
  }
  const existing = await getBookmark(userId, projectId);
  if (existing) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
    return false;
  }
  await db.insert(bookmarks).values({ userId, projectId });
  return true;
}

// Download Requests
export async function getAllDownloadRequests() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.downloadRequests.map(d => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(downloadRequests).orderBy(desc(downloadRequests.createdAt));
}

export async function getPendingDownloadRequests() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.downloadRequests.filter(d => d.status === 'pending').map(d => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(downloadRequests).where(eq(downloadRequests.status, 'pending')).orderBy(desc(downloadRequests.createdAt));
}

export async function getApprovedDownloadRequests(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.downloadRequests.filter(d => d.userId === userId && d.status === 'approved').map(d => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) }));
  }
  return db.select().from(downloadRequests).where(and(eq(downloadRequests.userId, userId), eq(downloadRequests.status, 'approved')));
}

export async function getUserDownloadRequests(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.downloadRequests
      .filter(d => d.userId === userId)
      .map(d => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) }))
      .sort((a, b) => b.id - a.id);
  }
  return db.select().from(downloadRequests).where(eq(downloadRequests.userId, userId)).orderBy(desc(downloadRequests.createdAt));
}

export async function createDownloadRequest(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    let existing = store.downloadRequests.find(d => d.userId === userId && d.projectId === projectId);
    if (existing) {
      if (existing.status === 'pending') return existing.id;
      existing.status = 'pending';
      existing.adminNote = null;
      existing.updatedAt = new Date().toISOString();
      saveLocalDb();
      return existing.id;
    }
    const id = store.downloadRequests.length > 0 ? Math.max(...store.downloadRequests.map(d => d.id)) + 1 : 1;
    store.downloadRequests.push({
      id, projectId, userId, status: 'pending', adminNote: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    saveLocalDb();
    return id;
  }
  
  const existing = await db.select().from(downloadRequests).where(and(eq(downloadRequests.userId, userId), eq(downloadRequests.projectId, projectId))).limit(1);
  if (existing.length > 0) {
    if (existing[0].status === 'pending') return existing[0].id;
    await db.update(downloadRequests).set({ status: 'pending', adminNote: null, updatedAt: new Date() }).where(eq(downloadRequests.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(downloadRequests).values({ userId, projectId }).$returningId();
  return result[0]?.id;
}

export async function updateDownloadRequest(id: number, status: 'approved' | 'rejected', adminNote?: string) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const d = store.downloadRequests.find(d => d.id === id);
    if (d) {
      d.status = status;
      d.adminNote = adminNote || null;
      d.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(downloadRequests).set({ status, adminNote: adminNote || null, updatedAt: new Date() }).where(eq(downloadRequests.id, id));
}

// Activity Logs
export async function createActivityLog(data: {
  userId?: number; action: string; description?: string;
  entityType?: string; entityId?: number;
}) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const id = store.activityLogs.length > 0 ? Math.max(...store.activityLogs.map(a => a.id)) + 1 : 1;
    store.activityLogs.push({
      id, userId: data.userId || null, action: data.action, description: data.description || null,
      entityType: data.entityType || null, entityId: data.entityId || null, createdAt: new Date().toISOString()
    });
    saveLocalDb();
    return;
  }
  await db.insert(activityLogs).values({
    userId: data.userId || null,
    action: data.action,
    description: data.description || null,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
  });
}

export async function getAllActivityLogs() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.activityLogs.map(a => ({ ...a, createdAt: new Date(a.createdAt) })).sort((a, b) => b.id - a.id).slice(0, 200);
  }
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(200);
}

export async function getRecentActivityLogs(limit: number = 10) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.activityLogs.map(a => ({ ...a, createdAt: new Date(a.createdAt) })).sort((a, b) => b.id - a.id).slice(0, limit);
  }
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

// Dashboard stats
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const approvedP = store.projects.filter(p => p.status === 'approved').length;
    const pendingU = store.projects.filter(p => p.status === 'pending').length;
    const pendingD = store.downloadRequests.filter(d => d.status === 'pending').length;
    const studentsCount = store.users.filter(u => u.role === 'user').length;
    return {
      totalUsers: store.users.length,
      totalStudents: studentsCount,
      totalProjects: approvedP,
      pendingUploads: pendingU,
      pendingDownloads: pendingD,
    };
  }
  const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  const studentsCountResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'user'));
  const totalProjects = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, 'approved'));
  const pendingUploads = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, 'pending'));
  const pendingDownloads = await db.select({ count: sql<number>`count(*)` }).from(downloadRequests).where(eq(downloadRequests.status, 'pending'));
  return {
    totalUsers: totalUsersResult[0]?.count || 0,
    totalStudents: studentsCountResult[0]?.count || 0,
    totalProjects: totalProjects[0]?.count || 0,
    pendingUploads: pendingUploads[0]?.count || 0,
    pendingDownloads: pendingDownloads[0]?.count || 0,
  };
}

// Get project counts by category for dashboard charts
export async function getProjectCountsByCategory() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const approved = store.projects.filter(p => p.status === 'approved');
    const countsMap: Record<number, number> = {};
    approved.forEach(p => {
      countsMap[p.categoryId] = (countsMap[p.categoryId] || 0) + 1;
    });
    return Object.keys(countsMap).map(catId => ({
      categoryId: Number(catId),
      count: countsMap[Number(catId)]
    }));
  }
  const result = await db.select({
    categoryId: projects.categoryId,
    count: sql<number>`count(*)`,
  }).from(projects).where(eq(projects.status, 'approved')).groupBy(projects.categoryId);
  return result;
}

// Get school years from existing projects
export async function getSchoolYears() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const distinct = Array.from(new Set(store.projects.map(p => p.schoolYear))).sort();
    return distinct;
  }
  const result = await db.selectDistinct({ schoolYear: projects.schoolYear }).from(projects).orderBy(projects.schoolYear);
  return result.map(r => r.schoolYear);
}
