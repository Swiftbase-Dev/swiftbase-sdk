import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { ResetPasswordInput } from "./types";

/**
 * Reset password for email
 *
 * @param {ResetPasswordInput} input The reset password input
 *
 * @returns {Promise<{ success: boolean }>} The result of the reset password request
 */
export const resetPassword = async (input: ResetPasswordInput): Promise<{ success: boolean }> => {
  return await makeRequest(HTTPMethod.POST, "/api/users/reset-password", undefined, input);
};
