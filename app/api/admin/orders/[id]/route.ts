import { getAdministratorSession } from "@/lib/admin/access";
import {
  FULFILLMENT_STATUSES,
  getAdminOrderDetails,
  updateFulfillmentStatus,
} from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  try {
    const { id } = await context.params;
    const order = await getAdminOrderDetails(id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json(order, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Order details are unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Submit a JSON status update." }, { status: 415 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: "Request is too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Request must contain valid JSON." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("fulfillmentStatus" in body) ||
    typeof body.fulfillmentStatus !== "string" ||
    !FULFILLMENT_STATUSES.includes(body.fulfillmentStatus as (typeof FULFILLMENT_STATUSES)[number])
  ) {
    return Response.json({ error: "Choose a valid fulfillment status." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const result = await updateFulfillmentStatus(
      id,
      body.fulfillmentStatus as (typeof FULFILLMENT_STATUSES)[number],
      session.user.email ?? "shop-administrator",
    );
    if (!result.success) {
      const status = result.reason === "not-found" ? 404 : 409;
      const error =
        result.reason === "not-found"
          ? "Order not found."
          : result.reason === "payment-not-eligible"
            ? "Fulfillment can only be updated after a verified payment is recorded."
            : "That fulfillment status transition is not allowed.";
      return Response.json({ error }, { status });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "The fulfillment update could not be saved." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
