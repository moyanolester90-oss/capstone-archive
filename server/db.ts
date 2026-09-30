import { eq, and, desc, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser, users, categories, projects, bookmarks, downloadRequests, editRequests, activityLogs, advisers,
  type Category, type Project, type Bookmark, type DownloadRequest, type EditRequest, type ActivityLog, type Adviser,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import fs from "node:fs";
import path from "node:path";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Returns the MySQL connection when DATABASE_URL is set (see setup-database.bat),
 * or null to use the local_db.json file store.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // A remote host (e.g. Hostinger) silently drops connections that sit
      // idle for a few minutes. The default pool doesn't notice until a
      // query tries to reuse a dead connection and fails with ETIMEDOUT or
      // "connection lost" — which is exactly what looked like a random
      // "Failed query" after a few minutes of inactivity. `enableKeepAlive`
      // sends periodic TCP keep-alive packets so idle connections stay open,
      // and a short `connectTimeout` means a genuinely dead connection fails
      // fast (and gets replaced) instead of hanging.
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        connectTimeout: 10_000,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Checks that MySQL is reachable and migrated. Throws a readable error if not. */
export async function checkDatabaseConnection(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`SELECT 1 FROM ${users} LIMIT 1`);
  } catch (err: any) {
    const code = err?.cause?.code || err?.code || "";
    if (code === "ECONNREFUSED") {
      throw new Error("Cannot reach MySQL. Open the XAMPP Control Panel and click START next to MySQL.");
    }
    if (code === "ER_BAD_DB_ERROR" || code === "ER_NO_SUCH_TABLE") {
      throw new Error("The database or its tables don't exist yet. Run setup-database.bat first.");
    }
    throw new Error(`Database error: ${err?.cause?.message || err?.message || err}`);
  }
}

// =============================================================================
// FILE-BACKED LOCAL JSON STORE FALLBACK (used when DATABASE_URL is empty)
// =============================================================================
// LOCAL_DB_PATH lets tests use a throw-away file instead of the real data.
const JSON_DB_PATH = path.resolve(process.cwd(), process.env.LOCAL_DB_PATH || "local_db.json");

interface LocalDbSchema {
  users: any[];
  categories: any[];
  projects: any[];
  bookmarks: any[];
  downloadRequests: any[];
  editRequests: any[];
  activityLogs: any[];
  advisers: any[];
}

const EMPTY_TABLES: LocalDbSchema = {
  users: [], categories: [], projects: [], bookmarks: [], downloadRequests: [], editRequests: [], activityLogs: [], advisers: [],
};

/**
 * One-time, self-healing normalization pass for the local JSON store: builds
 * the `advisers` lookup table from whatever free-text `adviser` names are
 * already on `projects` (deduplicated, case/whitespace-insensitive) and
 * backfills `adviserId` on each project. Idempotent — a project that already
 * has `adviserId` is left alone, and this is a no-op once every project is
 * backfilled. This lets existing local_db.json files pick up the normalized
 * `advisers` table automatically the next time the server touches them,
 * without anyone having to run a migration command by hand.
 */
function backfillAdvisers(store: LocalDbSchema): boolean {
  let changed = false;
  const byName = new Map<string, any>(); // normalized name -> adviser row
  for (const a of store.advisers) {
    byName.set(String(a.name).trim().toLowerCase(), a);
  }
  let nextId = store.advisers.length > 0 ? Math.max(...store.advisers.map((a: any) => a.id)) + 1 : 1;

  for (const p of store.projects) {
    if (p.adviserId) continue;
    const rawName = (p.adviser || "").trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();
    let row = byName.get(key);
    if (!row) {
      row = { id: nextId++, name: rawName, createdAt: new Date().toISOString() };
      store.advisers.push(row);
      byName.set(key, row);
      changed = true;
    }
    p.adviserId = row.id;
    p.adviser = row.name; // canonicalize to the first-seen spelling
    changed = true;
  }
  return changed;
}

// In-memory cache to avoid constant disk reads. The cache is refreshed whenever
// the file on disk changes (for example when a second server window writes to it),
// so one running copy never overwrites newer data saved by another.
let memoryDb: LocalDbSchema | null = null;
let memoryDbMtimeMs = 0;

