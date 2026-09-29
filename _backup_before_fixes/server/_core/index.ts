import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

console.log("\n[SYSTEM] INITIALIZING CAPSTONE ARCHIVE...");

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

async function startServer() {
  const app = express();
  app.set("trust proxy", true);
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global log for every request to see if it even reaches the server
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
  });

  app.get("/health", (req, res) => {
    res.send("Server is alive and reachable!");
  });

  console.log("[SYSTEM] Loading core modules...");
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
