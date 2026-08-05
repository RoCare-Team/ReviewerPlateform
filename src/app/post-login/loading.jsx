import DashboardLoader from "../../components/shared/DashboardLoader";

// post-login/page.jsx is a server redirect — it queries the session, then
// immediately redirect()s, so it never itself paints anything. Without this,
// that query time (plus the credentials sign-in that preceded it) is a blank
// gap between "login button spins" and "dashboard appears".
export default function PostLoginLoading() {
  return <DashboardLoader label="Signing you in…" />;
}