function fileMtimeMs(): number {
  try {
    return fs.statSync(JSON_DB_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

function withAllTables(data: Partial<LocalDbSchema>): LocalDbSchema {
  const merged = { ...EMPTY_TABLES, ...data } as LocalDbSchema;
  for (const key of Object.keys(EMPTY_TABLES) as (keyof LocalDbSchema)[]) {
    if (!Array.isArray(merged[key])) merged[key] = [];
  }
  return merged;
}

function loadLocalDb(): LocalDbSchema {
  const mtime = fileMtimeMs();
  if (memoryDb && mtime === memoryDbMtimeMs) return memoryDb;

  if (!fs.existsSync(JSON_DB_PATH)) {
    const now = new Date().toISOString();
    memoryDb = withAllTables({
      categories: [
        { id: 1, name: "Research", description: "Academic research projects", createdAt: now, updatedAt: now },
        { id: 2, name: "Software Engineering", description: "Software development artifacts", createdAt: now, updatedAt: now },
      ],
    });
    saveLocalDb();
    return memoryDb;
  }

  try {
    memoryDb = withAllTables(JSON.parse(fs.readFileSync(JSON_DB_PATH, "utf-8")));
    memoryDbMtimeMs = mtime;
    if (backfillAdvisers(memoryDb)) saveLocalDb();
    return memoryDb;
  } catch (err) {
    // Never silently replace the user's data with an empty database: keep the
    // last good copy in memory if we have one, and do not save over the file.
    console.error("[Database] Failed to read local_db.json:", err);
    if (memoryDb) return memoryDb;
    throw new Error("local_db.json is unreadable. Restore it from local_db.backup.json.");
  }
}

function saveLocalDb() {
  if (!memoryDb) return;
  const json = JSON.stringify(memoryDb, null, 2);
  const tmpPath = `${JSON_DB_PATH}.tmp`;
  try {
    // Keep one backup of the previous version in case something goes wrong.
    if (fs.existsSync(JSON_DB_PATH)) {
      try { fs.copyFileSync(JSON_DB_PATH, JSON_DB_PATH.replace(/\.json$/, ".backup.json")); } catch {}
    }
    // Write to a temp file first, then swap it in, so a crash mid-write can't
    // leave a half-written (corrupted) database behind.
    fs.writeFileSync(tmpPath, json, "utf-8");
    try {
      fs.renameSync(tmpPath, JSON_DB_PATH);
    } catch {
      // Windows can refuse the rename while another program has the file open.
      fs.writeFileSync(JSON_DB_PATH, json, "utf-8");
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    memoryDbMtimeMs = fileMtimeMs();
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
        role = 'student';
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
        role: role || 'student',
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
      const isFirstUser = Number(userCount[0]?.count || 0) === 0;

      let role = user.role;
      if (!role) {
        role = (user.openId === ENV.ownerOpenId || isFirstUser) ? 'admin' : 'student';
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

export async function getUserBySchoolId(schoolId: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.schoolId && u.schoolId.toLowerCase() === schoolId.toLowerCase());
    if (!u) return undefined;
    return { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) };
  }
  const result = await db.select().from(users).where(eq(users.schoolId, schoolId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Case/whitespace-insensitive name lookup, across every role — used to block duplicate accounts at sign-up. */
export async function getUserByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.name && String(u.name).trim().toLowerCase() === trimmed.toLowerCase());
    if (!u) return undefined;
    return { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt), lastSignedIn: new Date(u.lastSignedIn) };
  }
  const result = await db.select().from(users).where(sql`LOWER(${users.name}) = ${trimmed.toLowerCase()}`).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Creates a new account from the Sign Up form. Throws Error("SCHOOL_ID_TAKEN")
 * if the School ID is already registered, or Error("NAME_TAKEN") if the name
 * is already registered under any role — both are surfaced to the person as
 * "You have an existing account." (see signUpAndLogIn in server/routers.ts).
 * Checked here (not just in the tRPC layer) so this is the single choke
 * point every account-creation path goes through, local-JSON or MySQL.
 */
export async function createUserWithCredentials(input: {
  schoolId: string;
  passwordHash: string;
  name: string;
  role: 'student' | 'adviser' | 'admin';
  email?: string | null;
  yearSection?: string | null;
}): Promise<{ id: number; openId: string }> {
  const openId = `local:${input.schoolId.toLowerCase()}`;
  const trimmedName = input.name.trim();

  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    if (data.users.some(u => u.schoolId && u.schoolId.toLowerCase() === input.schoolId.toLowerCase())) {
      throw new Error("SCHOOL_ID_TAKEN");
    }
    if (data.users.some(u => u.name && String(u.name).trim().toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error("NAME_TAKEN");
    }
    const id = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
    const now = new Date().toISOString();
    data.users.push({
      id, openId, name: input.name, email: input.email ?? "", loginMethod: "credentials",
      role: input.role, status: "active", schoolId: input.schoolId, passwordHash: input.passwordHash,
      yearSection: input.yearSection ?? null, createdAt: now, updatedAt: now, lastSignedIn: now,
    });
    saveLocalDb();
    return { id, openId };
  }

  // Belt-and-suspenders check ahead of the insert (in addition to the unique
  // index) so a name collision reports cleanly as NAME_TAKEN rather than a
  // generic duplicate-entry error that we can't tell apart from schoolId.
  if (await getUserByName(trimmedName)) {
    throw new Error("NAME_TAKEN");
  }

  try {
    const result: any = await db.insert(users).values({
      openId, name: input.name, email: input.email ?? null, loginMethod: "credentials",
      role: input.role, status: "active", schoolId: input.schoolId, passwordHash: input.passwordHash,
      yearSection: input.yearSection ?? null, lastSignedIn: new Date(),
    });
    const insertId = result?.[0]?.insertId;
    return { id: Number(insertId), openId };
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(String(error?.message))) {
      const message = String(error?.message || "");
      // MySQL names the violated unique index/key in the error message.
      throw new Error(/name/i.test(message) ? "NAME_TAKEN" : "SCHOOL_ID_TAKEN");
    }
    throw error;
  }
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

export async function updateUserRole(userId: number, role: 'student' | 'adviser' | 'admin') {
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

/** Lets a signed-in user (any role) change their own display name. */
export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.id === userId);
    if (u) {
      u.name = name;
      u.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Lets a signed-in user (any role) change their own password. Caller must already have verified the current password. */
export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    const u = data.users.find(u => u.id === userId);
    if (u) {
      u.passwordHash = passwordHash;
      u.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Number of admin accounts that are currently active. */
export async function countActiveAdmins(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return loadLocalDb().users.filter(u => u.role === 'admin' && (u.status ?? 'active') === 'active').length;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  return Number(result[0]?.count || 0);
}

/**
 * Number of active admin accounts that can actually sign in (have a School ID
 * + password). Old Google/demo accounts left over from before credential
 * sign-in was added have no password and can never log in again, so they
 * must not block a fresh install's very first librarian sign-up.
 */
export async function countActiveAdminsWithLogin(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return loadLocalDb().users.filter(u => u.role === 'admin' && (u.status ?? 'active') === 'active' && u.passwordHash).length;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(
    and(eq(users.role, 'admin'), eq(users.status, 'active'), sql`${users.passwordHash} IS NOT NULL`)
  );
  return Number(result[0]?.count || 0);
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
  const dup = await db.select({ id: categories.id }).from(categories).where(sql`LOWER(${categories.name}) = ${name.toLowerCase()}`).limit(1);
  if (dup.length > 0) throw new Error("Category already exists");
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
  const dup = await db.select({ id: categories.id }).from(categories)
    .where(and(sql`LOWER(${categories.name}) = ${name.toLowerCase()}`, sql`${categories.id} <> ${id}`)).limit(1);
  if (dup.length > 0) throw new Error("Category name already exists");
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

/** Number of projects (any status) that belong to a category. */
export async function countProjectsInCategory(categoryId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    return loadLocalDb().projects.filter(p => p.categoryId === categoryId).length;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.categoryId, categoryId));
  return Number(result[0]?.count || 0);
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

export async function getProjectsByUploader(userId: number) {
  const db = await getDb();
  if (!db) {
    const data = loadLocalDb();
    return data.projects
      .filter(p => p.uploadedBy === userId)
      .map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) }))
      .sort((a, b) => b.id - a.id);
  }
  return db.select().from(projects).where(eq(projects.uploadedBy, userId)).orderBy(desc(projects.createdAt));
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
    const pattern = `%${query.toLowerCase()}%`;
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

/**
 * Resolves a free-typed adviser name to the canonical `advisers` row,
 * creating it on first use (case/whitespace-insensitive match). This is the
 * single write path that keeps `advisers` the normalized source of truth
 * and `projects.adviser` a display cache in sync with it — see the comment
 * on `projects.adviser` in drizzle/schema.ts.
 */
export async function getOrCreateAdviser(rawName: string): Promise<{ id: number; name: string }> {
  const name = rawName.trim();
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const existing = store.advisers.find((a: any) => String(a.name).trim().toLowerCase() === name.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };
    const id = store.advisers.length > 0 ? Math.max(...store.advisers.map((a: any) => a.id)) + 1 : 1;
    const row = { id, name, createdAt: new Date().toISOString() };
    store.advisers.push(row);
    saveLocalDb();
    return { id, name };
  }

  const existing = await db.select().from(advisers).where(sql`LOWER(${advisers.name}) = ${name.toLowerCase()}`).limit(1);
  if (existing.length > 0) return { id: existing[0].id, name: existing[0].name };
  try {
    const result: any = await db.insert(advisers).values({ name }).$returningId();
    return { id: Number(result[0]?.id), name };
  } catch (error: any) {
    // Lost a race with another request creating the same adviser: re-read it.
    if (error?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(String(error?.message))) {
      const row = await db.select().from(advisers).where(sql`LOWER(${advisers.name}) = ${name.toLowerCase()}`).limit(1);
      if (row.length > 0) return { id: row[0].id, name: row[0].name };
    }
    throw error;
  }
}

export async function createProject(data: {
  title: string; abstract: string; categoryId: number; adviser: string;
  members: string; features?: string; research?: string; schoolYear: string;
  fileUrl?: string; fileKey?: string; fileName?: string; fileType?: string; uploadedBy: number;
  status?: 'pending' | 'approved';
}) {
  const adviser = await getOrCreateAdviser(data.adviser);
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const id = store.projects.length > 0 ? Math.max(...store.projects.map(p => p.id)) + 1 : 1;
    store.projects.push({
      id,
      title: data.title,
      abstract: data.abstract,
      categoryId: data.categoryId,
      adviserId: adviser.id,
      adviser: adviser.name,
      members: data.members,
      features: data.features || null,
      research: data.research || null,
      schoolYear: data.schoolYear,
      fileUrl: data.fileUrl || null,
      fileKey: data.fileKey || null,
      fileName: data.fileName || null,
      fileType: data.fileType || null,
      uploadedBy: data.uploadedBy,
      status: data.status ?? 'pending',
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
    adviserId: adviser.id,
    adviser: adviser.name,
    members: data.members,
    features: data.features || null,
    research: data.research || null,
    schoolYear: data.schoolYear,
    fileUrl: data.fileUrl || null,
    fileKey: data.fileKey || null,
    fileName: data.fileName || null,
    fileType: data.fileType || null,
    uploadedBy: data.uploadedBy,
    status: data.status ?? 'pending',
  }).$returningId();
  return result[0]?.id;
}

export async function updateProject(id: number, data: Partial<{
  title: string; abstract: string; categoryId: number; adviser: string;
  members: string; features: string; research: string; schoolYear: string; fileUrl: string; fileKey: string;
  fileName: string; fileType: string; status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
}>) {
  const patch: typeof data & { adviserId?: number } = { ...data };
  if (typeof patch.adviser === 'string') {
    const adviser = await getOrCreateAdviser(patch.adviser);
    patch.adviser = adviser.name;
    patch.adviserId = adviser.id;
  }
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const p = store.projects.find(p => p.id === id);
    if (p) {
      Object.assign(p, patch);
      p.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(projects).set({ ...patch, updatedAt: new Date() }).where(eq(projects.id, id));
}

/** Deletes a project together with its bookmarks, download requests, and edit requests. */
export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    store.projects = store.projects.filter(p => p.id !== id);
    store.bookmarks = store.bookmarks.filter(b => b.projectId !== id);
    store.downloadRequests = store.downloadRequests.filter(d => d.projectId !== id);
    store.editRequests = store.editRequests.filter(e => e.projectId !== id);
    saveLocalDb();
    return;
  }
  await db.delete(bookmarks).where(eq(bookmarks.projectId, id));
  await db.delete(downloadRequests).where(eq(downloadRequests.projectId, id));
  await db.delete(editRequests).where(eq(editRequests.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
}

// Bookmarks
export async function getUserBookmarks(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const projectIds = store.bookmarks.filter(b => b.userId === userId).map(b => b.projectId);
    return store.projects.filter(p => projectIds.includes(p.id) && p.status === 'approved').map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) }));
  }
  const bms = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
  const projectIds = bms.map(b => b.projectId);
  if (projectIds.length === 0) return [];
  return db.select().from(projects).where(and(
    eq(projects.status, 'approved'),
    sql`${projects.id} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`,
  ));
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

