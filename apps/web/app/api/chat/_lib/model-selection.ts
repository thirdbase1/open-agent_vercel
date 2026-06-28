import type { AgentModelSelection } from "@open-agents/agent";
import type { GatewayConfig } from "@open-agents/agent";
import { resolveAvailableModelId } from "@/lib/model-availability";
import { type ModelVariant, resolveModelSelection } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { resolveModelToGatewayConfig } from "@/lib/resolve-byok-model";

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

  // Check if BYOK config should be applied
  let config: GatewayConfig | undefined;
  if (userId && byokConnections) {
    config = resolveModelToGatewayConfig(
      availableModelId,
      byokConnections,
      activeByokConnectionId || null,
    );
  }

  return {
    id: availableModelId as AgentModelSelection["id"],
    ...(selection.providerOptionsByProvider
      ? {
          providerOptionsOverrides: selection.providerOptionsByProvider,
        }
      : {}),
    ...(config ? { config } : {}),
  };
}
