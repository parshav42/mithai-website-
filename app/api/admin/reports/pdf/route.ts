import { getAdministratorSession } from "@/lib/admin/access";
import { createOrdersPdf } from "@/lib/admin/documents";
import { formatBusinessDateTime, InvalidDateRangeError } from "@/lib/admin/date-range";
import { getReportOrders } from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  try {
    const orders = await getReportOrders(from, to);
    const pdf = await createOrdersPdf(
      `Orders ${from} through ${to}`,
      orders,
      new Date(),
      formatBusinessDateTime,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="mithai-orders-report.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const invalidRange = error instanceof InvalidDateRangeError;
    const message = invalidRange
      ? error.message
      : "The PDF report could not be generated. Check the database and report size.";
    return Response.json({ error: message }, { status: invalidRange ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
