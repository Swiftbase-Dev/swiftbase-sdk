import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { app } from "../src/common/app";
import {
  registerPasskey,
  loginWithPasskey,
  listPasskeys,
  deletePasskey,
  isPasskeySupported,
} from "../src/auth";
import * as makeRequestModule from "../src/common/makerequest";

vi.mock("../src/common/makerequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/common/makerequest")>();
  return {
    ...actual,
    makeRequest: vi.fn(),
  };
});

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
// base64url of [1,2,3] is "AQID"
const B64_123 = "AQID";

describe("Passkeys", () => {
  const mockRequest = vi.mocked(makeRequestModule.makeRequest);
  const create = vi.fn();
  const get = vi.fn();

  const stubBrowser = () => {
    vi.stubGlobal("window", { PublicKeyCredential: function () {}, location: { origin: "https://a.swiftbase.app" } });
    vi.stubGlobal("navigator", { credentials: { create, get } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app.projectId = "proj-a";
    app.accessToken = null;
    app.refreshToken = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("isPasskeySupported is false outside a browser and true with WebAuthn", () => {
    expect(isPasskeySupported()).toBe(false);
    stubBrowser();
    expect(isPasskeySupported()).toBe(true);
  });

  test("registerPasskey throws when passkeys are unsupported", async () => {
    await expect(registerPasskey()).rejects.toThrow("not supported");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test("registerPasskey runs the options -> create -> verify round trip", async () => {
    stubBrowser();
    mockRequest
      .mockResolvedValueOnce({
        challengeId: "ch1",
        options: { challenge: B64_123, rp: { name: "x", id: "a.swiftbase.app" }, user: { id: B64_123, name: "u", displayName: "u" }, pubKeyCredParams: [], excludeCredentials: [{ id: B64_123, type: "public-key" }] },
      })
      .mockResolvedValueOnce({ id: "pk1", name: "Laptop", rpId: "a.swiftbase.app", backedUp: false, transports: [] });
    create.mockResolvedValue({
      id: "cred-id",
      rawId: bytes(1, 2, 3),
      type: "public-key",
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: bytes(1, 2, 3),
        attestationObject: bytes(1, 2, 3),
        getTransports: () => ["internal"],
      },
    });

    const result = await registerPasskey({ name: "Laptop" });

    expect(result.id).toBe("pk1");
    // challenge and ids are decoded to buffers before reaching the browser API
    const publicKey = create.mock.calls[0][0].publicKey;
    expect(new Uint8Array(publicKey.challenge)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(publicKey.user.id)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(publicKey.excludeCredentials[0].id)).toEqual(new Uint8Array([1, 2, 3]));

    expect(mockRequest.mock.calls[0]).toEqual([makeRequestModule.HTTPMethod.POST, "/api/passkeys/register/options", undefined, { projectId: "proj-a" }]);
    const verifyBody: any = mockRequest.mock.calls[1][3];
    expect(mockRequest.mock.calls[1][1]).toBe("/api/passkeys/register/verify");
    expect(verifyBody.challengeId).toBe("ch1");
    expect(verifyBody.name).toBe("Laptop");
    expect(verifyBody.response.rawId).toBe(B64_123);
    expect(verifyBody.response.response.attestationObject).toBe(B64_123);
    expect(verifyBody.response.response.transports).toEqual(["internal"]);
  });

  test("registerPasskey rejects when the user cancels the prompt", async () => {
    stubBrowser();
    mockRequest.mockResolvedValueOnce({
      challengeId: "ch1",
      options: { challenge: B64_123, user: { id: B64_123 }, excludeCredentials: [] },
    });
    create.mockResolvedValue(null);
    await expect(registerPasskey()).rejects.toThrow("cancelled");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  test("loginWithPasskey stores the token and returns the profile", async () => {
    stubBrowser();
    mockRequest
      .mockResolvedValueOnce({
        challengeId: "ch2",
        options: { challenge: B64_123, rpId: "a.swiftbase.app", allowCredentials: [] },
      })
      .mockResolvedValueOnce({ token: "jwt-token", user: { id: "u1", email: "a@b.c" } });
    get.mockResolvedValue({
      id: "cred-id",
      rawId: bytes(1, 2, 3),
      type: "public-key",
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: bytes(1, 2, 3),
        authenticatorData: bytes(1, 2, 3),
        signature: bytes(1, 2, 3),
        userHandle: bytes(1, 2, 3),
      },
    });

    const profile = await loginWithPasskey({ email: "a@b.c" });

    expect(profile).toEqual({ id: "u1", email: "a@b.c" });
    expect(app.accessToken?.value()).toBe("jwt-token");
    expect(mockRequest.mock.calls[0][3]).toEqual({ projectId: "proj-a", email: "a@b.c" });
    const verifyBody: any = mockRequest.mock.calls[1][3];
    expect(verifyBody.response.response.signature).toBe(B64_123);
    expect(verifyBody.response.response.userHandle).toBe(B64_123);
  });

  test("listPasskeys and deletePasskey hit the management endpoints", async () => {
    mockRequest.mockResolvedValueOnce([{ id: "pk1" }]).mockResolvedValueOnce({ success: true });
    expect(await listPasskeys()).toEqual([{ id: "pk1" }]);
    await deletePasskey("pk/1");
    expect(mockRequest.mock.calls[0]).toEqual([makeRequestModule.HTTPMethod.GET, "/api/passkeys"]);
    expect(mockRequest.mock.calls[1]).toEqual([makeRequestModule.HTTPMethod.DELETE, "/api/passkeys/pk%2F1"]);
  });

  test("hosted registration requires a signed-in user", async () => {
    stubBrowser();
    await expect(Promise.resolve().then(() => registerPasskey({ hosted: true }))).rejects.toThrow("signed in");
  });
});
