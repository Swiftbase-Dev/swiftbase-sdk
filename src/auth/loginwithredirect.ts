import { app } from "../common/app";
import type { AuthorizeOptions } from "./types";

/**
 * Redirects the user to the Swiftbase-Auth universal login page
 *
 * @param {AuthorizeOptions} options Optional authorization parameters
 */
export const loginWithRedirect = async (options: AuthorizeOptions = {}): Promise<void> => {
  if (typeof window === "undefined" || !app.userManager) {
    throw new Error("loginWithRedirect can only be used in a browser environment after initializeSdk");
  }

  const {
    redirectUri = window.location.origin,
    state,
    scope,
    prompt,
  } = options;

  await app.userManager.signinRedirect({
    redirect_uri: redirectUri,
    state,
    scope,
    prompt,
  });
};
