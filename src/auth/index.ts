import { loginWithPassword } from "./loginwithpassword";
import { loginService } from "./loginservice";
import { loginWithRedirect } from "./loginwithredirect";
import { handleRedirectCallback } from "./handleredirectcallback";
import { resetPassword } from "./resetpassword";
import { isLoggedIn } from "./isloggedin";
import { logout } from "./logout";
import { getAccessToken } from "./getaccesstoken";
import { verifyToken, verifyServiceToken } from "./verifytoken";

import type { LoginInput, ResetPasswordInput, AuthorizeOptions, TokenResponse } from "./types";

export {
  loginWithPassword,
  loginService as login,
  loginService,
  loginWithRedirect,
  handleRedirectCallback,
  resetPassword,
  isLoggedIn,
  logout,
  getAccessToken,
  verifyToken,
  verifyServiceToken,
};
export type { LoginInput, ResetPasswordInput, AuthorizeOptions, TokenResponse };
