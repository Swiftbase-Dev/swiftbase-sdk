import { app } from "../common/app";

/**
 * Gets the current access token, refreshing it if necessary
 *
 * @param {boolean} forceRefresh If true, the token will be refreshed even if it's not expired
 *
 * @returns {Promise<string | null>} The access token, or null if no session exists
 */
export const getAccessToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  if (typeof window === "undefined" || !app.userManager) {
    return app.accessToken ? app.accessToken.value() : null;
  }

  let user = await app.userManager.getUser();

  if (forceRefresh || !user || user.expired) {
    try {
      user = await app.userManager.signinSilent();
    } catch (e) {
      // If silent refresh fails, we might still have a token in app state from a manual refresh
      // but ideally we should rely on userManager.
      console.warn("Failed to silently refresh token during getAccessToken", e);
    }
  }

  return user ? user.access_token : (app.accessToken ? app.accessToken.value() : null);
};
