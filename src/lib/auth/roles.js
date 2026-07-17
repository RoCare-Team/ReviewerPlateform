import rolesData from "../../../data/roles.json";

// Role constants — import these, never string-literal a role.
export const ROLES = Object.freeze({
  REVIEWER: "reviewer",
  BUSINESS_OWNER: "business_owner",
  ADMIN: "admin",
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

/** Roles a user may self-register as. Derived from data, not hardcoded. */
export const SELF_SIGNUP_ROLES = Object.freeze(
  Object.entries(rolesData.roles)
    .filter(([, cfg]) => cfg.signup === "open")
    .map(([key]) => key)
);

export function isRole(value) {
  return ALL_ROLES.includes(value);
}

export function getRoleConfig(role) {
  const cfg = rolesData.roles[role];
  if (!cfg) throw new Error(`Unknown role: ${role}`);
  return cfg;
}

export function canSelfSignup(role) {
  return isRole(role) && getRoleConfig(role).signup === "open";
}

export function supportsAuthMethod(role, method) {
  return isRole(role) && getRoleConfig(role).auth.includes(method);
}

export function requiresOtp(role) {
  return isRole(role) && getRoleConfig(role).otp === true;
}

export function requiresTotp(role) {
  return isRole(role) && getRoleConfig(role).totp === true;
}

/** Where this role lands after login. */
export function homeFor(role) {
  return isRole(role) ? getRoleConfig(role).home : "/";
}

export function sessionMaxAge(role) {
  return isRole(role) ? getRoleConfig(role).sessionMaxAgeSeconds : 1800;
}

export { rolesData };
