import { makeRequest, HTTPMethod } from "../common/makerequest";
import { setAccessToken } from "../common/app";
import type { LoginInput } from "./types";
import type { Profile } from "../profile/types";

/**
 * Login with email and password
 *
 * @param {LoginInput} input The login credentials
 *
 * @returns {Promise<Profile>} The user profile
 */
export const loginWithPassword = async (input: LoginInput): Promise<Profile> => {
  const data = await makeRequest(HTTPMethod.POST, "/api/login", undefined, input);
  
  const { token, user } = data;

  // Set tokens in app and storage
  setAccessToken(token);

  return user as Profile;
};
