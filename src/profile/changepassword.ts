import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { ChangePasswordInput } from "./types";

/**
 * Change the current user password
 *
 * @param {ChangePasswordInput} input The password change input
 *
 * @returns {Promise<{ success: boolean }>} The result of the password change request
 */
export const changePassword = async (input: ChangePasswordInput): Promise<{ success: boolean }> => {
  return await makeRequest(HTTPMethod.POST, "/api/users/change-password", undefined, input);
};
