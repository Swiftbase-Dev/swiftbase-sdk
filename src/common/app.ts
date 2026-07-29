import Token from "./token";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

interface SwiftbaseApp {
  projectId: string;
  baseUrl: string;
  accessToken: Token | null;
  refreshToken: Token | null;
  debounceTimeout: number;
  cacheArticles: boolean;
  searchCacheEnabled: boolean;
  searchCacheCapacity: number;
  userManager: UserManager | null;
}

interface initializeSdkOptions {
  baseUrl: string;
  debounceTimeout?: number;
  cacheArticles?: boolean;
  searchCacheEnabled?: boolean;
  searchCacheCapacity?: number;
}

export const app: SwiftbaseApp = {
  projectId: "",
  baseUrl: "https://api.swiftbase.io",
  accessToken: null,
  refreshToken: null,
  debounceTimeout: 300,
  cacheArticles: true,
  searchCacheEnabled: true,
  searchCacheCapacity: 50,
  userManager: null,
};

export const initializeSdk = (projectId: string, options?: initializeSdkOptions) => {
  // Set the project id
  app.projectId = projectId;
  // Override the default baseUrl if provided
  if (options?.baseUrl) {
    // Remove trailing slash if present
    app.baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl.slice(0, -1) : options.baseUrl;
  }
  // Set the debounce timeout if provided
  if (options?.debounceTimeout !== undefined) {
    app.debounceTimeout = options.debounceTimeout;
  }
  // Set the cacheArticles flag if provided
  if (options?.cacheArticles !== undefined) {
    app.cacheArticles = options.cacheArticles;
  }
  // Set the search cache options if provided
  if (options?.searchCacheEnabled !== undefined) {
    app.searchCacheEnabled = options.searchCacheEnabled;
  }
  if (options?.searchCacheCapacity !== undefined) {
    app.searchCacheCapacity = options.searchCacheCapacity;
  }

  // Load tokens from sessionStorage if in browser
  if (typeof window !== "undefined" && window.sessionStorage) {
    const accessToken = window.sessionStorage.getItem("swiftbase_access_token");
    const refreshToken = window.sessionStorage.getItem("swiftbase_refresh_token");
    if (accessToken) {
      app.accessToken = new Token(accessToken, "access");
    }
    if (refreshToken) {
      app.refreshToken = new Token(refreshToken, "refresh");
    }
  }

  // Initialize UserManager for OIDC
  if (typeof window !== "undefined") {
    app.userManager = new UserManager({
      authority: app.baseUrl,
      client_id: app.projectId,
      redirect_uri: window.location.origin,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: "openid profile email",
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: true,
      filterProtocolClaims: true,
      loadUserInfo: true,
    });

    // Sync UserManager events with SDK state
    app.userManager.events.addUserLoaded((user) => {
      console.log("[SDK] User loaded from UserManager");
      setAccessToken(user.access_token, user.expires_at ? user.expires_at * 1000 : undefined);
      if (user.refresh_token) {
        setRefreshToken(user.refresh_token);
      }
    });

    app.userManager.events.addUserUnloaded(() => {
      console.log("[SDK] User unloaded from UserManager");
      setAccessToken("");
      setRefreshToken("");
    });
  }
};

export const setAccessToken = (token: string, expiration?: number) => {
  console.log("[SDK] setAccessToken called", !!token);
  if (!token || token === "null" || token === "undefined") {
    app.accessToken = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("swiftbase_access_token");
    }
    return;
  }
  app.accessToken = new Token(token, "access", expiration);
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem("swiftbase_access_token", token);
  }
};

export const setRefreshToken = (token: string, expiration?: number) => {
  console.log("[SDK] setRefreshToken called", !!token);
  if (!token || token === "null" || token === "undefined") {
    app.refreshToken = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("swiftbase_refresh_token");
    }
    return;
  }
  app.refreshToken = new Token(token, "refresh", expiration);
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem("swiftbase_refresh_token", token);
  }
};

export const refreshTokens = async () => {
  if (app.userManager) {
    try {
      await app.userManager.signinSilent();
      return;
    } catch (e) {
      console.error("[SDK] signinSilent failed", e);
      // Fallback to manual refresh if signinSilent fails
    }
  }

  if (!app.refreshToken) {
    throw new Error("No refresh token available");
  }

  const tokenUrl = `${app.baseUrl}/oauth2/token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: app.projectId,
      refresh_token: app.refreshToken.value(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || errorData.error || "Failed to refresh tokens");
  }

  const data = await response.json();

  // Set tokens in app and storage
  const expiresAt = Date.now() + data.expires_in * 1000;
  setAccessToken(data.access_token, expiresAt);

  if (data.refresh_token) {
    // Refresh tokens are rotated as per AUTHENTICATION.md
    const refreshExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    setRefreshToken(data.refresh_token, refreshExpiresAt);
  }
};
