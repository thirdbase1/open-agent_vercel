# BYOK (Bring Your Own Key) - SDK Integration Guide

This document verifies all AI SDK packages used in the BYOK implementation and their correct usage patterns based on official documentation.

## Verified SDK Packages

### 1. **@ai-sdk/anthropic** (v3.0.70+)
- **Purpose**: Native Anthropic Claude API support
- **Export**: `createAnthropic()`, `anthropic` default instance
- **Configuration**:
  ```ts
  import { createAnthropic } from '@ai-sdk/anthropic';
  const anthropic = createAnthropic({
    baseURL: 'https://api.deepseek.com/anthropic', // Custom endpoint
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: { 'X-Custom-Header': 'value' },
  });
  ```
- **Format Support**: Native Anthropic `/v1/messages` API
- **Models**: `claude-3-haiku-20240307`, `claude-opus-4.6`, etc.
- **Use Cases**: DeepSeek (Anthropic protocol), Zhipu GLM (Anthropic protocol)

### 2. **@ai-sdk/openai-compatible** (v2.0.51+)
- **Purpose**: OpenAI-compatible API wrapper for any provider
- **Export**: `createOpenAICompatible()`
- **Configuration**:
  ```ts
  import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
  const provider = createOpenAICompatible({
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
    headers: { 'HTTP-Referer': 'https://open-agents.dev' },
  });
  ```
- **Format Support**: OpenAI `/v1/chat/completions` API
- **Supported Providers**:
  - **DeepSeek** (`https://api.deepseek.com`) - Models: `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-reasoner`
  - **Alibaba Qwen** (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) - Models: `qwen-plus`, `qwen-turbo`, `qwen-max`
  - **Zhipu GLM** (`https://api.z.ai/api/paas/v4`) - Models: `glm-5.2`, `glm-4-turbo`
  - **OpenRouter** (`https://openrouter.ai/api/v1`) - 250+ models across all providers
  - **xAI Grok** (`https://api.x.ai/v1`) - Models: `grok-4.3`, `grok-4.20-non-reasoning`
  - **Local Ollama** (`http://localhost:11434/v1`) - Custom/open-source models
- **Use Cases**: Multi-provider access, cost-effective alternatives, local LLMs

### 3. **@ai-sdk/google** (v1.0.0+)
- **Purpose**: Google Gemini API integration
- **Export**: `createGoogle()`, `google` default instance
- **Configuration**:
  ```ts
  import { createGoogle } from '@ai-sdk/google';
  const google = createGoogle({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  });
  ```
- **Format Support**: Google Generative AI REST API
- **Models**: `gemini-3-pro-preview`, `gemini-2.5-flash`, `gemini-2-flash-001`
- **Features**: Tool calls, multimodal (images, video, audio), Interactions API with server-side state
- **Note**: Can also be accessed via Vercel AI Gateway (`@ai-sdk/openai-compatible`)

### 4. **@ai-sdk/xai** (Latest)
- **Purpose**: xAI Grok API integration
- **Export**: `createXai()`, `xai` default instance
- **Configuration**:
  ```ts
  import { createXai } from '@ai-sdk/xai';
  const xai = createXai({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });
  ```
- **Format Support**: OpenAI-compatible (native) + Responses API (agentic)
- **Models**: `grok-4.3`, `grok-4.20-non-reasoning`
- **Agentic Tools**: `web_search`, `x_search`, `code_execution`, `view_image`, `file_search`
- **Note**: Also works via `@ai-sdk/openai-compatible` wrapper

### 5. **@ai-sdk/azure** (v3.0.66+)
- **Purpose**: Azure OpenAI API integration
- **Export**: `createAzure()`, `azure` default instance
- **Configuration**:
  ```ts
  import { createAzure } from '@ai-sdk/azure';
  const azure = createAzure({
    resourceName: 'my-resource-name',
    apiKey: process.env.AZURE_API_KEY,
    apiVersion: '2024-08-01-preview', // Optional version
  });
  ```
- **Format Support**: Azure OpenAI REST API (`/v1/chat/completions`)
- **Auth**: API key or Microsoft Entra ID (using `@azure/identity`)
- **Deployment Models**: Access via deployment names (e.g., `gpt-4-deployment`)
- **Use Cases**: Enterprise deployments, compliance requirements, Azure ecosystem

### 6. **@ai-sdk/deepseek** (Latest)
- **Purpose**: Native DeepSeek API integration
- **Export**: `createDeepSeek()`, `deepseek` default instance
- **Configuration**:
  ```ts
  import { createDeepSeek } from '@ai-sdk/deepseek';
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com', // Can be overridden for custom endpoints
  });
  ```
- **Format Support**: DeepSeek OpenAI-compatible format
- **Models**: `deepseek-v4-pro`, `deepseek-v4-flash` (with thinking modes)
- **Note**: Also works via `@ai-sdk/openai-compatible` wrapper

## BYOK Integration Architecture

