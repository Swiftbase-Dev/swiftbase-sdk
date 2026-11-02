import { makeRequest, HTTPMethod, PaginatedResponse } from "../common/makerequest";
import type {
  Role,
  RoleInput,
  RoleUpdateInput,
  Service,
  ServiceInput,
  ServiceUpdateInput,
  User,
  UserInput,
} from "./types";

export const getUsers = async (projectId: string): Promise<User[]> => {
  const response = await makeRequest(HTTPMethod.GET, "/api/users", { projectId });
  return response instanceof PaginatedResponse ? (response.items as User[]) : response;
};

export const getRoles = async (projectId: string): Promise<Role[]> => {
  const response = await makeRequest(HTTPMethod.GET, "/api/roles", { projectId });
  return response instanceof PaginatedResponse ? (response.items as Role[]) : response;
};

export const getServices = async (projectId: string): Promise<Service[]> => {
  const response = await makeRequest(HTTPMethod.GET, "/api/services", { projectId });
  return response instanceof PaginatedResponse ? (response.items as Service[]) : response;
};

export const createRole = async (input: RoleInput): Promise<Role> => {
  return await makeRequest(HTTPMethod.POST, "/api/roles", undefined, input);
};

export const updateRole = async (input: RoleUpdateInput): Promise<Role> => {
  const { id, ...data } = input;
  return await makeRequest(HTTPMethod.PUT, `/api/roles/${id}`, undefined, data);
};

export const deleteRole = async (id: string): Promise<string> => {
  await makeRequest(HTTPMethod.DELETE, `/api/roles/${id}`);
  return id;
};

export const createService = async (input: ServiceInput): Promise<Service> => {
  return await makeRequest(HTTPMethod.POST, "/api/services", undefined, input);
};

export const updateService = async (input: ServiceUpdateInput): Promise<Service> => {
  const { id, ...data } = input;
  return await makeRequest(HTTPMethod.PUT, `/api/services/${id}`, undefined, data);
};

export const deleteService = async (id: string): Promise<string> => {
  await makeRequest(HTTPMethod.DELETE, `/api/services/${id}`);
  return id;
};

export const createUser = async (input: UserInput): Promise<User> => {
  return await makeRequest(HTTPMethod.POST, "/api/users", undefined, input);
};

export const deleteUser = async (id: string): Promise<string> => {
  await makeRequest(HTTPMethod.DELETE, `/api/users/${id}`);
  return id;
};

export const assignRole = async (userId: string, roleName: string): Promise<User> => {
  const user = await makeRequest(HTTPMethod.GET, `/api/users/${userId}`);
  const roles = [...(user.roles || [])];
  if (!roles.includes(roleName)) {
    roles.push(roleName);
  }
  return await makeRequest(HTTPMethod.PUT, `/api/users/${userId}`, undefined, { roles });
};

export const unassignRole = async (userId: string, roleName: string): Promise<User> => {
  const user = await makeRequest(HTTPMethod.GET, `/api/users/${userId}`);
  const roles = (user.roles || []).filter((r: string) => r !== roleName);
  return await makeRequest(HTTPMethod.PUT, `/api/users/${userId}`, undefined, { roles });
};

export type {
  Role,
  RoleInput,
  RoleUpdateInput,
  Service,
  ServiceInput,
  ServiceUpdateInput,
  User,
  UserInput,
};
