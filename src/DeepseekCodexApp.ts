import { AppConfig } from "./AppConfig.js";
import { DeepSeekProvider } from "./DeepSeekProvider.js";
import { PromptLoader } from "./PromptLoader.js";
import { ReplSession } from "./ReplSession.js";
import type { IInferenceProvider } from "./interfaces.js";

export class DeepseekCodexApp {
  private config: AppConfig;
  private provider!: IInferenceProvider;
  private loader!: PromptLoader;
  private session!: ReplSession;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const providers: Record<string, () => IInferenceProvider> = {
      deepseek: () => new DeepSeekProvider(),
    };

    const providerFactory = providers[this.config.provider];
    if (!providerFactory) {
      console.error(`Unsupported provider: ${this.config.provider}`);
      process.exit(1);
    }

    this.provider = providerFactory();

    if (this.config.apiKey) {
      if (this.provider instanceof DeepSeekProvider) {
        this.provider.setApiKey(this.config.apiKey);
      }
    }

    if (this.config.baseUrl) {
      if (this.provider instanceof DeepSeekProvider) {
        this.provider.setBaseUrl(this.config.baseUrl);
      }
    }

    if (this.config.model) {
      if (this.provider instanceof DeepSeekProvider) {
        this.provider.setDefaultModel(this.config.model);
      }
    }

    this.loader = new PromptLoader(this.config.promptsDir);

    const validation = await this.loader.validate();
    if (!validation.valid) {
      console.error("Missing required prompt files:");
      for (const file of validation.missing) {
        console.error(`  - ${file}`);
      }
      process.exit(1);
    }

    this.session = new ReplSession(this.provider, this.loader);
  }

  async run(): Promise<void> {
    const modelName = this.config.model || "deepseek-v4-pro";

    console.log("Deepseek Codex CLI v1.0");
    console.log(`Provider:  ${this.provider.providerName}`);
    console.log(`Model:     ${modelName}`);
    console.log(`Prompts:   ${this.config.promptsDir}/`);
    console.log(`Spec:      ${this.config.promptsDir}/technical-specification.md`);
    console.log();
    console.log("Type /help for commands.");
    console.log();

    await this.session.start();
  }
}
