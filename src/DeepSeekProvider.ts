import type { ChatMessage, ChatOptions, IInferenceProvider } from './interfaces.js';

export class DeepSeekProvider implements IInferenceProvider {
  readonly providerName = 'DeepSeek V4';
  readonly apiKeyEnvVar = 'DEEPSEEK_API_KEY';

  private baseUrl = 'https://api.deepseek.com';
  private apiKey: string;
  private defaultModel = 'deepseek-v4-pro';

  constructor() {
    const key = process.env[this.apiKeyEnvVar];
    if (!key) {
      throw new Error(`DEEPSEEK_API_KEY environment variable is not set.`);
    }
    this.apiKey = key;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.thinking !== undefined) body.thinking = options.thinking;
    if (options?.reasoningEffort !== undefined) body.reasoning_effort = options.reasoningEffort;

    const url = `${this.baseUrl}/chat/completions`;

    let lastError: Error | null = null;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const status = response.status;

          if (status === 401) {
            throw new Error(
              `Authentication failed (401): Bad API key. Check your ${this.apiKeyEnvVar} environment variable.`,
            );
          }

          if (status === 429 || (status >= 500 && status < 600)) {
            if (attempt < maxAttempts - 1) {
              const delay = Math.pow(2, attempt) * 100;
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            if (status === 429) {
              throw new Error(`Rate limited (429): Too many requests. Please try again later.`);
            }
            throw new Error(`Server error (${status}): ${errorBody}. Please try again later.`);
          }

          throw new Error(`HTTP error ${status}: ${errorBody}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof Error && err.message.startsWith('Authentication failed')) {
          throw err;
        }
        if (
          err instanceof Error &&
          err.message.startsWith('Rate limited') &&
          attempt >= maxAttempts - 1
        ) {
          throw err;
        }
        if (
          err instanceof Error &&
          err.message.startsWith('Server error') &&
          attempt >= maxAttempts - 1
        ) {
          throw err;
        }
        if (attempt < maxAttempts - 1) {
          const delay = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }
}
