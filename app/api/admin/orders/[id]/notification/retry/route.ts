import { getAdministratorSession } from "@/lib/admin/access";
import { retryConfirmationNotification } from "@/lib/admin/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });
  try {
    const { id } = await context.params;
    const result = await retryConfirmationNotification(id);
    if (!result) return Response.json({ error: "No failed SMS is eligible for retry, or the retry limit was reached." }, { status: 409 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The SMS retry could not be processed. The order remains confirmed." }, { status: 503 });
  }
}
