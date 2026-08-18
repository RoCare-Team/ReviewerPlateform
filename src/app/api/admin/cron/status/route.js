import { apiRequireAdmin } from "../../../../../lib/auth/guards";
import { getCronStatus } from "../../../../../lib/cronStatus";

/**
 * "Is my cron actually running?" — JSON form, for quick checks/monitoring.
 * The admin panel page at /admin/cron-status renders this same data.
 */
export async function GET() {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const jobs = await getCronStatus();
  const allHealthy = jobs.every((j) => j.status === "healthy");
  return Response.json({ ok: allHealthy, jobs });
}
