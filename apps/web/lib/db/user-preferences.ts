import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { SandboxType } from "@/components/sandbox-selector-compact";
import { modelVariantsSchema, type ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import {
  normalizeGlobalSkillRefs,
  type GlobalSkillRef,
} from "@/lib/skills/global-skill-refs";
import { decryptSecret, encryptSecret } from "@/lib/byok-crypto";
import { db } from "./client";
import { userPreferences, type UserPreferences } from "./schema";

export type DiffMode = "unified" | "split";

export interface UserPreferencesData {
  defaultModelId: string;
  defaultSubagentModelId: string | null;
  defaultSandboxType: SandboxType;
  defaultDiffMode: DiffMode;
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  alertsEnabled: boolean;
  alertSoundEnabled: boolean;
  publicUsageEnabled: boolean;
  globalSkillRefs: GlobalSkillRef[];
  modelVariants: ModelVariant[];
  enabledModelIds: string[];
}

const DEFAULT_PREFERENCES: UserPreferencesData = {
  defaultModelId: APP_DEFAULT_MODEL_ID,
  defaultSubagentModelId: null,
  defaultSandboxType: "vercel",
  defaultDiffMode: "unified",
  autoCommitPush: false,
  autoCreatePr: false,
  alertsEnabled: true,
  alertSoundEnabled: true,
  publicUsageEnabled: false,
  globalSkillRefs: [],
  modelVariants: [],
  enabledModelIds: [],
};

const VALID_SANDBOX_TYPES: SandboxType[] = ["vercel"];
const VALID_DIFF_MODES: DiffMode[] = ["unified", "split"];

function normalizeSandboxType(value: unknown): SandboxType {
  if (value === "hybrid") {
    return "vercel";
  }

  if (
    typeof value === "string" &&
    VALID_SANDBOX_TYPES.includes(value as SandboxType)
  ) {
    return value as SandboxType;
  }

  return DEFAULT_PREFERENCES.defaultSandboxType;
}

function normalizeDiffMode(value: unknown): DiffMode {
  if (
    typeof value === "string" &&
    VALID_DIFF_MODES.includes(value as DiffMode)
  ) {
    return value as DiffMode;
  }

  return DEFAULT_PREFERENCES.defaultDiffMode;
}

function normalizeEnabledModelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function toUserPreferencesData(
  row?: Pick<
    UserPreferences,
    | "defaultModelId"
    | "defaultSubagentModelId"
    | "defaultSandboxType"
    | "defaultDiffMode"
    | "autoCommitPush"
    | "autoCreatePr"
    | "alertsEnabled"
    | "alertSoundEnabled"
    | "publicUsageEnabled"
    | "globalSkillRefs"
    | "modelVariants"
    | "enabledModelIds"
  >,
): UserPreferencesData {
  const parsedModelVariants = modelVariantsSchema.safeParse(
    row?.modelVariants ?? [],
  );

  return {
    defaultModelId: row?.defaultModelId ?? DEFAULT_PREFERENCES.defaultModelId,
    defaultSubagentModelId: row?.defaultSubagentModelId ?? null,
    defaultSandboxType: normalizeSandboxType(row?.defaultSandboxType),
    defaultDiffMode: normalizeDiffMode(row?.defaultDiffMode),
    autoCommitPush: row?.autoCommitPush ?? DEFAULT_PREFERENCES.autoCommitPush,
    autoCreatePr: row?.autoCreatePr ?? DEFAULT_PREFERENCES.autoCreatePr,
    alertsEnabled: row?.alertsEnabled ?? DEFAULT_PREFERENCES.alertsEnabled,
    alertSoundEnabled:
      row?.alertSoundEnabled ?? DEFAULT_PREFERENCES.alertSoundEnabled,
    publicUsageEnabled:
      row?.publicUsageEnabled ?? DEFAULT_PREFERENCES.publicUsageEnabled,
    globalSkillRefs: normalizeGlobalSkillRefs(row?.globalSkillRefs),
    modelVariants: parsedModelVariants.success ? parsedModelVariants.data : [],
    enabledModelIds: normalizeEnabledModelIds(row?.enabledModelIds),
  };
}

/**
 * Get user preferences, creating default preferences if none exist
 */
export async function getUserPreferences(
  userId: string,
): Promise<UserPreferencesData> {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return toUserPreferencesData(existing);
}

/**
 * Update user preferences, creating if they don't exist
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferencesData>,
): Promise<UserPreferencesData> {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    return toUserPreferencesData(updated);
  }

  // Create new preferences
  const [created] = await db
    .insert(userPreferences)
    .values({
      id: nanoid(),
      userId,
      defaultModelId:
        updates.defaultModelId ?? DEFAULT_PREFERENCES.defaultModelId,
      defaultSubagentModelId: updates.defaultSubagentModelId ?? null,
      defaultSandboxType:
        updates.defaultSandboxType ?? DEFAULT_PREFERENCES.defaultSandboxType,
      defaultDiffMode:
        updates.defaultDiffMode ?? DEFAULT_PREFERENCES.defaultDiffMode,
      autoCommitPush:
        updates.autoCommitPush ?? DEFAULT_PREFERENCES.autoCommitPush,
      autoCreatePr: updates.autoCreatePr ?? DEFAULT_PREFERENCES.autoCreatePr,
      alertsEnabled: updates.alertsEnabled ?? DEFAULT_PREFERENCES.alertsEnabled,
      alertSoundEnabled:
        updates.alertSoundEnabled ?? DEFAULT_PREFERENCES.alertSoundEnabled,
      publicUsageEnabled:
        updates.publicUsageEnabled ?? DEFAULT_PREFERENCES.publicUsageEnabled,
      globalSkillRefs:
        updates.globalSkillRefs ?? DEFAULT_PREFERENCES.globalSkillRefs,
      modelVariants: updates.modelVariants ?? DEFAULT_PREFERENCES.modelVariants,
      enabledModelIds:
        updates.enabledModelIds ?? DEFAULT_PREFERENCES.enabledModelIds,
    })
    .returning();

  return toUserPreferencesData(created);
}

/**
 * Get BYOK connections for a user, with API keys decrypted.
 * Server-side only: returns connections with decrypted keys.
 */
export async function getByokConnections(userId: string) {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!existing?.byokConnections || existing.byokConnections.length === 0) {
    return [];
  }

  return (existing.byokConnections as any[]).map((conn: any) => ({
    id: conn.id,
    name: conn.name,
    format: conn.format,
    baseURL: conn.baseURL,
    headers: conn.headers,
    models: conn.models,
    hasApiKey: conn.apiKeyEnc && conn.apiKeyEnc.length > 0,
    apiKey:
      conn.apiKeyEnc && conn.apiKeyEnc.length > 0
        ? decryptSecret(conn.apiKeyEnc)
        : null,
  }));
}

