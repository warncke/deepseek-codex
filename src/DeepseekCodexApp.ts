import { AppConfig } from './AppConfig.js';
import { DeepSeekProvider } from './DeepSeekProvider.js';
import { PromptLoader } from './PromptLoader.js';
import { ReplSession } from './ReplSession.js';
import { IInferenceProvider } from './interfaces.js';

export class DeepseekCodexApp {
  private config: AppConfig;
  private provider!: IInferenceProvider;
  private loader!: PromptLoader;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.provider !== 'deepseek') {
      throw new Error(
        `Unsupported provider: ${this.config.provider}. Only "deepseek" is supported.`,
      );
    }
    this.provider = new DeepSeekProvider();
    if (this.config.apiKey) {
      (this.provider as DeepSeekProvider)['apiKey'] = this.config.apiKey;
    }

    this.loader = new PromptLoader(this.config.promptsDir);
    const validation = await this.loader.validate();
    if (!validation.valid) {
      console.error(
        `Missing required files in ${this.config.promptsDir}: ${validation.missing.join(', ')}`,
      );
      process.exit(1);
    }

    console.log(`Deepseek Codex CLI v1.0`);
    console.log(`Provider:  ${this.provider.providerName}`);
    console.log(
      `Model:     ${this.config.model ?? (this.provider as DeepSeekProvider).defaultModel}`,
    );
    console.log(`Prompts:   ${this.config.promptsDir}/`);
    console.log(`Spec:      ${this.config.promptsDir}/technical-specification.md`);
    console.log(`\nType /help for commands.\n`);
  }

  async run(): Promise<void> {
    const session = new ReplSession(this.provider, this.loader);
    await session.start();
  }
}
