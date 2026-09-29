import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
import axios from "axios";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie
    const { nonce } = decodeOAuthState(state);
    const parsedCookies = parseCookieHeader(req.headers.cookie ?? "");
    const rawExpectedNonce = parsedCookies[OAUTH_STATE_COOKIE] || parsedCookies["oauth_state"];
    const expectedNonce = rawExpectedNonce ? rawExpectedNonce.trim() : undefined;

    if (!nonce || !expectedNonce || nonce.trim() !== expectedNonce) {
      console.warn(`[OAuth] State validation failed. Received nonce: "${nonce}", Expected nonce: "${expectedNonce}"`);
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    res.clearCookie("oauth_state", { path: "/" });

    try {
      let userInfo: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; picture?: string | null };

      if (ENV.googleClientId && ENV.googleClientSecret && !code.startsWith("dev_")) {
        // 1. Exchange authorization code for Google tokens
        const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: ENV.googleRedirectUri || `${req.protocol}://${req.get("host")}/api/oauth/callback`,
          grant_type: "authorization_code",
        });

        const { access_token } = tokenResponse.data;

        // 2. Fetch user info from Google
        const googleUser = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const data = googleUser.data;
        userInfo = {
          openId: data.sub, // Google's unique subject identifier (sub)
          name: data.name || data.given_name || (data.email ? data.email.split("@")[0] : "Google User"),
          email: data.email || null,
          picture: data.picture || null,
          loginMethod: "google",
        };
      } else {
        // Local development mode fallback (when Google keys are not configured or dev_ code used)
        console.log("[OAuth] Local development fallback for code:", code);
        const reqEmail = (req.query.email as string) || (code.includes("@") ? code.replace(/^dev_/, "") : null);
        const reqName = (req.query.name as string) || (reqEmail ? reqEmail.split("@")[0] : null);

        if (reqEmail) {
          userInfo = {
            openId: `dev-${reqEmail.replace(/[^a-zA-Z0-9]/g, "-")}`,
            name: reqName || reqEmail,
            email: reqEmail,
            loginMethod: "google-dev",
          };
        } else {
          userInfo = {
            openId: ENV.ownerOpenId || "dev-admin-openid",
            name: "Local Admin User",
            email: "admin@localhost",
            loginMethod: "google-dev",
          };
        }
      }

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from Google user info" });
        return;
      }

      // Upsert user into database (captures name, email, etc.)
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? null,
        lastSignedIn: new Date(),
      });

      // Log activity
      const user = await db.getUserByOpenId(userInfo.openId);
      if (user) {
        await db.createActivityLog({
          userId: user.id,
          action: 'user_login',
          description: `User logged in via Google: ${userInfo.name || user.name}`,
          entityType: 'user',
          entityId: user.id,
        });
      }

      // Create local session JWT
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || user?.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed:", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
}
