import { revalidatePath } from "next/cache";
import { getAdministratorSession } from "@/lib/admin/access";
import { archiveProduct, listAdminProducts, saveProduct } from "@/lib/products";
import { validateProductInput } from "@/lib/product-validation";

export const dynamic = "force-dynamic";

async function readJson(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  const text = await request.text();
  if (text.length > 16_384) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await getAdministratorSession())) {
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  }
  try {
    return Response.json(
      { products: await listAdminProducts() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json({ error: "Products could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getAdministratorSession())) {
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  }
  const body = await readJson(request);
  if (body === null) {
    return Response.json({ error: "Submit valid product JSON (maximum 16 KB)." }, { status: 400 });
  }
  const validation = validateProductInput(body);
  if (!validation.success) {
    return Response.json({ error: validation.error }, { status: 422 });
  }
  try {
    const id = await saveProduct(null, validation.value);
    revalidateCatalog();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed.", error);
    return Response.json({ error: "Product could not be saved. Check that its name, category, and package are unique." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!(await getAdministratorSession())) {
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  }
  const body = await readJson(request);
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.id)
  ) {
    return Response.json({ error: "A valid product ID and details are required." }, { status: 400 });
  }
  if ("archived" in body) {
    if (body.archived !== true) {
      return Response.json({ error: "Only archiving is supported by this operation." }, { status: 400 });
    }
    try {
      if (!(await archiveProduct(body.id))) {
        return Response.json({ error: "Product not found or already archived." }, { status: 404 });
      }
      revalidateCatalog();
      return Response.json({ success: true });
    } catch {
      return Response.json({ error: "Product could not be archived." }, { status: 503 });
    }
  }

  const validation = validateProductInput(body);
  if (!validation.success) {
    return Response.json({ error: validation.error }, { status: 422 });
  }
  try {
    await saveProduct(body.id, validation.value);
    revalidateCatalog();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Product update failed.", error);
    return Response.json({ error: "Product could not be saved. Check that its name, category, and package are unique." }, { status: 409 });
  }
}

function revalidateCatalog() {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/products/[slug]", "page");
}
