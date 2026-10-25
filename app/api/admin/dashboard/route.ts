import { getAdministratorSession } from "@/lib/admin/access";
import { getDashboardMetrics } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  try {
    const data = await getDashboardMetrics();
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Dashboard data is unavailable. Check the database connection and migrations." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
