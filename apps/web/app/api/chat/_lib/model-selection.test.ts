import { describe, expect, test } from "bun:test";
import { BUILT_IN_VARIANTS, type ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { resolveChatModelSelection } from "./model-selection";

describe("resolveChatModelSelection", () => {
  test("returns direct model ids unchanged", async () => {
    const selection = await resolveChatModelSelection({
      selectedModelId: "openai/gpt-5",
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5",
    });
  });

  test("resolves variant ids with provider options", async () => {
    const modelVariants: ModelVariant[] = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5",
        providerOptions: {
          reasoningEffort: "medium",
        },
      },
    ];

    const selection = await resolveChatModelSelection({
      selectedModelId: "variant:openai-medium",
      modelVariants,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5",
      providerOptionsOverrides: {
        openai: {
          reasoningEffort: "medium",
          store: false,
        },
      },
    });
  });

  test("resolves built-in OpenAI variants with store false", async () => {
    const selection = await resolveChatModelSelection({
      selectedModelId: "variant:builtin:gpt-5.4-xhigh",
      modelVariants: BUILT_IN_VARIANTS,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5.4",
      providerOptionsOverrides: {
        openai: {
          reasoningEffort: "xhigh",
          reasoningSummary: "auto",
          store: false,
        },
      },
    });
  });

  test("falls back to the default model and warns when a variant is missing", async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const selection = await resolveChatModelSelection({
        selectedModelId: "variant:missing",
        modelVariants: [],
        missingVariantLabel: "Selected model variant",
      });

      expect(selection).toEqual({
        id: APP_DEFAULT_MODEL_ID,
      });
      expect(warnings).toEqual([
        [
          'Selected model variant "variant:missing" was not found. Falling back to default model.',
        ],
      ]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("uses the default model when no model id is provided", async () => {
    const selection = await resolveChatModelSelection({
      selectedModelId: null,
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: APP_DEFAULT_MODEL_ID,
    });
  });

  test("resolves a BYOK model id to the provider-native model id and config", async () => {
    const byokConnections = [
      {
        id: "byok:conn1",
        name: "My Claude",
        format: "anthropic" as const,
        baseURL: "https://api.anthropic.com/v1",
        apiKey: "sk-secret",
        headers: { "x-extra": "1" },
        models: [{ modelId: "claude-3-opus" }],
      },
    ];

    const selection = await resolveChatModelSelection({
      selectedModelId: "byok:model:conn1:claude-3-opus",
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
      userId: "user-1",
      byokConnections,
      activeByokConnectionId: null,
    });

    // The provider must receive the native model id, NOT the composite id.
    expect(selection.id).toBe("claude-3-opus");
    expect(selection.config).toEqual({
      format: "anthropic",
      baseURL: "https://api.anthropic.com/v1",
      apiKey: "sk-secret",
      headers: { "x-extra": "1" },
    });
  });

  test("falls back to the default model when a BYOK connection is missing", async () => {
    const selection = await resolveChatModelSelection({
      selectedModelId: "byok:model:deleted:claude-3-opus",
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
      userId: "user-1",
      byokConnections: [],
      activeByokConnectionId: null,
    });

    expect(selection).toEqual({ id: APP_DEFAULT_MODEL_ID });
  });
});
