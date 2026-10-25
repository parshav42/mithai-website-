import { getAdministratorSession } from "@/lib/admin/access";
import {
  createOrderDocumentPdf,
  getInvoiceBusinessConfiguration,
} from "@/lib/admin/documents";
import { formatBusinessDateTime } from "@/lib/admin/date-range";
import { getAdminOrderDetails } from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; kind: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdministratorSession();
  if (!session) return Response.json({ error: "Administrator access required." }, { status: 401 });

  const { id, kind } = await context.params;
  if (!["label", "packing-slip", "invoice"].includes(kind)) {
    return Response.json({ error: "Document type is not supported." }, { status: 404 });
  }
  if (kind === "invoice" && !getInvoiceBusinessConfiguration()) {
    return Response.json(
      {
        error:
          "Invoice download is disabled until the shop confirms its legal name, address, phone, and invoice details.",
      },
      { status: 503 },
    );
  }

  try {
    const order = await getAdminOrderDetails(id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const shop = kind === "invoice" ? getInvoiceBusinessConfiguration() ?? undefined : undefined;
    const pdf = await createOrderDocumentPdf(
      order,
      kind as "label" | "packing-slip" | "invoice",
      formatBusinessDateTime,
      shop,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="order-${id}-${kind}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "The requested order document could not be generated." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
