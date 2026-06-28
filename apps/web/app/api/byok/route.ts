import { getServerSession } from "@/lib/session/get-server-session";
import {
  getByokConnections,
  upsertByokConnection,
  deleteByokConnection,
  setActiveByokConnection,
  getActiveByokConnectionId,
} from "@/lib/db/user-preferences";
import {
  createByokConnectionInputSchema,
  updateByokConnectionInputSchema,
  deleteByokConnectionInputSchema,
  setActiveByokConnectionInputSchema,
  type ByokConnection,
} from "@/lib/byok";
import { nanoid } from "nanoid";

/**
 * GET /api/byok
 * Fetch all BYOK connections and the active connection ID for the current user.
 * Returns public data only (no API keys).
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await getByokConnections(session.user.id);
    const activeConnectionId = await getActiveByokConnectionId(session.user.id);

    return Response.json({
      connections,
      activeConnectionId: activeConnectionId || null,
    });
  } catch (error) {
    console.error("[BYOK GET]", error);
    return Response.json(
      { error: "Failed to fetch BYOK connections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/byok
 * Create a new BYOK connection.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = createByokConnectionInputSchema.parse(body);

    const connectionId = `byok:${nanoid()}`;
    const created = await upsertByokConnection(session.user.id, {
      id: connectionId,
      name: input.name,
      format: input.format,
      baseURL: input.baseURL,
      apiKey: input.apiKey,
      headers: input.headers,
      models: input.models,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("validation")) {
      return Response.json(
        { error: `Invalid input: ${error.message}` },
        { status: 400 }
      );
    }
    console.error("[BYOK POST]", error);
    return Response.json(
      { error: "Failed to create BYOK connection" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/byok
 * Update an existing BYOK connection.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = updateByokConnectionInputSchema.parse(body);

    // Fetch existing connection to preserve apiKey if not provided
    const connections = await getByokConnections(session.user.id);
    const existing = connections.find((c) => c.id === input.id);
    if (!existing) {
      return Response.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    const updated = await upsertByokConnection(session.user.id, {
      id: input.id,
      name: input.name ?? existing.name,
      format: input.format ?? existing.format,
      baseURL: input.baseURL ?? existing.baseURL,
      apiKey: input.apiKey, // undefined means keep existing
      headers: input.headers ?? existing.headers,
      models: input.models ?? existing.models,
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes("validation")) {
      return Response.json(
        { error: `Invalid input: ${error.message}` },
        { status: 400 }
      );
    }
    console.error("[BYOK PATCH]", error);
    return Response.json(
      { error: "Failed to update BYOK connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/byok?id=byok:...
 * Delete a BYOK connection by ID.
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json(
        { error: "Connection ID required" },
        { status: 400 }
      );
    }

    const input = deleteByokConnectionInputSchema.parse({ id });
    await deleteByokConnection(session.user.id, input.id);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("validation")) {
      return Response.json(
        { error: `Invalid input: ${error.message}` },
        { status: 400 }
      );
    }
    console.error("[BYOK DELETE]", error);
    return Response.json(
      { error: "Failed to delete BYOK connection" },
      { status: 500 }
    );
  }
}
