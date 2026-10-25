import { getAdministratorSession } from "@/lib/admin/access";
import {
  listAdminOrders,
} from "@/lib/admin/orders";
import { parseAdminOrderFilters } from "@/lib/admin/query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  const parsed = parseAdminOrderFilters(new URL(request.url).searchParams);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const data = await listAdminOrders(parsed.filters);
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Orders are unavailable. Check the database connection and selected filters." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
