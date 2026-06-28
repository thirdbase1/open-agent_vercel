import type { ModelMessage } from "ai";
import type { OpenAgentCallOptions } from "@open-agents/agent";

type StreamOptions = {
  messages: ModelMessage[];
  options?: Omit<OpenAgentCallOptions, "sandbox" | "skills">;
  abortSignal?: AbortSignal;
  modelId?: string;
};

function mapModelMessagesToApiMessages(messages: ModelMessage[]) {
  return messages.map((m) => {
    // ModelMessage shape can vary; try to extract text content robustly
    // Fallback to JSON stringify when content is structured.
    // @ts-ignore
    const content = (typeof m.content === "string"
      // @ts-ignore
      ? m.content
      : // @ts-ignore
      m.content?.text ?? JSON.stringify(m.content ?? ""));
    return {
      // @ts-ignore
      role: (m as any).role ?? "user",
      content,
    };
  });
}

function extractTextFromResponse(body: any): string | undefined {
  // Try OpenAI chat/completions: { choices: [{ message: { content: string } }] }
  if (body && Array.isArray(body.choices) && body.choices[0]) {
    const m = body.choices[0].message ?? body.choices[0].delta ?? body.choices[0];
    if (typeof m === "string") return m;
    if (m && typeof m.content === "string") return m.content;
    // Some providers use `text`
    if (typeof body.choices[0].text === "string") return body.choices[0].text;
  }

  // Try Responses API style: { output: [{ content: [{ type: 'output_text', text: '...' }] }] }
  if (body && Array.isArray(body.output) && body.output[0]) {
    const out = body.output[0];
    if (Array.isArray(out.content)) {
      for (const c of out.content) {
        if (c?.type === "output_text" && typeof c.text === "string") return c.text;
      }
    }
  }

  // Fallback: try top-level `text` or `message`
  if (body && typeof body.text === "string") return body.text;
  if (body && typeof body.message === "string") return body.message;

  return undefined;
}

export async function stream(params: StreamOptions) {
  const endpointBase =
    process.env.CUSTOM_AI_ENDPOINT ?? process.env.OPENAI_API_BASE ?? "https://api.freemodel.dev";
  // Default to Chat Completions endpoint for OpenAI compatibility
  const endpoint = endpointBase.replace(/\/+$/u, "") + "/v1/chat/completions";
  const key =
    process.env.CUSTOM_AI_KEY ?? process.env.FREEMODEL_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.API_KEY;

  const model =
    // @ts-ignore
    params.options?.model?.id ?? params.modelId ?? "openai-t1-sg";

  const apiMessages = mapModelMessagesToApiMessages(params.messages);

  const body = {
    model,
    messages: apiMessages,
    stream: false,
  };

  const controller = new AbortController();
  const signal = params.abortSignal ?? controller.signal;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  let parsed;
  try {
    parsed = await res.json();
  } catch (e) {
    parsed = undefined;
  }

  const text = extractTextFromResponse(parsed) ?? "";

  // Minimal compatible response object used by the workflow code.
  return {
    toUIMessageStream: async function* <T extends unknown>(opts: any) {
      const id = opts.generateMessageId();

      if (opts.sendStart !== false) {
        yield { type: "text-start", id } as any;
      }

      // Send the whole text as a single delta
      if (text.length > 0) {
        yield { type: "text-delta", id, delta: text } as any;
      }

      if (opts.sendFinish !== false) {
        yield { type: "text-end", id } as any;
      }

      // Inform the caller that we finished and provide a response message
      if (typeof opts.onFinish === "function") {
        const responseMessage = {
          role: "assistant",
          id,
          parts: [{ type: "text", text }],
        };
        opts.onFinish({ responseMessage });
      }
    },
    totalUsage: Promise.resolve(undefined),
    finishReason: Promise.resolve("completed"),
    rawFinishReason: Promise.resolve(undefined),
    response: Promise.resolve({ id: undefined, modelId: model, timestamp: new Date(), headers: {}, body: parsed }),
    steps: Promise.resolve([]),
  } as const;
}

export const gateway = { stream };
export default gateway;
