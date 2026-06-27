import type { GatewayConfig } from "@open-agents/agent";
import { getActiveByokConnection, getByokConnection } from "@/lib/db/user-preferences";
import type { ByokModel } from "@/lib/byok";

/**
 * Resolve a model ID to a BYOK config if it refers to a BYOK model.
 * Returns null if the model is not a BYOK model or if the connection is missing.
 * 
 * Model IDs are prefixed with "byok:<connId>:<modelId>" to identify BYOK models.
 */
export async function resolveByokConfig(
  userId: string,
  modelId: string,
): Promise<{ config: GatewayConfig; model: ByokModel } | null> {
  if (!modelId.startsWith("byok:")) {
    return null;
  }

  const parts = modelId.split(":");
  if (parts.length < 3) {
    console.error(
      "[byok-resolver] Invalid BYOK model ID format:",
      modelId,
    );
    return null;
  }

  const connId = parts[1];
  const requestedModelId = parts.slice(2).join(":");

  const conn = await getByokConnection(userId, connId);
  if (!conn) {
    console.error(
      "[byok-resolver] BYOK connection not found:",
      connId,
    );
    return null;
  }

  if (!conn.apiKey) {
    console.error(
      "[byok-resolver] BYOK connection has no API key:",
      connId,
    );
    return null;
  }

  const model = conn.models.find(
    (m: typeof conn.models[0]) => m.modelId === requestedModelId,
  );
  if (!model) {
    console.error(
      "[byok-resolver] Model not found in connection:",
      requestedModelId,
      "in",
      connId,
    );
    return null;
  }

  return {
    config: {
      baseURL: conn.baseURL,
      apiKey: conn.apiKey,
      format: conn.format,
      headers: conn.headers,
      providerName: conn.name,
    },
    model,
  };
}

/**
 * Resolve the active BYOK connection and build a config for all models
 * from that connection. This is used to route existing AI-gateway models
 * through a BYOK endpoint.
 * 
 * Returns null if no active BYOK connection is set.
 */
export async function resolveActiveByokConfig(
  userId: string,
): Promise<GatewayConfig | null> {
  const activeConn = await getActiveByokConnection(userId);
  if (!activeConn || !activeConn.apiKey) {
    return null;
  }

  return {
    baseURL: activeConn.baseURL,
    apiKey: activeConn.apiKey,
    format: activeConn.format,
    headers: activeConn.headers,
    providerName: activeConn.name,
  };
}
