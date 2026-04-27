export class AppConfig {
  readonly promptsDir: string;
  readonly provider: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly apiKey?: string;

  constructor(argv: string[]) {
    let promptsDir = './prompts';
    let provider = 'deepseek';
    let baseUrl: string | undefined;
    let model: string | undefined;
    let apiKey: string | undefined;

    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i];
      switch (arg) {
        case '--prompts-dir':
          promptsDir = argv[++i];
          break;
        case '--provider':
          provider = argv[++i];
          break;
        case '--base-url':
          baseUrl = argv[++i];
          break;
        case '--model':
          model = argv[++i];
          break;
        case '--api-key':
          apiKey = argv[++i];
          break;
        default:
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
