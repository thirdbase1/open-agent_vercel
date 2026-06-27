import {
  APP_DEFAULT_MODEL_ID,
  type AvailableModel,
  type AvailableModelCost,
  getModelDisplayName,
} from "@/lib/models";
import {
  MODEL_VARIANT_ID_PREFIX,
  type ModelVariant,
} from "@/lib/model-variants";
import {
  buildByokModelOptionId,
  type ByokConnection,
  type ByokModel,
} from "@/lib/byok";
import {
  getProviderFromModelId,
  stripProviderPrefix,
} from "@/components/provider-icons";

export interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
  description?: string;
  isVariant: boolean;
  contextWindow?: number;
  cost?: AvailableModelCost;
  provider: string;
}

function toBaseModelOption(model: AvailableModel): ModelOption {
  const label = getModelDisplayName(model);
  const provider = getProviderFromModelId(model.id);
  return {
    id: model.id,
    label,
    shortLabel: stripProviderPrefix(label, provider),
    description: model.description ?? undefined,
    isVariant: false,
    contextWindow: model.context_window,
    ...(model.cost ? { cost: model.cost } : {}),
    provider,
  };
}

function toVariantOption(
  variant: ModelVariant,
  baseModel?: AvailableModel,
): ModelOption {
  const baseLabel = baseModel
    ? getModelDisplayName(baseModel)
    : variant.baseModelId;
  const provider = getProviderFromModelId(variant.baseModelId);

  return {
    id: variant.id,
    label: variant.name,
    shortLabel: stripProviderPrefix(variant.name, provider),
    description: `Variant of ${baseLabel}`,
    isVariant: true,
    contextWindow: baseModel?.context_window,
    ...(baseModel?.cost ? { cost: baseModel.cost } : {}),
    provider,
  };
}

/**
 * Build a picker option for a single BYOK model. The option id is the composite
 * "byok:model:<connectionId>:<modelId>" id, which the chat runtime parses back
 * into the connection (endpoint + key) and the provider-native model id.
 * Options are grouped under the connection name so they appear together.
 */
function toByokModelOption(
  connection: ByokConnection,
  model: ByokModel,
): ModelOption {
  const id = buildByokModelOptionId(connection.id, model.modelId);
  const label = model.name || model.modelId;
  return {
    id,
    label,
    shortLabel: label,
    description: `${connection.name} (BYOK)`,
    isVariant: false,
    contextWindow: model.contextWindow,
    provider: connection.name,
  };
}

/** Providers pinned to the top of the list, in order. */
const PRIORITY_PROVIDERS = ["anthropic", "openai"];

export interface ModelGroup {
  provider: string;
  label: string;
  options: ModelOption[];
}

/**
 * Group options by provider, sort groups (priority first, then alphabetical),
 * and within each group put base models before variants.
 */
export function groupByProvider(options: ModelOption[]): ModelGroup[] {
  const groups: Record<string, ModelOption[]> = {};
  const providers: string[] = [];
  for (const option of options) {
    const { provider } = option;
    if (!groups[provider]) {
      groups[provider] = [];
      providers.push(provider);
    }
    groups[provider].push(option);
  }

  // Sort: priority providers first (in order), then rest alphabetically
  providers.sort((a, b) => {
    const aIdx = PRIORITY_PROVIDERS.indexOf(a);
    const bIdx = PRIORITY_PROVIDERS.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return providers.map((provider) => ({
    provider,
    label: provider,
    options: groups[provider],
  }));
}

export function buildModelOptions(
  models: AvailableModel[],
  modelVariants: ModelVariant[],
  byokConnections: ByokConnection[] = [],
): ModelOption[] {
  const baseModelOptions = models.map(toBaseModelOption);
  const baseModelsById = new Map(models.map((model) => [model.id, model]));

  const variantOptions = modelVariants.map((variant) =>
    toVariantOption(variant, baseModelsById.get(variant.baseModelId)),
  );

  const byokOptions = byokConnections.flatMap((connection) =>
    connection.models.map((model) => toByokModelOption(connection, model)),
  );

  return [...baseModelOptions, ...variantOptions, ...byokOptions];
}

export function buildSessionChatModelOptions(
  models: AvailableModel[],
  modelVariants: ModelVariant[],
  byokConnections: ByokConnection[] = [],
): ModelOption[] {
  return buildModelOptions(models, modelVariants, byokConnections);
}

export function withMissingModelOption(
  modelOptions: ModelOption[],
  modelId: string | null | undefined,
): ModelOption[] {
  if (!modelId || modelOptions.some((option) => option.id === modelId)) {
    return modelOptions;
  }

  if (!modelId.startsWith(MODEL_VARIANT_ID_PREFIX)) {
    return modelOptions;
  }

  const label = `${modelId.slice(MODEL_VARIANT_ID_PREFIX.length)} (missing)`;

  return [
    ...modelOptions,
    {
      id: modelId,
      label,
      shortLabel: label,
      description: "Variant no longer exists",
      isVariant: true,
      contextWindow: undefined,
      provider: "unknown",
    },
  ];
}

export function getDefaultModelOptionId(modelOptions: ModelOption[]): string {
  if (modelOptions.some((option) => option.id === APP_DEFAULT_MODEL_ID)) {
    return APP_DEFAULT_MODEL_ID;
  }

  return modelOptions[0]?.id ?? APP_DEFAULT_MODEL_ID;
}
