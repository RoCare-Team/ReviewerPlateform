import { auth } from "./index";

export async function getSession() {
  return auth();
}

/** The session user (id, email, role, status) or null. Cheap — reads the JWT. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
