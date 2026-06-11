import { makeRequest, HTTPMethod, PaginatedResponse } from "../common/makerequest";

export const getUsers = async (projectId: string) => {
  const response = await makeRequest(HTTPMethod.GET, "/api/users", { projectId });
  return response instanceof PaginatedResponse ? response.items : response;
};

export const getRoles = async (projectId: string) => {
  const response = await makeRequest(HTTPMethod.GET, "/api/roles", { projectId });
  return response instanceof PaginatedResponse ? response.items : response;
};

export const getServices = async (projectId: string) => {
  const response = await makeRequest(HTTPMethod.GET, "/api/services", { projectId });
  return response instanceof PaginatedResponse ? response.items : response;
};

export const createRole = async (input: any) => {
  return await makeRequest(HTTPMethod.POST, "/api/roles", undefined, input);
};

export const deleteRole = async (id: string) => {
  return await makeRequest(HTTPMethod.DELETE, `/api/roles/${id}`);
};

export const createService = async (input: any) => {
  return await makeRequest(HTTPMethod.POST, "/api/services", undefined, input);
};

export const deleteService = async (id: string) => {
  return await makeRequest(HTTPMethod.DELETE, `/api/services/${id}`);
};

export const assignRole = async (userId: string, roleName: string) => {
  const user = await makeRequest(HTTPMethod.GET, `/api/users/${userId}`);
  const roles = [...(user.roles || [])];
  if (!roles.includes(roleName)) {
    roles.push(roleName);
  }
  return await makeRequest(HTTPMethod.PUT, `/api/users/${userId}`, undefined, { roles });
};

export const unassignRole = async (userId: string, roleName: string) => {
  const user = await makeRequest(HTTPMethod.GET, `/api/users/${userId}`);
  const roles = (user.roles || []).filter((r: string) => r !== roleName);
  return await makeRequest(HTTPMethod.PUT, `/api/users/${userId}`, undefined, { roles });
};
