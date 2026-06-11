import type { Profile } from "../profile/types.ts";

export interface AuthPayload {
  token: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: Profile;
}

export interface LoginInput {
  projectId: string;
  email: string;
  password?: string;
}

export interface ResetPasswordInput {
  projectId: string;
  email: string;
}

export interface AuthorizeOptions {
  redirectUri?: string;
  state?: string;
  scope?: string;
  prompt?: "login" | "none";
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user?: Profile;
}
