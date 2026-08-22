import { destroySession } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
