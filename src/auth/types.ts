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

export interface PasskeyCredential {
  id: string;
  name: string;
  /** The WebAuthn relying party ID (hostname) this passkey is bound to; it only works on that origin. */
  rpId: string;
  deviceType?: string;
  backedUp: boolean;
  transports: string[];
  createdAt?: string;
  lastUsedAt?: string | null;
}

export interface PasskeyRegistrationOptions {
  /** Friendly label for the passkey */
  name?: string;
  /** Run the ceremony on the Swiftbase universal login page (popup) instead of the current page */
  hosted?: boolean;
}

export interface PasskeyLoginOptions {
  /** Optional email to narrow the passkeys offered to the user */
  email?: string;
}