/**
 * Get a single BYOK connection by ID, with API key decrypted.
 */
export async function getByokConnection(userId: string, connectionId: string) {
  const connections = await getByokConnections(userId);
  return connections.find((c: any) => c.id === connectionId) ?? null;
}

/**
 * Get the active BYOK connection (if any), with API key decrypted.
 */
export async function getActiveByokConnection(userId: string) {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const activeId = existing?.byokActiveConnectionId;
  if (!activeId) {
    return null;
  }

  return getByokConnection(userId, activeId);
}

/**
 * Set the active BYOK connection. Pass null to clear.
 */
export async function setActiveByokConnection(
  userId: string,
  connectionId: string | null,
) {
  await db
    .update(userPreferences)
    .set({
      byokActiveConnectionId: connectionId,
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, userId));
}

/**
 * Add or update a BYOK connection.
 */
export async function upsertByokConnection(
  userId: string,
  connWithApiKey: any,
) {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const connections = (existing?.byokConnections ?? []) as any[];
  const idx = connections.findIndex((c) => c.id === connWithApiKey.id);

  let storedConn;
  if (idx >= 0) {
    const existingKey = connections[idx]?.apiKeyEnc;
    storedConn = {
      id: connWithApiKey.id,
      name: connWithApiKey.name,
      format: connWithApiKey.format,
      baseURL: connWithApiKey.baseURL,
      headers: connWithApiKey.headers,
      models: connWithApiKey.models,
      apiKeyEnc:
        connWithApiKey.apiKey && connWithApiKey.apiKey.length > 0
          ? encryptSecret(connWithApiKey.apiKey)
          : existingKey ?? null,
    };
    connections[idx] = storedConn;
  } else {
    storedConn = {
      id: connWithApiKey.id,
      name: connWithApiKey.name,
      format: connWithApiKey.format,
      baseURL: connWithApiKey.baseURL,
      headers: connWithApiKey.headers,
      models: connWithApiKey.models,
      apiKeyEnc:
        connWithApiKey.apiKey && connWithApiKey.apiKey.length > 0
          ? encryptSecret(connWithApiKey.apiKey)
          : null,
    };
    connections.push(storedConn);
  }

  await db
    .update(userPreferences)
    .set({
      byokConnections: connections,
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, userId));

  return {
    id: storedConn.id,
    name: storedConn.name,
    format: storedConn.format,
    baseURL: storedConn.baseURL,
    headers: storedConn.headers,
    models: storedConn.models,
    hasApiKey: storedConn.apiKeyEnc && storedConn.apiKeyEnc.length > 0,
    apiKey:
      storedConn.apiKeyEnc && storedConn.apiKeyEnc.length > 0
        ? decryptSecret(storedConn.apiKeyEnc)
        : null,
  };
}

/**
 * Delete a BYOK connection by ID.
 */
export async function deleteByokConnection(userId: string, connectionId: string) {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const connections = (
    (existing?.byokConnections ?? []) as any[]
  ).filter((c) => c.id !== connectionId);

  const updates: any = {
    byokConnections: connections,
    updatedAt: new Date(),
  };

  if (existing?.byokActiveConnectionId === connectionId) {
    updates.byokActiveConnectionId = null;
  }

  await db
    .update(userPreferences)
    .set(updates)
    .where(eq(userPreferences.userId, userId));
}