// Edit Requests
// A capstone adviser must have an `approved` row here for a given project
// before `projects.resubmit` (server/routers.ts) will let their edit
// through. Mirrors the downloadRequests functions above exactly.
export async function getAllEditRequests() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.editRequests.map(e => ({ ...e, createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(editRequests).orderBy(desc(editRequests.createdAt));
}

export async function getPendingEditRequests() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.editRequests.filter(e => e.status === 'pending').map(e => ({ ...e, createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) })).sort((a, b) => b.id - a.id);
  }
  return db.select().from(editRequests).where(eq(editRequests.status, 'pending')).orderBy(desc(editRequests.createdAt));
}

export async function getApprovedEditRequests(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.editRequests.filter(e => e.userId === userId && e.status === 'approved').map(e => ({ ...e, createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) }));
  }
  return db.select().from(editRequests).where(and(eq(editRequests.userId, userId), eq(editRequests.status, 'approved')));
}

export async function getUserEditRequests(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    return store.editRequests
      .filter(e => e.userId === userId)
      .map(e => ({ ...e, createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) }))
      .sort((a, b) => b.id - a.id);
  }
  return db.select().from(editRequests).where(eq(editRequests.userId, userId)).orderBy(desc(editRequests.createdAt));
}

/** True if the adviser currently has admin approval to edit this specific project. */
export async function hasApprovedEditRequest(userId: number, projectId: number) {
  const approved = await getApprovedEditRequests(userId);
  return approved.some(e => e.projectId === projectId);
}

