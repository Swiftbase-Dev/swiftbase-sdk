import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { ForgotPasswordInput, ResetPasswordConfirmInput, ResetPasswordInput } from "./types";

/**
  * Request a password reset email for an account
  *
  * @param {ForgotPasswordInput} input The forgot password input containing email and optional projectId
  * @returns {Promise<{ message: string }>} Result message from the server
  */
export const forgotPassword = async (
  input: ForgotPasswordInput
): Promise<{ message: string }> => {
  return await makeRequest(HTTPMethod.POST, "/api/forgot-password", undefined, input);
};

/**
  * Reset a user password using a token received via email
  * (Also backwards-compatible with ForgotPassword input)
  *
  * @param {ResetPasswordConfirmInput | ResetPasswordInput} input The reset password input
  * @returns {Promise<{ message: string }>} Result message from the server
  */
export const resetPassword = async (
  input: ResetPasswordConfirmInput | ResetPasswordInput
): Promise<{ message: string }> => {
  if ("token" in input && input.token && "password" in input && input.password) {
    return await makeRequest(HTTPMethod.POST, "/api/reset-password", undefined, {
      token: input.token,
      password: input.password,
    });
  }

  // Gracefully handle legacy invocation passing { email, projectId }
  const legacyInput = input as ResetPasswordInput;
  return await forgotPassword({
    email: legacyInput.email || "",
    projectId: legacyInput.projectId,
  });
};
