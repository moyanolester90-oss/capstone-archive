import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { checkDatabaseConnection } from "../db";

console.log("\n[SYSTEM] INITIALIZING CAPSTONE ARCHIVE...");
// Restart marker: forces tsx watch to fully respawn this process so it
// re-reads .env (a plain file-watch reload does not reload process.env).

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  console.log(`[NETWORK] Checking port availability starting from ${startPort}...`);
  for (let port = startPort; port < startPort + 50; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`CRITICAL: No available ports found in range ${startPort}-${startPort+50}`);
}

function checkConfiguration() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) {
    if (ENV.isProduction) {
      throw new Error("JWT_SECRET must be set to a long random value (at least 16 characters) in production.");
    }
    console.warn("[CONFIG] JWT_SECRET is missing or short. Set a long random value in .env before deploying.");
  }
  console.log("[AUTH] Sign-in is by School ID + password (Sign Up page). Google sign-in and demo login have been removed.");
  console.log(`[DATA] Storage: ${ENV.databaseUrl ? "MySQL database" : "local_db.json file"}`);
}

async function startServer() {
  checkConfiguration();
  if (ENV.databaseUrl) {
    await checkDatabaseConnection();
    console.log("[DATA] Connected to MySQL.");
  }
  const app = express();
  app.set("trust proxy", true);
  const server = createServer(app);

  // Uploaded documents are sent as base64 inside JSON, which is about 4/3 the
  // size of the file, so a 50 MB document needs roughly 70 MB of request body.
  app.use(express.json({ limit: "75mb" }));
  app.use(express.urlencoded({ limit: "75mb", extended: true }));

  // Log API calls and page loads (skip the many dev-server asset requests).
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/") || req.url.startsWith("/manus-storage/")) {
      console.log(`[REQUEST] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url.split("?")[0]}`);
    }
    next();
  });

  app.get("/health", (req, res) => {
    res.send("Server is alive and reachable!");
  });

  console.log("[SYSTEM] Loading core modules...");
  registerStorageProxy(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Without this, a failed query (e.g. a dropped/timed-out connection to
      // the remote database) only ever reaches the browser as a generic
      // "Failed query" toast — nothing is printed here in the terminal, so
      // there's no way to tell a network blip apart from a real bug. This
      // prints the actual underlying cause (error code, message) so it's
      // visible in this window when something fails.
      onError({ error, path }) {
        console.error(`[ERROR] tRPC ${path ?? "<unknown>"}:`, error.message);
        if (error.cause) console.error("  cause:", (error.cause as any)?.code || error.cause);
      },
    })
  );

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "The uploaded file is too large. The maximum size is 50 MB." });
      return;
    }
    console.error("[ERROR] Uncaught exception:", err);
    res.status(500).send("INTERNAL SERVER ERROR");
  });

  if (process.env.NODE_ENV === "development") {
    console.log("[SYSTEM] Starting Vite middleware (Development)...");
    await setupVite(app, server);
  } else {
    console.log("[SYSTEM] Starting static server (Production)...");
    serveStatic(app);
  }

  const basePort = parseInt(process.env.PORT || "8080");
  const port = await findAvailablePort(basePort);
  if (port !== basePort) {
    console.warn(`\n[NETWORK] Port ${basePort} is busy (is the system already running in another window?).`);
    console.warn(`[NETWORK] Using port ${port} instead.`);
  }

  server.listen(port, "0.0.0.0", () => {
    const localUrl = `http://localhost:${port}/`;
    const ipUrl = `http://127.0.0.1:${port}/`;

    console.log("\n" + "█".repeat(60));
    console.log("  CAPSTONE ARCHIVE SYSTEM IS NOW LIVE");
    console.log("█".repeat(60));
    console.log(`\n  👉 PRIMARY URL: ${localUrl}`);
    console.log(`  👉 BACKUP URL:  ${ipUrl}`);
    console.log(`  👉 HEALTH TEST: ${localUrl}health`);
    console.log("\n" + "█".repeat(60));
    console.log(`  [INFO] Port: ${port}`);
    console.log(`  [INFO] Mode: ${process.env.NODE_ENV}`);
    console.log(`  [INFO] Time: ${new Date().toLocaleString()}`);
    console.log("\n  KEEP THIS WINDOW OPEN WHILE USING THE SYSTEM\n");
  });
}

startServer().catch(err => {
  console.error("\n[CRITICAL] FAILED TO START SERVER:");
  console.error(err);
  process.exit(1);
});
