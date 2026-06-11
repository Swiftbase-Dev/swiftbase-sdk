import { app } from "../common/app";
import type { Profile } from "../profile/types";

/**
 * Handles the redirect callback from the Swiftbase-Auth service
 *
 * @param {string} url Optional URL to parse, defaults to window.location.href
 *
 * @returns {Promise<Profile>} The user profile
 */
export const handleRedirectCallback = async (url?: string): Promise<Profile> => {
  if (typeof window === "undefined" || !app.userManager) {
    throw new Error("handleRedirectCallback can only be used in a browser environment after initializeSdk");
  }

  const user = await app.userManager.signinRedirectCallback(url);

  if (!user.profile) {
    throw new Error("User profile not found in token response");
  }

  // user.profile is an IdTokenClaims object from oidc-client-ts
  // We need to map it to our Profile type
  return user.profile as unknown as Profile;
};
