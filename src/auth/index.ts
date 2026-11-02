import { loginWithPassword } from "./loginwithpassword";
import { loginService } from "./loginservice";
import { loginWithRedirect } from "./loginwithredirect";
import { handleRedirectCallback } from "./handleredirectcallback";
import { forgotPassword, resetPassword } from "./resetpassword";
import { isLoggedIn } from "./isloggedin";
import { logout } from "./logout";
import { getAccessToken } from "./getaccesstoken";
import { verifyToken, verifyServiceToken } from "./verifytoken";
import { registerPasskey, loginWithPasskey, listPasskeys, deletePasskey, isPasskeySupported } from "./passkeys";

import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordConfirmInput,
  ResetPasswordInput,
  AuthorizeOptions,
  TokenResponse,
  PasskeyCredential,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
} from "./types";

export {
  loginWithPassword,
  loginService as login,
  loginService,
  loginWithRedirect,
  handleRedirectCallback,
  forgotPassword,
  resetPassword,
  isLoggedIn,
  logout,
  getAccessToken,
  verifyToken,
  verifyServiceToken,
  registerPasskey,
  loginWithPasskey,
  listPasskeys,
  deletePasskey,
  isPasskeySupported,
};
export type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordConfirmInput,
  ResetPasswordInput,
  AuthorizeOptions,
  TokenResponse,
  PasskeyCredential,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
};
