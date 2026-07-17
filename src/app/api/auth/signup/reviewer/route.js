import { createUserForRole } from "../../../../../lib/auth/signup";
import { ROLES } from "../../../../../lib/auth/roles";

// Role is fixed by the route file itself. No input can change it.
export async function POST(request) {
  return createUserForRole(request, ROLES.REVIEWER);
}
