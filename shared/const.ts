export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// The three sign-in portals shown on the Login/Sign Up pages, and which
// account role each one requires (checked on both login and signup).
export type LoginPortal = "student" | "adviser" | "admin";
export const PORTAL_ROLE: Record<LoginPortal, "student" | "adviser" | "admin"> = {
  student: "student",
  adviser: "adviser",
  admin: "admin",
};
