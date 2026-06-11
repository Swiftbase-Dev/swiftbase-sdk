import { app } from "../common/app";

/**
 * Checks if the user is currently logged in (has a valid session)
 *
 * @returns {boolean} True if logged in, false otherwise
 */
export const isLoggedIn = (): boolean => {
  return app.accessToken !== null && app.accessToken.isValid();
};
