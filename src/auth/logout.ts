import { app } from "../common/app";

/**
 * Logs the user out by clearing tokens and redirecting to the logout page
 */
export const logout = async (): Promise<void> => {
  if (typeof window === "undefined" || !app.userManager) {
    // Fallback if userManager is not available
    app.accessToken = null;
    app.refreshToken = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("swiftbase_access_token");
      window.sessionStorage.removeItem("swiftbase_refresh_token");
    }
    return;
  }

  await app.userManager.signoutRedirect();
};
