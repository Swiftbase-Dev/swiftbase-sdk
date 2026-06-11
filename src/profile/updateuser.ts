import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { Profile } from "./types.ts";

/**
 * Update any user profile (Admin only)
 *
 * @param {string} id The user ID to update
 * @param {any} input The profile data to update
 *
 * @returns {Promise<Profile>} The updated user profile
 */
export const updateUser = async (id: string, input: any): Promise<Profile> => {
  return await makeRequest(HTTPMethod.PUT, `/api/users/${id}`, undefined, input);
};
