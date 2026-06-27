import type { AgentModelSelection } from "@open-agents/agent";
import type { GatewayConfig } from "@open-agents/agent";
import { isByokModelOptionId, parseByokModelOptionId } from "@/lib/byok";
import { resolveAvailableModelId } from "@/lib/model-availability";
import { type ModelVariant, resolveModelSelection } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import {
  resolveGatewayModelToByok,
  resolveModelToGatewayConfig,
  stripGatewayProviderPrefix,
} from "@/lib/resolve-byok-model";

interface ResolveChatModelSelectionParams {
  selectedModelId: string | null | undefined;
  modelVariants: ModelVariant[];
  missingVariantLabel: string;
  userId?: string;
  byokConnections?: any[];
  activeByokConnectionId?: string | null;
}

export async function resolveChatModelSelection({
  selectedModelId,
  modelVariants,
  missingVariantLabel,
  userId,
  byokConnections,
  activeByokConnectionId,
}: ResolveChatModelSelectionParams): Promise<AgentModelSelection> {
  const requestedModelId = selectedModelId ?? APP_DEFAULT_MODEL_ID;
  const selection = resolveModelSelection(requestedModelId, modelVariants);

  if (selection.isMissingVariant) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" was not found. Falling back to default model.`,
    );
    return { id: APP_DEFAULT_MODEL_ID as AgentModelSelection["id"] };
  }

  const availableModelId = resolveAvailableModelId(selection.resolvedModelId);
  if (availableModelId !== selection.resolvedModelId) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" resolves to disabled model "${selection.resolvedModelId}". Falling back to default model.`,
    );
    return { id: APP_DEFAULT_MODEL_ID as AgentModelSelection["id"] };
  }

  // Check if BYOK config should be applied.
  let config: GatewayConfig | undefined;
  // The model id actually sent to the provider. For an explicit BYOK model
  // selection this must be the provider-native model id (e.g. "claude-3-opus"),
  // NOT the composite "byok:model:<conn>:<modelId>" picker id.
  let runtimeModelId = availableModelId;

  if (isByokModelOptionId(availableModelId)) {
    // Explicit BYOK model selection: resolve the connection (for the endpoint +
    // key) and the provider-native model id from the composite id.
    if (userId && byokConnections) {
      config = resolveModelToGatewayConfig(
        availableModelId,
        byokConnections,
        activeByokConnectionId || null,
      );
    }
    const parsed = parseByokModelOptionId(availableModelId);

    if (!config || !parsed) {
      console.warn(
        `${missingVariantLabel} references BYOK model "${availableModelId}" but its connection could not be resolved. Falling back to default model.`,
      );
      return { id: APP_DEFAULT_MODEL_ID as AgentModelSelection["id"] };
    }

    runtimeModelId = parsed.modelId;
  } else if (userId && byokConnections) {
    // A hardcoded/catalog gateway model was selected. If the user added a
    // BYOK connection that includes a model with this same id (plus an
    // endpoint + key), transparently route the request through their own
    // endpoint. This takes priority over the global active connection so that
    // per-model overrides are honored exactly as the user configured them.
    const gatewayMatch = resolveGatewayModelToByok(
      availableModelId,
      byokConnections,
    );

    if (gatewayMatch) {
      config = gatewayMatch.config;
      runtimeModelId = gatewayMatch.modelId;
    } else {
      // Otherwise, an active connection may override the endpoint for all
      // gateway models.
      config = resolveModelToGatewayConfig(
        availableModelId,
        byokConnections,
        activeByokConnectionId || null,
      );

      // A BYOK connection always targets a real provider endpoint (anthropic,
      // openai-compatible, gemini), which expects the provider-native model id
      // WITHOUT the gateway "provider/" prefix. So when the active connection
      // routes a catalog model (e.g. "anthropic/claude-opus-4.6") through the
      // user's endpoint, send the stripped id ("claude-opus-4.6"). This lets a
      // single Anthropic connection serve ANY Anthropic model in the picker.
      if (config) {
        runtimeModelId = stripGatewayProviderPrefix(availableModelId);
      }
    }
  }

  return {
    id: runtimeModelId as AgentModelSelection["id"],
    ...(selection.providerOptionsByProvider
      ? {
          providerOptionsOverrides: selection.providerOptionsByProvider,
        }
      : {}),
    ...(config ? { config } : {}),
  };
}
