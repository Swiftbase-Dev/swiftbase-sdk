import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { Profile } from "./types.js";

/**
 * Get the current user profile
 *
 * @returns {Promise<Profile>} The user profile
 */
export const getProfile = async (): Promise<Profile> => {
  return await makeRequest(HTTPMethod.GET, "/api/me");
};
