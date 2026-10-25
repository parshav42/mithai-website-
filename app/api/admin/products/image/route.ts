import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { getAdministratorSession } from "@/lib/admin/access";
import { validateProductImage, validateProductImageContent } from "@/lib/product-validation";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await getAdministratorSession())) {
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Product image storage is not configured." }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 32_768) {
    return Response.json({ error: "Image must be no larger than 4 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Choose a valid image file." }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a valid image file." }, { status: 400 });
  }
  const validation = validateProductImage(file);
  if (!validation.success) {
    return Response.json({ error: validation.error }, { status: 422 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateProductImageContent(file.type, bytes)) {
    return Response.json({ error: "The selected file contents do not match its image type." }, { status: 422 });
  }

  try {
    const blob = await put(
      `products/${randomUUID()}${validation.extension}`,
      new Blob([bytes], { type: file.type }),
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: file.type,
      },
    );
    return Response.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("Product image upload failed.", error);
    return Response.json({ error: "Image upload failed. Please try again." }, { status: 502 });
  }
}
