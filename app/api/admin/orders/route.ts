import { getAdministratorSession } from "@/lib/admin/access";
import {
  FULFILLMENT_STATUSES,
  listAdminOrders,
  PAYMENT_STATUSES,
} from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

function oneOf<T extends string>(value: string | null, options: readonly T[]) {
  return value && options.some((option) => option === value) ? (value as T) : undefined;
}

export async function GET(request: Request) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const pageValue = Number(query.get("page") ?? "1");
  const filters = {
    search: query.get("search") ?? undefined,
    from: query.get("from") ?? undefined,
    to: query.get("to") ?? undefined,
    page: Number.isInteger(pageValue) ? pageValue : 1,
    paymentStatus: oneOf(query.get("paymentStatus"), PAYMENT_STATUSES),
    fulfillmentStatus: oneOf(query.get("fulfillmentStatus"), FULFILLMENT_STATUSES),
  };
  if (Boolean(filters.from) !== Boolean(filters.to)) {
    return Response.json({ error: "Provide both a start date and an end date." }, { status: 400 });
  }

  try {
    const data = await listAdminOrders(filters);
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Orders are unavailable. Check the database connection and selected filters." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
