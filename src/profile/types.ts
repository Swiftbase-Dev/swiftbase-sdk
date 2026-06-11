export interface Profile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  projectId?: string;
  roles?: string[];
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntilAt?: string;
  attributes?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, any>;
}

export interface ChangePasswordInput {
  currentPassword?: string;
  newPassword?: string;
}
