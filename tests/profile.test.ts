import { expect, test, describe, vi, beforeEach } from "vitest";
import { getProfile, updateProfile, updateUser, changePassword } from "../src/profile";
import * as makeRequestModule from "../src/common/makerequest";

vi.mock("../src/common/makerequest", () => ({
  makeRequest: vi.fn(),
  HTTPMethod: {
    GET: "get",
    POST: "post",
    PUT: "put",
    PATCH: "patch",
    DELETE: "delete",
  },
}));

describe("Profile sub-module functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("getProfile should GET /api/me", async () => {
    const mockProfile = { id: "p-123", email: "me@me.com" };
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue(mockProfile);

    const profile = await getProfile();
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.GET,
      "/api/me"
    );
    expect(profile).toEqual(mockProfile);
  });

  test("updateProfile should get /api/me first, then PUT updated fields to /api/users/:id", async () => {
    const mockMe = { id: "me-id" };
    const mockUpdatedProfile = { id: "me-id", firstName: "New Name" };
    
    vi.mocked(makeRequestModule.makeRequest)
      .mockResolvedValueOnce(mockMe)
      .mockResolvedValueOnce(mockUpdatedProfile);

    const input = { firstName: "New Name" };
    const profile = await updateProfile(input);

    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      1,
      makeRequestModule.HTTPMethod.GET,
      "/api/me"
    );
    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      2,
      makeRequestModule.HTTPMethod.PUT,
      "/api/users/me-id",
      undefined,
      input
    );
    expect(profile).toEqual(mockUpdatedProfile);
  });

  test("updateUser should PUT updated fields to /api/users/:id directly", async () => {
    const mockUpdatedUser = { id: "other-id", firstName: "Admin Edit" };
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue(mockUpdatedUser);

    const input = { firstName: "Admin Edit" };
    const profile = await updateUser("other-id", input);

    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.PUT,
      "/api/users/other-id",
      undefined,
      input
    );
    expect(profile).toEqual(mockUpdatedUser);
  });

  test("changePassword should POST to /api/users/change-password", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ success: true });

    const input = { currentPassword: "old", newPassword: "new" };
    const result = await changePassword(input);

    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/users/change-password",
      undefined,
      input
    );
    expect(result).toEqual({ success: true });
  });
});
