"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { buildModelOptions, type ModelOption } from "@/lib/model-options";
import type { ByokConnection } from "@/lib/byok";
import type { AvailableModel } from "@/lib/models";
import type { ModelVariant } from "@/lib/model-variants";
import { fetcher } from "@/lib/swr";

interface ModelsResponse {
  models: AvailableModel[];
}

interface ModelVariantsResponse {
  modelVariants: ModelVariant[];
}

interface ByokResponse {
  connections: ByokConnection[];
  activeConnectionId: string | null;
}

interface UseModelOptionsConfig {
  initialModelOptions?: ModelOption[];
}

const EMPTY_MODELS: AvailableModel[] = [];
const EMPTY_MODEL_VARIANTS: ModelVariant[] = [];
const EMPTY_BYOK_CONNECTIONS: ByokConnection[] = [];
const EMPTY_MODEL_OPTIONS: ModelOption[] = [];

export function useModelOptions(config: UseModelOptionsConfig = {}) {
  const {
    data: modelsData,
    error: modelsError,
    isLoading: modelsLoading,
  } = useSWR<ModelsResponse>("/api/models", fetcher);

  const {
    data: variantsData,
    error: variantsError,
    isLoading: variantsLoading,
  } = useSWR<ModelVariantsResponse>("/api/settings/model-variants", fetcher);

  // BYOK connections are optional: a failure here must never block the base
  // model list, so its error/loading state is intentionally not surfaced.
  const { data: byokData } = useSWR<ByokResponse>("/api/byok", fetcher);

  const models = modelsData?.models ?? EMPTY_MODELS;
  const modelVariants = variantsData?.modelVariants ?? EMPTY_MODEL_VARIANTS;
  const byokConnections = byokData?.connections ?? EMPTY_BYOK_CONNECTIONS;
  const initialModelOptions = config.initialModelOptions ?? EMPTY_MODEL_OPTIONS;
  const hasCompleteFetchedData =
    modelsData !== undefined && variantsData !== undefined;

  const fetchedModelOptions = useMemo<ModelOption[]>(
    () => buildModelOptions(models, modelVariants, byokConnections),
    [models, modelVariants, byokConnections],
  );

  const modelOptions =
    hasCompleteFetchedData || initialModelOptions.length === 0
      ? fetchedModelOptions
      : initialModelOptions;

  return {
    modelOptions,
    models,
    modelVariants,
    loading:
      initialModelOptions.length === 0 &&
      !hasCompleteFetchedData &&
      (modelsLoading || variantsLoading),
    error: modelsError?.message ?? variantsError?.message ?? null,
  };
}
