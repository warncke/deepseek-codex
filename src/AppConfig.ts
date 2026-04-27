export class AppConfig {
  readonly promptsDir: string;
  readonly provider: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly apiKey?: string;

  constructor(argv: string[]) {
    const args = argv.slice(2);

    let promptsDir = "./prompts";
    let provider = "deepseek";
    let baseUrl: string | undefined;
    let model: string | undefined;
    let apiKey: string | undefined;

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--prompts-dir":
          promptsDir = args[++i] || promptsDir;
          break;
        case "--provider":
          provider = args[++i] || provider;
          break;
        case "--base-url":
          baseUrl = args[++i];
          break;
        case "--model":
          model = args[++i];
          break;
        case "--api-key":
          apiKey = args[++i];
          break;
      }
    }

    this.promptsDir = promptsDir;
    this.provider = provider;
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }
}
