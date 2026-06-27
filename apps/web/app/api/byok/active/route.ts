import { getServerSession } from "@/lib/session/get-server-session";
import {
  setActiveByokConnection,
  getActiveByokConnectionId,
} from "@/lib/db/user-preferences";
import { setActiveByokConnectionInputSchema } from "@/lib/byok";

/**
 * GET /api/byok/active
 * Get the currently active BYOK connection ID.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeConnectionId = await getActiveByokConnectionId(session.user.id);

    return Response.json({
      activeConnectionId: activeConnectionId || null,
    });
  } catch (error) {
    console.error("[BYOK Active GET]", error);
    return Response.json(
      { error: "Failed to fetch active connection" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/byok/active
 * Set the active BYOK connection (or clear it if activeConnectionId is null).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = setActiveByokConnectionInputSchema.parse(body);

    await setActiveByokConnection(session.user.id, input.activeConnectionId);

    return Response.json({
      activeConnectionId: input.activeConnectionId,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("validation")) {
      return Response.json(
        { error: `Invalid input: ${error.message}` },
        { status: 400 }
      );
    }
    console.error("[BYOK Active POST]", error);
    return Response.json(
      { error: "Failed to set active connection" },
      { status: 500 }
    );
  }
}
