import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, longtext, index, unique } from "drizzle-orm/mysql-core";

/**
 * Account roles:
 * - student = Student: browse/search approved capstones, save favorites, request downloads.
 * - adviser = Capstone adviser (host): upload capstones and update the ones they uploaded
 *             (every upload/update is reviewed by an admin before students see it).
 * - admin   = Librarian/admin: approve, upload, update and delete any capstone; manage users.
 */
export const USER_ROLES = ["student", "adviser", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Core user table backing auth flow.
 *
 * `name` is `varchar` (not `text`) with a unique index so the database
 * itself rejects a second account under the same name, in addition to the
 * application-level check done at sign-up (see `auth.checkAvailability` /
 * `createUserWithCredentials` in server/db.ts) — the same defense-in-depth
 * pattern already used for `schoolId`.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).unique(),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", USER_ROLES).default("student").notNull(),
  // "pending" is only ever set by a fresh self-service Student sign-up — every
  // other creation path (adviser/librarian sign-up, and any account created
  // directly) still defaults to "active" exactly as before, so existing
  // accounts and every non-student flow are unaffected by this value existing.
  status: mysqlEnum("status", ["pending", "active", "inactive", "suspended"]).default("active").notNull(),
  // Credential login (School ID + password), added when Google/demo sign-in
  // was replaced by direct account sign-up. `schoolId` is the login handle
  // for every role; `yearSection` is collected for students only.
  schoolId: varchar("schoolId", { length: 50 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  yearSection: varchar("yearSection", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Project categories.
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Capstone advisers — a normalized lookup table (3NF).
 *
 * Before this table existed, every project row stored the adviser's full
 * name as free text, so the same person's name was repeated verbatim across
 * every one of their projects (duplicate data), with no protection against
 * two rows drifting apart on a typo. `advisers.name` is now the single
 * source of truth for a given adviser; `projects.adviserId` references it.
 */
export const advisers = mysqlTable("advisers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Adviser = typeof advisers.$inferSelect;
export type InsertAdviser = typeof advisers.$inferInsert;

/**
 * Capstone projects.
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  abstract: longtext("abstract"),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "restrict" }),
  adviserId: int("adviserId").references(() => advisers.id, { onDelete: "restrict" }),
  // Denormalized display cache of `advisers.name`, kept in sync at write
  // time only (see getOrCreateAdviser() in server/db.ts) so every existing
  // read path (list/search/detail pages) keeps working unchanged. The
  // `advisers` table + `adviserId` above is the normalized source of truth;
  // this column is never independently typed by a user after creation.
  adviser: varchar("adviser", { length: 255 }).notNull(),
  members: text("members"),
  features: text("features"),
  research: text("research"),
  schoolYear: varchar("schoolYear", { length: 20 }).notNull(),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileName: varchar("fileName", { length: 255 }),
  fileType: varchar("fileType", { length: 100 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("projects_status_idx").on(t.status),
  index("projects_categoryId_idx").on(t.categoryId),
  index("projects_adviserId_idx").on(t.adviserId),
  index("projects_uploadedBy_idx").on(t.uploadedBy),
  index("projects_schoolYear_idx").on(t.schoolYear),
]);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Student bookmarks/favorites.
 */
export const bookmarks = mysqlTable("bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  unique("bookmarks_user_project_unique").on(t.userId, t.projectId),
]);

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

/**
 * Download requests.
 */
export const downloadRequests = mysqlTable("downloadRequests", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  unique("downloadRequests_user_project_unique").on(t.userId, t.projectId),
  index("downloadRequests_status_idx").on(t.status),
]);

export type DownloadRequest = typeof downloadRequests.$inferSelect;
export type InsertDownloadRequest = typeof downloadRequests.$inferInsert;

/**
 * Edit requests.
 *
 * A capstone adviser (host) is no longer allowed to edit, resubmit, or
 * replace the file of a capstone project on their own say-so — they must
 * first ask the librarian/admin for permission on that specific project.
 * `projects.resubmit` (server/routers.ts) checks for an `approved` row here
 * before letting an adviser's edit through; the librarian/admin is never
 * gated by this table and can always edit any project directly.
 *
 * One row per adviser+project (mirrors `downloadRequests`): asking again
 * after a rejection resets the same row back to `pending` rather than
 * piling up duplicate requests.
 */
export const editRequests = mysqlTable("editRequests", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  unique("editRequests_user_project_unique").on(t.userId, t.projectId),
  index("editRequests_status_idx").on(t.status),
]);

export type EditRequest = typeof editRequests.$inferSelect;
export type InsertEditRequest = typeof editRequests.$inferInsert;

/**
 * Activity logs.
 */
export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("activityLogs_createdAt_idx").on(t.createdAt),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
