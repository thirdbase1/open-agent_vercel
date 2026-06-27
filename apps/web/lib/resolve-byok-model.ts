import type { GatewayConfig } from "@open-agents/agent";
import {
  parseByokModelOptionId,
  type ByokConnection,
} from "@/lib/byok";

/**
 * Resolve a selected model ID (either gateway or byok:model:...) into a GatewayConfig
 * for the agent runtime.
 *
 * This function is server-side only and expects connection objects with decrypted API keys.
 * Client-side should just determine which connection to use, then fetch the config from the server.
 *
 * Returns undefined if the model selection is invalid or references a deleted connection.
 */
export function resolveModelToGatewayConfig(
  selectedModelId: string,
  byokConnectionsWithKeys: any[],
  activeByokConnectionId: string | null,
): GatewayConfig | undefined {
  // If it's a BYOK model ID, parse and resolve it
  if (selectedModelId.startsWith("byok:model:")) {
    const parsed = parseByokModelOptionId(selectedModelId);
    if (!parsed) return undefined;

    const connection = byokConnectionsWithKeys.find(
      (c) => c.id === parsed.connectionId
    );
    if (!connection || !connection.apiKey) return undefined;

    // The model specifies which connection and model to use
    return {
      format: connection.format,
      baseURL: connection.baseURL,
      apiKey: connection.apiKey,
      headers: connection.headers,
    };
  }

  // If an active BYOK connection is set, use it for all gateway models
  if (activeByokConnectionId) {
    const activeConnection = byokConnectionsWithKeys.find(
      (c) => c.id === activeByokConnectionId
    );
    if (activeConnection && activeConnection.apiKey) {
      return {
        format: activeConnection.format,
        baseURL: activeConnection.baseURL,
        apiKey: activeConnection.apiKey,
        headers: activeConnection.headers,
      };
    }
  }

  // No BYOK override - use default gateway
  return undefined;
}

/**
 * Strip a leading "provider/" prefix from a gateway model id.
 * e.g. "anthropic/claude-opus-4.6" -> "claude-opus-4.6". Returns the input
 * unchanged when there is no slash.
 */
export function stripGatewayProviderPrefix(modelId: string): string {
  const slashIndex = modelId.indexOf("/");
  return slashIndex >= 0 ? modelId.slice(slashIndex + 1) : modelId;
}

export interface ByokGatewayMatch {
  config: GatewayConfig;
  /** Provider-native model id to send to the BYOK endpoint. */
  modelId: string;
}

/**
 * Find a BYOK override for a hardcoded gateway model id.
 *
 * This lets a user transparently route a built-in/catalog model (e.g.
 * "anthropic/claude-opus-4.6") through their own endpoint + key, simply by
 * adding a model to one of their BYOK connections whose `modelId` matches
 * either the full gateway id or the provider-stripped id
 * ("claude-opus-4.6"). The first connection (with a stored key) that has a
 * matching model wins.
 *
 * Returns undefined when no connection provides a matching model, in which
 * case the caller should fall back to the active connection / default gateway.
 */
export function resolveGatewayModelToByok(
  gatewayModelId: string,
  byokConnectionsWithKeys: any[],
): ByokGatewayMatch | undefined {
  if (!Array.isArray(byokConnectionsWithKeys)) return undefined;

  const strippedId = stripGatewayProviderPrefix(gatewayModelId);

  for (const connection of byokConnectionsWithKeys) {
    if (!connection?.apiKey || !Array.isArray(connection.models)) {
      continue;
    }

    const match = connection.models.find(
      (model: any) =>
        model?.modelId === gatewayModelId || model?.modelId === strippedId,
    );
    if (!match) {
      continue;
    }

    return {
      config: {
        format: connection.format,
        baseURL: connection.baseURL,
        apiKey: connection.apiKey,
        headers: connection.headers,
      },
      // Send exactly the model id the user configured for their endpoint.
      modelId: match.modelId,
    };
  }

  return undefined;
}

/**
 * Helper to display the BYOK connection name in model picker.
 */
export function getByokConnectionDisplayName(
  selectedModelId: string,
  byokConnections: ByokConnection[]
): string | null {
  if (!selectedModelId.startsWith("byok:model:")) {
    return null;
  }

  const parsed = parseByokModelOptionId(selectedModelId);
  if (!parsed) return null;

  const connection = byokConnections.find(
    (c) => c.id === parsed.connectionId
  );
  const model = connection?.models.find((m) => m.modelId === parsed.modelId);

  if (!connection || !model) return null;

  // Display: "ConnectionName - ModelName (model-id)"
  return `${connection.name} - ${model.name || model.modelId}`;
}
