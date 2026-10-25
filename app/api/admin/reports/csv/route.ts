import { getAdministratorSession } from "@/lib/admin/access";
import { createOrdersCsv } from "@/lib/admin/documents";
import { formatBusinessDateTime, InvalidDateRangeError } from "@/lib/admin/date-range";
import { getFilteredAdminOrders } from "@/lib/admin/orders";
import { parseAdminOrderFilters } from "@/lib/admin/query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const parsed = parseAdminOrderFilters(params);
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const orders = await getFilteredAdminOrders(parsed.filters);
    const csv = createOrdersCsv(orders, new Date(), formatBusinessDateTime);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mithai-orders-report.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const invalidRange = error instanceof InvalidDateRangeError;
    const message = invalidRange
      ? error.message
      : "The CSV report could not be generated. Check the database and report size.";
    return Response.json({ error: message }, { status: invalidRange ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
