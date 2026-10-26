import {
  initializeSdk,
  setAccessToken,
  setRefreshToken,
  refreshTokens,
} from "./common/app";
import { PaginatedResponse } from "./common/makerequest";
import {
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
  registerPasskey,
  loginWithPasskey,
  listPasskeys,
  deletePasskey,
  isPasskeySupported,
} from "./auth";
import type {
  LoginInput,
  ResetPasswordInput,
  AuthorizeOptions,
  TokenResponse,
  PasskeyCredential,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
} from "./auth";
import { getProfile, updateProfile, updateUser, changePassword } from "./profile";
import type { Profile, ProfileInput, ChangePasswordInput } from "./profile";
import {
  getUsers, getRoles, getServices,
  createRole, deleteRole,
  createService, deleteService,
  assignRole, unassignRole
} from "./identity";
import { db, QueryBuilder } from "./database";
import type { BatchQueryResult } from "./database";
import { search } from "./database/search";
import { Storage } from "./storage/storage";
import type { StorageOptions, BucketInfo, S3Object, ListObjectsResult } from "./storage/storage";
import { ai } from "./ai";
import type { AIChatMessage, AIChatCompletionOptions, AIChatCompletionResponse } from "./ai";

export {
  initializeSdk,
  setAccessToken,
  setRefreshToken,
  refreshTokens,
  isLoggedIn,
  logout,
  getAccessToken,
  PaginatedResponse,
  loginWithPassword,
  login,
  loginService,
  loginWithRedirect,
  handleRedirectCallback,
  resetPassword,
  verifyToken,
  verifyServiceToken,
  registerPasskey,
  loginWithPasskey,
  listPasskeys,
  deletePasskey,
  isPasskeySupported,
  getProfile,
  updateProfile,
  updateUser,
  changePassword,
  getUsers,
  getRoles,
  getServices,
  createRole,
  deleteRole,
  createService,
  deleteService,
  assignRole,
  unassignRole,
  db,
  QueryBuilder,
  search,
  Storage,
  ai,
};
export type {
  BatchQueryResult,
  LoginInput,
  ResetPasswordInput,
  AuthorizeOptions,
  TokenResponse,
  PasskeyCredential,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
  Profile,
  ProfileInput,
  ChangePasswordInput,
  StorageOptions,
  BucketInfo,
  S3Object,
  ListObjectsResult,
  AIChatMessage,
  AIChatCompletionOptions,
  AIChatCompletionResponse,
};
