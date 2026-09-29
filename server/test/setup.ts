/**
 * Runs before every test file: points the app at a temporary database file and
 * uploads folder so tests never touch the real local_db.json or uploads/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capstone-test-"));
process.env.LOCAL_DB_PATH = path.join(dir, "test_db.json");
process.env.UPLOADS_DIR = path.join(dir, "uploads");
process.env.DATABASE_URL = "";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-vitest-only-1234567890";
