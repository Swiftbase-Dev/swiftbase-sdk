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
} from "./auth";
import type { LoginInput, ResetPasswordInput, AuthorizeOptions, TokenResponse } from "./auth";
import { getProfile, updateProfile, updateUser, changePassword } from "./profile";
import type { Profile, ProfileInput, ChangePasswordInput } from "./profile";
import {
  getUsers, getRoles, getServices,
  createRole, deleteRole,
  createService, deleteService,
  assignRole, unassignRole
} from "./identity";
import { db } from "./database";
import { Storage } from "./storage/storage";
import type { StorageOptions, BucketInfo, S3Object, ListObjectsResult } from "./storage/storage";

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
  Storage,
};
export type {
  LoginInput,
  ResetPasswordInput,
  AuthorizeOptions,
  TokenResponse,
  Profile,
  ProfileInput,
  ChangePasswordInput,
  StorageOptions,
  BucketInfo,
  S3Object,
  ListObjectsResult,
};
