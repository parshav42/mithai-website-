import { releaseExpiredStockReservations } from "@/lib/payments/order-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const released = await releaseExpiredStockReservations();
    return Response.json({ released });
  } catch (error) {
    console.error("Expired stock reservations could not be released.", error);
    return Response.json({ error: "Reservations could not be released." }, { status: 503 });
  }
}
