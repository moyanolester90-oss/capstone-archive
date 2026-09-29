/**
 * One-time MySQL setup for the Capstone Archive (run with setup-database.bat).
 *
 * 1. Makes sure DATABASE_URL is set in .env (default: XAMPP's MySQL, user root, no password).
 * 2. Creates the database if it doesn't exist.
 * 3. Applies the Drizzle migrations in ./drizzle (creates/updates all tables).
 * 4. If the database is empty, copies everything from local_db.json into it.
 *
 * Safe to run again: existing data is never overwritten.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const JSON_PATH = path.join(ROOT, "local_db.json");
const DEFAULT_URL = "mysql://root@localhost:3306/capstone_archive";

function log(msg: string) {
  console.log(`[DB SETUP] ${msg}`);
}

/** Adds or replaces DATABASE_URL in .env so the server uses MySQL from now on. */
function saveDatabaseUrl(url: string) {
  let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
  if (/^DATABASE_URL=.*$/m.test(env)) {
    env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`);
  } else {
    env += `${env.endsWith("\n") || env === "" ? "" : "\n"}DATABASE_URL=${url}\n`;
  }
  fs.writeFileSync(ENV_PATH, env, "utf-8");
}

const toDate = (value: unknown) => (value ? new Date(value as string) : new Date());

async function main() {
  const url = (process.env.DATABASE_URL || "").trim() || DEFAULT_URL;
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Database name "${dbName}" may only contain letters, numbers and underscores.`);
  }

  // 1. Connect to the MySQL server (without choosing a database) and create the database.
  log(`Connecting to MySQL at ${parsed.hostname}:${parsed.port || 3306} as "${decodeURIComponent(parsed.username)}"...`);
  const serverUrl = new URL(url);
  serverUrl.pathname = "/";
  let server: mysql.Connection;
  try {
    server = await mysql.createConnection(serverUrl.toString());
  } catch (err: any) {
    console.error("\n[DB SETUP] Could not connect to MySQL.");
    console.error("  -> Open the XAMPP Control Panel and click START next to MySQL, then run this again.");
    console.error(`  (details: ${err?.code || err?.message})\n`);
    process.exit(1);
  }
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await server.end();
  log(`Database "${dbName}" is ready.`);

  // 2. Apply the Drizzle migrations (creates all tables, keys and indexes).
  const pool = mysql.createPool({ uri: url, connectionLimit: 2 });
  const db = drizzle(pool);
  log("Applying Drizzle migrations...");
  await migrate(db, { migrationsFolder: path.join(ROOT, "drizzle") });
  log("Tables are up to date.");

  // 3. Copy data from local_db.json. Additive only: existing rows (matched
  // by id, or by schoolId for users) are left untouched and never
  // overwritten or deleted, so this is safe to re-run any time.
  if (!fs.existsSync(JSON_PATH)) {
    log("No local_db.json found; starting with an empty database.");
  } else {
    await importJsonData(pool);
  }

  await pool.end();

  if ((process.env.DATABASE_URL || "").trim() !== url) {
    saveDatabaseUrl(url);
    log(`Saved DATABASE_URL=${url} to .env`);
  }
  log("Done! Restart the system (close the server window and open run-system.bat) to use MySQL.");
}

