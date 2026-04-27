import { IInferenceProvider, ChatMessage, ChatOptions } from './interfaces.js';

export class DeepSeekProvider implements IInferenceProvider {
  readonly providerName = 'DeepSeek V4';
  readonly apiKeyEnvVar = 'DEEPSEEK_API_KEY';
  private baseUrl = 'https://api.deepseek.com';
  private apiKey: string;
  readonly defaultModel = 'deepseek-v4-pro';

  constructor() {
    this.apiKey = process.env[this.apiKeyEnvVar] ?? '';
    if (!this.apiKey) {
      throw new Error(`Environment variable ${this.apiKeyEnvVar} is not set.`);
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempts = 3): Promise<Response> {
    let lastError: Error | null = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          const delay = Math.pow(2, i) * 100;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res;
      } catch (err) {
        lastError = err as Error;
        if (i === attempts - 1) break;
        const delay = Math.pow(2, i) * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`Request failed after ${attempts} attempts: ${lastError?.message}`);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.thinking) body.thinking = options.thinking;
    if (options?.reasoningEffort) body.reasoning_effort = options.reasoningEffort;

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid API response: missing message content');
    }
    return content;
  }
}