export async function createEditRequest(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    let existing = store.editRequests.find(e => e.userId === userId && e.projectId === projectId);
    if (existing) {
      if (existing.status === 'pending') return existing.id;
      existing.status = 'pending';
      existing.adminNote = null;
      existing.updatedAt = new Date().toISOString();
      saveLocalDb();
      return existing.id;
    }
    const id = store.editRequests.length > 0 ? Math.max(...store.editRequests.map(e => e.id)) + 1 : 1;
    store.editRequests.push({
      id, projectId, userId, status: 'pending', adminNote: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    saveLocalDb();
    return id;
  }

  const existing = await db.select().from(editRequests).where(and(eq(editRequests.userId, userId), eq(editRequests.projectId, projectId))).limit(1);
  if (existing.length > 0) {
    if (existing[0].status === 'pending') return existing[0].id;
    await db.update(editRequests).set({ status: 'pending', adminNote: null, updatedAt: new Date() }).where(eq(editRequests.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(editRequests).values({ userId, projectId }).$returningId();
  return result[0]?.id;
}

export async function updateEditRequest(id: number, status: 'approved' | 'rejected', adminNote?: string) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const e = store.editRequests.find(e => e.id === id);
    if (e) {
      e.status = status;
      e.adminNote = adminNote || null;
      e.updatedAt = new Date().toISOString();
      saveLocalDb();
    }
    return;
  }
  await db.update(editRequests).set({ status, adminNote: adminNote || null, updatedAt: new Date() }).where(eq(editRequests.id, id));
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
    const studentsCount = store.users.filter(u => u.role === 'student').length;
    return {
      totalUsers: store.users.length,
      totalStudents: studentsCount,
      totalAdvisers: store.users.filter(u => u.role === 'adviser').length,
      totalProjects: approvedP,
      pendingUploads: pendingU,
      pendingDownloads: pendingD,
    };
  }
  const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  const studentsCountResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'student'));
  const advisersCountResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'adviser'));
  const totalProjects = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, 'approved'));
  const pendingUploads = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, 'pending'));
  const pendingDownloads = await db.select({ count: sql<number>`count(*)` }).from(downloadRequests).where(eq(downloadRequests.status, 'pending'));
  return {
    totalUsers: Number(totalUsersResult[0]?.count || 0),
    totalStudents: Number(studentsCountResult[0]?.count || 0),
    totalAdvisers: Number(advisersCountResult[0]?.count || 0),
    totalProjects: Number(totalProjects[0]?.count || 0),
    pendingUploads: Number(pendingUploads[0]?.count || 0),
    pendingDownloads: Number(pendingDownloads[0]?.count || 0),
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
  return result.map(r => ({ categoryId: r.categoryId, count: Number(r.count) }));
}

// Get school years from existing projects
export async function getSchoolYears() {
  const db = await getDb();
  if (!db) {
    const store = loadLocalDb();
    const distinct = Array.from(new Set(store.projects.filter(p => p.status === 'approved').map(p => p.schoolYear))).sort();
    return distinct;
  }
  const result = await db.selectDistinct({ schoolYear: projects.schoolYear }).from(projects).where(eq(projects.status, 'approved')).orderBy(projects.schoolYear);
  return result.map(r => r.schoolYear);
}
