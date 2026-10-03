import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, longtext, index, unique } from "drizzle-orm/mysql-core";

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
  // Set whenever an admin/adviser approves a "Forgot Password?" request and
  // issues a server-generated temporary password (see `passwordResetRequests`
  // below and `setTemporaryPassword` in server/db.ts). While true, the person
  // can still sign in with that temporary password, but the client forces
  // them to the "Create New Password" screen before anything else — any
  // successful password change (including that one) clears this flag again
  // via `updateUserPassword`.
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
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
  // Normalized (3NF): the adviser's name lives once in `advisers`, referenced
  // here. Resolved via getOrCreateAdviser() in server/db.ts; read paths join
  // it back in via hydrateProjects()/hydrateProject() so every caller still
  // sees a plain `adviser: string` field, same as before normalization.
  adviserId: int("adviserId").notNull().references(() => advisers.id, { onDelete: "restrict" }),
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
 * Project team members — normalized (1NF) out of what used to be a single
 * newline-separated text blob on `projects`, into one row per member.
 */
export const projectMembers = mysqlTable("projectMembers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("projectMembers_projectId_idx").on(t.projectId),
]);

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

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
 * "Forgot Password?" requests.
 *
 * No account has a verified, reliable email on file (Students never collect
 * one at sign-up at all), so there is no inbox to send a reset link or code
 * to. Password recovery is instead request-and-approve, the same shape as
 * `editRequests`/`downloadRequests`: a person who forgets their password
 * submits a request with just their School ID (see `passwordResets.request`
 * in server/routers.ts, which never reveals whether that School ID exists).
 * An admin (any request) or an adviser (Student requests only) then reviews
 * it from their dashboard; approving it generates a random temporary
 * password, hashes it, and overwrites the account's `passwordHash`
 * (`setTemporaryPassword` in server/db.ts). The plaintext is ALSO kept here,
 * in `temporaryPassword`, specifically so the Student Login page can look it
 * up by School ID and let the student reveal it themselves (see
 * `passwordResets.checkTemporary` in server/routers.ts) — this is in
 * addition to the one-time reveal already shown to the approver. Once the
 * student finishes signing in with it and sets their own permanent
 * password, `temporaryPassword` is cleared and `used` is set to true
 * (`updateUserPassword` in server/db.ts) so it can never be looked up or
 * reused again.
 *
 * One row per user (mirrors the unique constraint pattern on
 * `editRequests`/`downloadRequests`, minus the second project dimension
 * those have): asking again after a rejection, or after a previous reset
 * was already completed, reuses the same row and resets it to `pending`
 * rather than piling up duplicate rows.
 */
export const passwordResetRequests = mysqlTable("passwordResetRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  // Plaintext temporary password, set the moment a request is approved.
  // Cleared (set back to NULL) the moment it's consumed — either because the
  // student finished the forced password change, or because a fresh request
  // was submitted for the same user and supersedes it. Never populated for
  // a merely "pending" or "rejected" row.
  temporaryPassword: varchar("temporaryPassword", { length: 255 }),
  // True once the temporary password has been used to complete a permanent
  // password change, so the Student Login lookup stops offering it even
  // though `status` stays "approved" for the admin/adviser history view.
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  unique("passwordResetRequests_userId_unique").on(t.userId),
  index("passwordResetRequests_status_idx").on(t.status),
]);

export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
export type InsertPasswordResetRequest = typeof passwordResetRequests.$inferInsert;

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