### Gateway Factory Pattern
```ts
// In packages/agent/models.ts
function buildBaseModel(
  modelId: string,
  config: GatewayConfig | undefined,
): LanguageModel {
  if (!config) {
    return createGateway({ headers: attributionHeaders })(modelId);
  }

  const format = config.format ?? "gateway";

  if (format === "openai-compatible") {
    const provider = createOpenAICompatible({
      name: config.providerName ?? "byok",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      headers: config.headers,
    });
    return provider(modelId);
  }

  if (format === "anthropic") {
    const provider = createAnthropic({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      headers: config.headers,
    });
    return provider(modelId);
  }

  // Default: Vercel AI Gateway protocol
  return createGateway({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    headers: config.headers,
  })(modelId);
}
```

### Type Definitions
```ts
export type GatewayFormat = 
  | "gateway"              // Vercel AI Gateway or compatible
  | "openai-compatible"   // OpenAI /v1/chat/completions format
  | "anthropic";          // Anthropic /v1/messages format

export interface GatewayConfig {
  baseURL: string;
  apiKey: string;
  format?: GatewayFormat;
  headers?: Record<string, string>;
  providerName?: string;  // Used by openai-compatible provider
}
```

## Configuration Scenarios

### Scenario 1: DeepSeek with OpenAI Format
```ts
const config: GatewayConfig = {
  baseURL: "https://api.deepseek.com",
  apiKey: "sk-...",
  format: "openai-compatible",
  providerName: "DeepSeek",
};
const model = gateway("deepseek-v4-pro", { config });
```

### Scenario 2: DeepSeek with Anthropic Format
```ts
const config: GatewayConfig = {
  baseURL: "https://api.deepseek.com/anthropic",
  apiKey: "sk-...",
  format: "anthropic",
};
const model = gateway("deepseek-v4-pro", { config });
```

### Scenario 3: Qwen via Alibaba DashScope
```ts
const config: GatewayConfig = {
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-...",
  format: "openai-compatible",
  providerName: "Qwen",
  headers: { "X-DashScope-Region": "singapore" },
};
const model = gateway("qwen-plus", { config });
```

### Scenario 4: Local Ollama
```ts
const config: GatewayConfig = {
  baseURL: "http://localhost:11434/v1",
  apiKey: "not-required",
  format: "openai-compatible",
  providerName: "Ollama",
};
const model = gateway("mistral", { config });
```

### Scenario 5: Azure OpenAI
```ts
const config: GatewayConfig = {
  baseURL: "https://my-resource.openai.azure.com/openai/v1",
  apiKey: "...",
  format: "gateway",
  headers: { "api-key": "..." }, // Azure uses api-key header
};
const model = gateway("gpt-4-deployment", { config });
```

## Provider Base URLs Reference

| Provider | Format | Base URL | API Key Required |
|----------|--------|----------|------------------|
| **DeepSeek** | OpenAI | `https://api.deepseek.com` | Yes (`sk-...`) |
| **DeepSeek** | Anthropic | `https://api.deepseek.com/anthropic` | Yes (`sk-...`) |
| **Qwen (Singapore)** | OpenAI | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Yes |
| **Qwen (China)** | OpenAI | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Yes |
| **GLM (International)** | OpenAI | `https://api.z.ai/api/paas/v4` | Yes |
| **GLM (China)** | OpenAI | `https://open.bigmodel.cn/api/paas/v4` | Yes |
| **GLM** | Anthropic | `https://api.z.ai/api/anthropic` | Yes |
| **OpenRouter** | OpenAI | `https://openrouter.ai/api/v1` | Yes |
| **xAI Grok** | OpenAI | `https://api.x.ai/v1` | Yes |
| **Google Gemini** | Native | Use `@ai-sdk/google` | Yes (GOOGLE_GENERATIVE_AI_API_KEY) |
| **Azure OpenAI** | Native | `https://{resource}.openai.azure.com/openai/v1` | Yes (api-key header) |
| **Local Ollama** | OpenAI | `http://localhost:11434/v1` | No |

## Security Considerations

1. **Encrypted Key Storage**: All BYOK API keys are encrypted with AES-256-GCM using `BETTER_AUTH_SECRET`
2. **Server-Side Resolution**: Keys are never returned to the client; only `hasApiKey` boolean is exposed
3. **Per-Request Headers**: Optional headers (e.g., custom authorization, attribution) merge with built-in headers
4. **Isolated Connections**: Each BYOK connection is independent; deleting a connection clears active routing

## Troubleshooting

### "Model not found" error
- Verify the model ID matches the provider's available models
- Check the base URL is correct for the region/deployment
- Ensure API key has permission for that model

### "Invalid format" error
- Confirm `format` matches the provider's API protocol
- DeepSeek supports both OpenAI and Anthropic formats
- Azure requires careful URL construction with deployment names

### "Connection refused" with local LLM
- Ensure Ollama (or similar) is running on the configured port
- Default Ollama port is `11434`; verify in local settings

## References

- [AI SDK Documentation](https://ai-sdk.dev/)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [Alibaba Qwen Docs](https://www.alibabacloud.com/help/en/model-studio/)
- [Zhipu GLM Docs](https://open.bigmodel.cn/dev/api)
- [OpenRouter Docs](https://openrouter.ai/docs/)
- [xAI Grok Docs](https://docs.x.ai/)
- [Google Gemini Docs](https://ai.google.dev/)
- [Azure OpenAI Docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
