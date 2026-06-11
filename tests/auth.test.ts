import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { app } from "../src/common/app";
import {
  isLoggedIn,
  logout,
  getAccessToken,
  loginWithPassword,
  loginService,
  login,
  loginWithRedirect,
  handleRedirectCallback,
  resetPassword,
  verifyToken,
  verifyServiceToken,
} from "../src/auth";
import * as makeRequestModule from "../src/common/makerequest";

vi.mock("../src/common/makerequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/common/makerequest")>();
  return {
    ...actual,
    makeRequest: vi.fn(),
  };
});

describe("Auth sub-module functions", () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;

  beforeEach(() => {
    app.accessToken = null;
    app.refreshToken = null;
    app.userManager = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
  });

  // 1. isLoggedIn
  test("isLoggedIn should return true if token is valid, false otherwise", () => {
    expect(isLoggedIn()).toBe(false);
    app.accessToken = {
      isValid: () => true,
      value: () => "valid",
    } as any;
    expect(isLoggedIn()).toBe(true);
  });

  // 2. logout
  test("logout should clear tokens and sessionStorage in non-browser env", async () => {
    app.accessToken = { value: () => "acc" } as any;
    app.refreshToken = { value: () => "ref" } as any;
    await logout();
    expect(app.accessToken).toBeNull();
    expect(app.refreshToken).toBeNull();
  });

  test("logout should call userManager.signoutRedirect if userManager exists", async () => {
    const mockSignoutRedirect = vi.fn();
    app.userManager = {
      signoutRedirect: mockSignoutRedirect,
    } as any;
    global.window = {} as any; // Simulate browser env
    await logout();
    expect(mockSignoutRedirect).toHaveBeenCalled();
  });

  // 3. getAccessToken
  test("getAccessToken in non-browser should return app token or null", async () => {
    expect(await getAccessToken()).toBeNull();
    app.accessToken = { value: () => "acc-val" } as any;
    expect(await getAccessToken()).toBe("acc-val");
  });

  test("getAccessToken in browser with userManager should use userManager", async () => {
    global.window = {} as any;
    const mockGetUser = vi.fn().mockResolvedValue({ access_token: "um-token", expired: false });
    app.userManager = {
      getUser: mockGetUser,
    } as any;
    expect(await getAccessToken()).toBe("um-token");
  });

  test("getAccessToken in browser should force silent renew if expired or forceRefresh is true", async () => {
    global.window = {} as any;
    const mockGetUser = vi.fn().mockResolvedValue({ access_token: "old-token", expired: true });
    const mockSigninSilent = vi.fn().mockResolvedValue({ access_token: "new-token", expired: false });
    app.userManager = {
      getUser: mockGetUser,
      signinSilent: mockSigninSilent,
    } as any;
    expect(await getAccessToken(true)).toBe("new-token");
    expect(mockSigninSilent).toHaveBeenCalled();
  });

  // 4. loginWithPassword
  test("loginWithPassword should request /api/login and set accessToken", async () => {
    const mockResponse = { token: "secret-pwd-token", user: { id: "u1", name: "User" } };
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue(mockResponse);

    const user = await loginWithPassword({ email: "test@test.com", password: "pwd", projectId: "p-123" });
    expect(vi.mocked(makeRequestModule.makeRequest)).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/login",
      undefined,
      { email: "test@test.com", password: "pwd", projectId: "p-123" }
    );
    expect(user).toEqual({ id: "u1", name: "User" });
    expect(app.accessToken?.value()).toBe("secret-pwd-token");
  });

  // 5. loginService / login
  test("loginService should fetch access token and save it", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "service-access-token" }),
    });
    global.fetch = mockFetch;

    const data = await loginService("p1", "s1", "sec");
    expect(mockFetch).toHaveBeenCalledWith("https://api.swiftbase.io/oauth2/token", expect.any(Object));
    expect(data.access_token).toBe("service-access-token");
    expect(app.accessToken?.value()).toBe("service-access-token");

    // Test alias login
    expect(login).toBe(loginService);
  });

  test("loginService should throw if fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    });
    global.fetch = mockFetch;

    await expect(loginService("p1", "s1", "sec")).rejects.toThrow("Service login failed");
  });

  // 6. loginWithRedirect
  test("loginWithRedirect should throw error in non-browser env", async () => {
    await expect(loginWithRedirect()).rejects.toThrow("loginWithRedirect can only be used in a browser environment");
  });

  test("loginWithRedirect should call userManager.signinRedirect", async () => {
    const mockSigninRedirect = vi.fn();
    app.userManager = {
      signinRedirect: mockSigninRedirect,
    } as any;
    global.window = {
      location: { origin: "http://localhost" },
    } as any;

    await loginWithRedirect({ state: "xyz" });
    expect(mockSigninRedirect).toHaveBeenCalledWith(expect.objectContaining({
      redirect_uri: "http://localhost",
      state: "xyz",
    }));
  });

  // 7. handleRedirectCallback
  test("handleRedirectCallback should throw error in non-browser env", async () => {
    await expect(handleRedirectCallback()).rejects.toThrow("handleRedirectCallback can only be used in a browser environment");
  });

  test("handleRedirectCallback should call userManager.signinRedirectCallback and return profile", async () => {
    const mockSigninRedirectCallback = vi.fn().mockResolvedValue({
      profile: { id: "user-id-123", email: "a@b.com" },
    });
    app.userManager = {
      signinRedirectCallback: mockSigninRedirectCallback,
    } as any;
    global.window = {} as any;

    const profile = await handleRedirectCallback("http://callback-url");
    expect(mockSigninRedirectCallback).toHaveBeenCalledWith("http://callback-url");
    expect(profile).toEqual({ id: "user-id-123", email: "a@b.com" });
  });

  // 8. resetPassword
  test("resetPassword should make POST request to /api/users/reset-password", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ success: true });
    const res = await resetPassword({ email: "reset@test.com", projectId: "p-123" });
    expect(vi.mocked(makeRequestModule.makeRequest)).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/users/reset-password",
      undefined,
      { email: "reset@test.com", projectId: "p-123" }
    );
    expect(res).toEqual({ success: true });
  });

  // 9. verifyToken
  test("verifyToken should fetch and return profile if response is ok", async () => {
    const mockProfile = { id: "verified-user" };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProfile,
    });
    global.fetch = mockFetch;

    const profile = await verifyToken("my-verify-token");
    expect(mockFetch).toHaveBeenCalledWith("https://api.swiftbase.io/api/me", {
      headers: { Authorization: "Bearer my-verify-token" },
    });
    expect(profile).toEqual(mockProfile);
  });

  test("verifyToken should throw if response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    });
    global.fetch = mockFetch;

    await expect(verifyToken("invalid")).rejects.toThrow("Invalid token");
  });

  // 10. verifyServiceToken
  test("verifyServiceToken should make request to /api/verify-service-token", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ valid: true });
    const result = await verifyServiceToken("svc-token", "proj", "read:all");
    expect(vi.mocked(makeRequestModule.makeRequest)).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/verify-service-token",
      undefined,
      { token: "svc-token", scope: "read:all" }
    );
    expect(result).toEqual({ valid: true });
  });
});