async function importJsonData(pool: mysql.Pool) {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  const users: any[] = data.users || [];
  const categories: any[] = data.categories || [];
  const projects: any[] = data.projects || [];
  const userIds = new Set(users.map(u => u.id));
  const categoryIds = new Set(categories.map(c => c.id));
  const validProjects = projects.filter(p => userIds.has(p.uploadedBy) && categoryIds.has(p.categoryId));
  const projectIds = new Set(validProjects.map(p => p.id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Every statement below uses INSERT IGNORE: a row whose id (or, for
    // users, schoolId) already exists is silently left alone rather than
    // overwritten or erroring out. Nothing already in the database is ever
    // modified or removed by this import.
    let userCount = 0, categoryCount = 0, projectCount = 0;

    for (const u of users) {
      // Carries over schoolId/passwordHash/yearSection too, so accounts
      // created via the credential sign-up flow (School ID + password)
      // can still log in after switching from local_db.json to MySQL.
      // Older local_db.json rows may still say role "user" from before the
      // "student" rename below — map those over so they land correctly.
      const importedRole = u.role === "user" ? "student" : u.role;
      const [result]: any = await conn.query(
        "INSERT IGNORE INTO `users` (id, openId, name, email, loginMethod, role, status, schoolId, passwordHash, yearSection, createdAt, updatedAt, lastSignedIn) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [u.id, u.openId, u.name ?? null, u.email || null, u.loginMethod ?? null,
          ["student", "adviser", "admin"].includes(importedRole) ? importedRole : "student", u.status || "active",
          u.schoolId ?? null, u.passwordHash ?? null, u.yearSection ?? null,
          toDate(u.createdAt), toDate(u.updatedAt), toDate(u.lastSignedIn)]
      );
      userCount += result.affectedRows || 0;
    }
    for (const c of categories) {
      const [result]: any = await conn.query(
        "INSERT IGNORE INTO `categories` (id, name, description, createdAt, updatedAt) VALUES (?,?,?,?,?)",
        [c.id, c.name, c.description ?? null, toDate(c.createdAt), toDate(c.updatedAt)]
      );
      categoryCount += result.affectedRows || 0;
    }
    for (const p of validProjects) {
      const [result]: any = await conn.query(
        "INSERT IGNORE INTO `projects` (id, title, abstract, categoryId, adviser, members, features, research, schoolYear, fileUrl, fileKey, fileName, fileType, status, rejectionReason, uploadedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [p.id, p.title, p.abstract ?? null, p.categoryId, p.adviser, p.members ?? null, p.features ?? null,
          p.research ?? null, p.schoolYear, p.fileUrl ?? null, p.fileKey ?? null, p.fileName ?? null,
          p.fileType ?? null, p.status || "pending", p.rejectionReason ?? null, p.uploadedBy,
          toDate(p.createdAt), toDate(p.updatedAt)]
      );
      projectCount += result.affectedRows || 0;
    }
    const seen = new Set<string>();
    let bookmarkCount = 0;
    for (const b of data.bookmarks || []) {
      const key = `${b.userId}:${b.projectId}`;
      if (!userIds.has(b.userId) || !projectIds.has(b.projectId) || seen.has(key)) continue;
      seen.add(key);
      const [result]: any = await conn.query("INSERT IGNORE INTO `bookmarks` (id, userId, projectId, createdAt) VALUES (?,?,?,?)",
        [b.id, b.userId, b.projectId, toDate(b.createdAt)]);
      bookmarkCount += result.affectedRows || 0;
    }
    seen.clear();
    let requestCount = 0;
    for (const d of data.downloadRequests || []) {
      const key = `${d.userId}:${d.projectId}`;
      if (!userIds.has(d.userId) || !projectIds.has(d.projectId) || seen.has(key)) continue;
      seen.add(key);
      const [result]: any = await conn.query(
        "INSERT IGNORE INTO `downloadRequests` (id, projectId, userId, status, adminNote, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
        [d.id, d.projectId, d.userId, d.status || "pending", d.adminNote ?? null, toDate(d.createdAt), toDate(d.updatedAt)]
      );
      requestCount += result.affectedRows || 0;
    }
    let logCount = 0;
    for (const a of data.activityLogs || []) {
      const [result]: any = await conn.query(
        "INSERT IGNORE INTO `activityLogs` (id, userId, action, description, entityType, entityId, createdAt) VALUES (?,?,?,?,?,?,?)",
        [a.id, userIds.has(a.userId) ? a.userId : null, a.action, a.description ?? null,
          a.entityType ?? null, a.entityId ?? null, toDate(a.createdAt)]
      );
      logCount += result.affectedRows || 0;
    }

    await conn.commit();
    log(`Imported from local_db.json (new rows only): ${userCount}/${users.length} users, ` +
      `${categoryCount}/${categories.length} categories, ${projectCount}/${validProjects.length} projects, ` +
      `${bookmarkCount} favorites, ${requestCount} download requests, ${logCount} activity log entries.`);
    if (validProjects.length !== projects.length) {
      log(`Skipped ${projects.length - validProjects.length} project(s) whose category or uploader no longer exists.`);
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

main().catch(err => {
  console.error("\n[DB SETUP] FAILED:", err?.message || err);
  if (err?.cause) console.error("  cause:", err.cause?.message || err.cause);
  process.exit(1);
});
