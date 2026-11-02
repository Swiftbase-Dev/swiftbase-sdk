export interface Role {
  id: string;
  name: string;
  permissions: string[];
  projectId: string;
}

export interface RoleInput {
  name: string;
  permissions: string[];
  projectId: string;
}

export interface RoleUpdateInput {
  id: string;
  name?: string;
  permissions?: string[];
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  scope?: string[];
}

export interface ServiceInput {
  name: string;
  description?: string;
  projectId: string;
  secretKey: string;
  scope?: string[];
}

export interface ServiceUpdateInput {
  id: string;
  name?: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  projectId?: string;
  roles?: string[];
  approved?: boolean;
  attributes?: Record<string, any>;
}

export interface UserInput {
  email: string;
  password?: string;
  projectId: string;
  firstName?: string;
  lastName?: string;
  approved?: boolean;
}
