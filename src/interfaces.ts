export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: { type: 'enabled' | 'disabled' };
  reasoningEffort?: 'high' | 'max';
  stream?: boolean;
}

export interface IInferenceProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  readonly providerName: string;
  readonly apiKeyEnvVar: string;
}

export interface IReplCommand {
  readonly description: string;
  execute(args: string[], session: any): Promise<void>;
}
