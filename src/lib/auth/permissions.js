import { rolesData, isRole } from "./roles";

const MATRIX = rolesData.permissions;

/**
 * Does `granted` cover `action`?
 *   "*"          → everything
 *   "campaign:*" → "campaign:create", "campaign:delete", ...
 *   exact match  → itself
 *
 * Only a trailing ":*" is treated as a wildcard. "campaign:*" does NOT match
 * "campaigns:create" — the colon boundary is required, so a new resource named
 * with a shared prefix can't silently inherit another role's grants.
 */
function grantCovers(granted, action) {
  if (granted === "*") return true;
  if (granted === action) return true;
  if (granted.endsWith(":*")) {
    const prefix = granted.slice(0, -1); // "campaign:*" -> "campaign:"
    return action.startsWith(prefix) && action.length > prefix.length;
  }
  return false;
}

export function permissionsFor(role) {
  if (!isRole(role)) return [];
  return MATRIX[role] ?? [];
}

/**
 * can(user, "campaign:create")
 *
 * Suspended and pending users can do nothing, regardless of role — status is
 * checked here so a single call site covers both dimensions.
 */
export function can(user, action) {
  if (!user || !action) return false;
  if (user.status && user.status !== "active") return false;
  return permissionsFor(user.role).some((g) => grantCovers(g, action));
}

export function canAny(user, actions) {
  return actions.some((a) => can(user, a));
}

export function canAll(user, actions) {
  return actions.every((a) => can(user, a));
}
