import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  getUsers,
  getRoles,
  getServices,
  createRole,
  deleteRole,
  createService,
  deleteService,
  assignRole,
  unassignRole,
} from "../src/identity";
import * as makeRequestModule from "../src/common/makerequest";

vi.mock("../src/common/makerequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/common/makerequest")>();
  return {
    ...actual,
    makeRequest: vi.fn(),
  };
});

describe("Identity sub-module functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. getUsers
  test("getUsers should GET /api/users with projectId", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue([{ id: "u-1" }]);
    const res = await getUsers("p-123");
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.GET,
      "/api/users",
      { projectId: "p-123" }
    );
    expect(res).toEqual([{ id: "u-1" }]);
  });

  test("getUsers should handle PaginatedResponse and return its items", async () => {
    const paginated = new makeRequestModule.PaginatedResponse({
      data: [{ id: "u-1" }],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        next: null,
        back: null,
      },
    });
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue(paginated);
    const res = await getUsers("p-123");
    expect(res).toEqual([{ id: "u-1" }]);
  });

  // 2. getRoles
  test("getRoles should GET /api/roles with projectId", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue([{ id: "r-1" }]);
    const res = await getRoles("p-123");
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.GET,
      "/api/roles",
      { projectId: "p-123" }
    );
    expect(res).toEqual([{ id: "r-1" }]);
  });

  // 3. getServices
  test("getServices should GET /api/services with projectId", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue([{ id: "s-1" }]);
    const res = await getServices("p-123");
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.GET,
      "/api/services",
      { projectId: "p-123" }
    );
    expect(res).toEqual([{ id: "s-1" }]);
  });

  // 4. createRole
  test("createRole should POST to /api/roles", async () => {
    const input = { name: "admin" };
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ id: "role-1" });
    const res = await createRole(input);
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/roles",
      undefined,
      input
    );
    expect(res).toEqual({ id: "role-1" });
  });

  // 5. deleteRole
  test("deleteRole should DELETE /api/roles/:id", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ success: true });
    const res = await deleteRole("role-1");
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.DELETE,
      "/api/roles/role-1"
    );
    expect(res).toEqual({ success: true });
  });

  // 6. createService
  test("createService should POST to /api/services", async () => {
    const input = { name: "gateway" };
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ id: "svc-1" });
    const res = await createService(input);
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/services",
      undefined,
      input
    );
    expect(res).toEqual({ id: "svc-1" });
  });

  // 7. deleteService
  test("deleteService should DELETE /api/services/:id", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({ success: true });
    const res = await deleteService("svc-1");
    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.DELETE,
      "/api/services/svc-1"
    );
    expect(res).toEqual({ success: true });
  });

  // 8. assignRole
  test("assignRole should GET user, append role, and PUT user", async () => {
    const mockUser = { id: "u-123", roles: ["user"] };
    vi.mocked(makeRequestModule.makeRequest)
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce({ id: "u-123", roles: ["user", "admin"] });

    const res = await assignRole("u-123", "admin");

    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      1,
      makeRequestModule.HTTPMethod.GET,
      "/api/users/u-123"
    );
    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      2,
      makeRequestModule.HTTPMethod.PUT,
      "/api/users/u-123",
      undefined,
      { roles: ["user", "admin"] }
    );
    expect(res).toEqual({ id: "u-123", roles: ["user", "admin"] });
  });

  // 9. unassignRole
  test("unassignRole should GET user, remove role, and PUT user", async () => {
    const mockUser = { id: "u-123", roles: ["user", "admin"] };
    vi.mocked(makeRequestModule.makeRequest)
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce({ id: "u-123", roles: ["admin"] });

    const res = await unassignRole("u-123", "user");

    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      1,
      makeRequestModule.HTTPMethod.GET,
      "/api/users/u-123"
    );
    expect(makeRequestModule.makeRequest).toHaveBeenNthCalledWith(
      2,
      makeRequestModule.HTTPMethod.PUT,
      "/api/users/u-123",
      undefined,
      { roles: ["admin"] }
    );
    expect(res).toEqual({ id: "u-123", roles: ["admin"] });
  });
});
