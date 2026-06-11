import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { Profile, ProfileInput } from "./types.ts";

/**
 * Update the current user profile
 *
 * @param {ProfileInput} input The profile data to update
 *
 * @returns {Promise<Profile>} The updated user profile
 */
export const updateProfile = async (input: ProfileInput): Promise<Profile> => {
  // Fetch current user to get ID
  const me = await makeRequest(HTTPMethod.GET, "/api/me");
  return await makeRequest(HTTPMethod.PUT, `/api/users/${me.id}`, undefined, input);
};
