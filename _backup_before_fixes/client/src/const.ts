import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Starts the Google OAuth login flow.
 * It mints a one-time nonce, writes it to a secure cookie, and redirects the browser
 * to Google's authorization endpoint.
 */
export const startLogin = () => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const isSecure = window.location.protocol === "https:";
  const cookieName = isSecure ? OAUTH_STATE_COOKIE : "oauth_state";

  // Check if an oauth_state cookie already exists to avoid overwriting and desyncing
  // in React StrictMode (development) where this function might be called twice.
  const cookies = document.cookie.split(';');
  let nonce = "";
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName && value) {
      nonce = value;
      break;
    }
  }

  if (!nonce) {
    nonce = crypto.randomUUID();
    document.cookie = `${cookieName}=${nonce}; Path=/; Max-Age=600; SameSite=${isSecure ? "None; Secure" : "Lax"}`;
  }

  const state = encodeOAuthState({ redirectUri, nonce });

  if (googleClientId) {
    // Google OAuth 2.0 Authorization Endpoint
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");

    window.location.href = url.toString();
  } else {
    // Local development fallback: navigate directly to local OAuth callback
    console.warn("[Auth] VITE_GOOGLE_CLIENT_ID not found, using dev fallback.");
    const localCallbackUrl = new URL(redirectUri);
    localCallbackUrl.searchParams.set("code", "dev_admin_code");
    localCallbackUrl.searchParams.set("state", state);
    window.location.href = localCallbackUrl.toString();
  }
};
