/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as pins from "../pins.js";
import type * as posts from "../posts.js";
import type * as quickLinks from "../quickLinks.js";
import type * as userProfiles from "../userProfiles.js";
import type * as userProfilesModel from "../userProfilesModel.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  notes: typeof notes;
  notifications: typeof notifications;
  pins: typeof pins;
  posts: typeof posts;
  quickLinks: typeof quickLinks;
  userProfiles: typeof userProfiles;
  userProfilesModel: typeof userProfilesModel;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
