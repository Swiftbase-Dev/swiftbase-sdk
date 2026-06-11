import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { app, initializeSdk, setAccessToken, setRefreshToken, refreshTokens } from "../src/common/app";
import { UserManager } from "oidc-client-ts";

vi.mock("oidc-client-ts", () => {
  const events = {
    addUserLoaded: vi.fn(),
    addUserUnloaded: vi.fn(),
  };
  const signinSilent = vi.fn();
  const UserManagerClass = vi.fn().mockImplementation(() => ({
    events,
    signinSilent,
  }));
  return {
    UserManager: UserManagerClass,
    WebStorageStateStore: vi.fn(),
  };
});

describe("app.ts SDK functions", () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset app state
    app.projectId = "";
    app.baseUrl = "https://api.swiftbase.io";
    app.accessToken = null;
    app.refreshToken = null;
    app.debounceTimeout = 300;
    app.cacheArticles = true;
    app.searchCacheEnabled = true;
    app.searchCacheCapacity = 50;
    app.userManager = null;

    vi.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
  });

  test("initializeSdk should initialize options in non-browser environment", () => {
    initializeSdk("test-project-id", {
      baseUrl: "https://custom.api.io/",
      debounceTimeout: 500,
      cacheArticles: false,
      searchCacheEnabled: false,
      searchCacheCapacity: 100,
    });

    expect(app.projectId).toBe("test-project-id");
    expect(app.baseUrl).toBe("https://custom.api.io"); // Trailing slash removed
    expect(app.debounceTimeout).toBe(500);
    expect(app.cacheArticles).toBe(false);
    expect(app.searchCacheEnabled).toBe(false);
    expect(app.searchCacheCapacity).toBe(100);
    expect(app.userManager).toBeNull();
  });

  test("initializeSdk should load tokens and setup userManager in browser environment", () => {
    const store: Record<string, string> = {
      swiftbase_access_token: "browser-access-token",
      swiftbase_refresh_token: "browser-refresh-token",
    };

    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    };

    global.window = {
      sessionStorage: mockSessionStorage,
      location: { origin: "https://localhost:3000" },
    } as any;

    initializeSdk("browser-project-id");

    expect(app.projectId).toBe("browser-project-id");
    expect(app.accessToken?.value()).toBe("browser-access-token");
    expect(app.refreshToken?.value()).toBe("browser-refresh-token");
    expect(app.userManager).not.toBeNull();
  });

  test("setAccessToken should update app.accessToken and sessionStorage if browser is active", () => {
    const store: Record<string, string> = {};
    global.window = {
      sessionStorage: {
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
      },
    } as any;

    setAccessToken("my-access-token", Date.now() + 5000);
    expect(app.accessToken?.value()).toBe("my-access-token");
    expect(store.swiftbase_access_token).toBe("my-access-token");

    setAccessToken("");
    expect(app.accessToken).toBeNull();
    expect(store.swiftbase_access_token).toBeUndefined();
  });

  test("setRefreshToken should update app.refreshToken and sessionStorage if browser is active", () => {
    const store: Record<string, string> = {};
    global.window = {
      sessionStorage: {
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
      },
    } as any;

    setRefreshToken("my-refresh-token", Date.now() + 5000);
    expect(app.refreshToken?.value()).toBe("my-refresh-token");
    expect(store.swiftbase_refresh_token).toBe("my-refresh-token");

    setRefreshToken("");
    expect(app.refreshToken).toBeNull();
    expect(store.swiftbase_refresh_token).toBeUndefined();
  });

  test("refreshTokens should use userManager if it exists", async () => {
    const mockSigninSilent = vi.fn().mockResolvedValue({});
    app.userManager = {
      signinSilent: mockSigninSilent,
    } as any;

    await refreshTokens();
    expect(mockSigninSilent).toHaveBeenCalled();
  });

  test("refreshTokens should fallback to manual fetch if signinSilent fails or userManager is null", async () => {
    setRefreshToken("fallback-refresh");
    app.baseUrl = "https://api.swiftbase.io";
    app.projectId = "my-project";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        expires_in: 3600,
        refresh_token: "new-refresh",
      }),
    });
    global.fetch = mockFetch;

    await refreshTokens();

    expect(mockFetch).toHaveBeenCalledWith("https://api.swiftbase.io/oauth2/token", expect.any(Object));
    expect(app.accessToken?.value()).toBe("new-access");
    expect(app.refreshToken?.value()).toBe("new-refresh");
  });

  test("refreshTokens should throw error if no refresh token is available and userManager fails/null", async () => {
    app.refreshToken = null;
    await expect(refreshTokens()).rejects.toThrow("No refresh token available");
  });
});
