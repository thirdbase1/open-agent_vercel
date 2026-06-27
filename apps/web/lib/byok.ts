import { z } from "zod";

export const BYOK_CONNECTION_ID_PREFIX = "byok:";
export const BYOK_MODEL_ID_PREFIX = "byok:model:";

const BYOK_NAME_MAX_LENGTH = 80;
const BYOK_MODEL_NAME_MAX_LENGTH = 120;
const BYOK_MODEL_ID_MAX_LENGTH = 200;
const BYOK_HEADERS_MAX = 20;

/**
 * Wire formats the BYOK system understands. Mirrors `GatewayFormat` from the
 * agent package but defined here to avoid importing server/runtime code into
 * client bundles.
 */
export const byokFormatSchema = z.enum([
  "gateway",
  "openai-compatible",
  "anthropic",
]);
export type ByokFormat = z.infer<typeof byokFormatSchema>;

type JsonPrimitive = string | number | boolean | null;
export type ByokJsonValue =
  | JsonPrimitive
  | ByokJsonValue[]
  | { [key: string]: ByokJsonValue };

const jsonValueSchema: z.ZodType<ByokJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const byokProviderOptionsSchema = z.record(z.string(), jsonValueSchema);

const byokConnectionIdSchema = z
  .string()
  .trim()
  .min(1)
  .startsWith(BYOK_CONNECTION_ID_PREFIX);

const byokNameSchema = z.string().trim().min(1).max(BYOK_NAME_MAX_LENGTH);

const byokBaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "Base URL must start with http:// or https://",
  });

const byokModelIdSchema = z.string().trim().min(1).max(BYOK_MODEL_ID_MAX_LENGTH);

const byokHeadersSchema = z
  .record(z.string().trim().min(1), z.string())
  .refine((headers) => Object.keys(headers).length <= BYOK_HEADERS_MAX, {
    message: `At most ${BYOK_HEADERS_MAX} headers are allowed`,
  });

/** A single model exposed by a BYOK connection. */
export const byokModelSchema = z.object({
  /** Provider-native model id sent to the endpoint, e.g. "deepseek-chat". */
  modelId: byokModelIdSchema,
  /** Optional friendly display name shown in the picker. */
  name: z.string().trim().min(1).max(BYOK_MODEL_NAME_MAX_LENGTH).optional(),
  /** Optional context window (display metadata). */
  contextWindow: z.number().int().positive().optional(),
  /** Optional provider options merged into the request. */
  providerOptions: byokProviderOptionsSchema.optional(),
});
export type ByokModel = z.infer<typeof byokModelSchema>;

/**
 * A BYOK connection as exposed to the client. NOTE: never contains the raw
 * API key — only `hasApiKey` to indicate whether one is stored.
 */
export const byokConnectionSchema = z.object({
  id: byokConnectionIdSchema,
  name: byokNameSchema,
  format: byokFormatSchema,
  baseURL: byokBaseUrlSchema,
  headers: byokHeadersSchema.optional(),
  models: z.array(byokModelSchema),
  hasApiKey: z.boolean(),
});
export type ByokConnection = z.infer<typeof byokConnectionSchema>;

export const byokConnectionsSchema = z.array(byokConnectionSchema);

/** Public-facing BYOK state returned by the API (no secrets). */
export interface ByokState {
  connections: ByokConnection[];
  activeConnectionId: string | null;
}

const byokModelInputSchema = z.object({
  modelId: byokModelIdSchema,
  name: z.string().trim().min(1).max(BYOK_MODEL_NAME_MAX_LENGTH).optional(),
  contextWindow: z.number().int().positive().optional(),
  providerOptions: byokProviderOptionsSchema.optional(),
});

export const createByokConnectionInputSchema = z.object({
  name: byokNameSchema,
  format: byokFormatSchema,
  baseURL: byokBaseUrlSchema,
  apiKey: z.string().trim().min(1),
  headers: byokHeadersSchema.optional(),
  models: z.array(byokModelInputSchema).default([]),
});
export type CreateByokConnectionInput = z.infer<
  typeof createByokConnectionInputSchema
>;

export const updateByokConnectionInputSchema = z
  .object({
    id: byokConnectionIdSchema,
    name: byokNameSchema.optional(),
    format: byokFormatSchema.optional(),
    baseURL: byokBaseUrlSchema.optional(),
    // When omitted, the stored key is preserved. An empty string is rejected.
    apiKey: z.string().trim().min(1).optional(),
    headers: byokHeadersSchema.optional(),
    models: z.array(byokModelInputSchema).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.format !== undefined ||
      input.baseURL !== undefined ||
      input.apiKey !== undefined ||
      input.headers !== undefined ||
      input.models !== undefined,
    {
      message: "At least one field to update is required",
      path: ["id"],
    },
  );
export type UpdateByokConnectionInput = z.infer<
  typeof updateByokConnectionInputSchema
>;

export const deleteByokConnectionInputSchema = z.object({
  id: byokConnectionIdSchema,
});

export const setActiveByokConnectionInputSchema = z.object({
  // null clears the active connection (catalog reverts to default gateway).
  activeConnectionId: byokConnectionIdSchema.nullable(),
});

/**
 * Build the composite model picker id for a BYOK model.
 * Format: "byok:model:<connectionUuid>:<providerModelId>".
 */
export function buildByokModelOptionId(
  connectionId: string,
  modelId: string,
): string {
  const connectionUuid = connectionId.startsWith(BYOK_CONNECTION_ID_PREFIX)
    ? connectionId.slice(BYOK_CONNECTION_ID_PREFIX.length)
    : connectionId;
  return `${BYOK_MODEL_ID_PREFIX}${connectionUuid}:${modelId}`;
}

export function isByokModelOptionId(id: string): boolean {
  return id.startsWith(BYOK_MODEL_ID_PREFIX);
}

export interface ParsedByokModelOptionId {
  connectionId: string;
  modelId: string;
}

/**
 * Parse a composite BYOK model picker id back into its connection id and the
 * provider-native model id. Returns null when the id is not a BYOK model id or
 * is malformed.
 */
export function parseByokModelOptionId(
  id: string,
): ParsedByokModelOptionId | null {
  if (!isByokModelOptionId(id)) {
    return null;
  }

  const rest = id.slice(BYOK_MODEL_ID_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= rest.length - 1) {
    return null;
  }

  const connectionUuid = rest.slice(0, separatorIndex);
  const modelId = rest.slice(separatorIndex + 1);

  return {
    connectionId: `${BYOK_CONNECTION_ID_PREFIX}${connectionUuid}`,
    modelId,
  };
}

export interface ResolvedByokSelection {
  connection: ByokConnection;
  model: ByokModel;
}

/**
 * Resolve a composite BYOK model id against the user's connections.
 * Returns null when the connection or model no longer exists.
 */
export function resolveByokSelection(
  selectedModelId: string,
  connections: ByokConnection[],
): ResolvedByokSelection | null {
  const parsed = parseByokModelOptionId(selectedModelId);
  if (!parsed) {
    return null;
  }

  const connection = connections.find((item) => item.id === parsed.connectionId);
  if (!connection) {
    return null;
  }

  const model = connection.models.find(
    (item) => item.modelId === parsed.modelId,
  );
  if (!model) {
    return null;
  }

  return { connection, model };
}
