export class AppConfig {
  readonly promptsDir: string;
  readonly provider: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly apiKey?: string;
  readonly repl: boolean;
  readonly help: boolean;

  constructor(argv: string[]) {
    const args = argv.slice(2);

    let promptsDir = './prompts';
    let provider = 'deepseek';
    let baseUrl: string | undefined;
    let model: string | undefined;
    let apiKey: string | undefined;
    let repl = false;
    let help = false;

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--prompts-dir':
          promptsDir = args[++i] || promptsDir;
          break;
        case '--provider':
          provider = args[++i] || provider;
          break;
        case '--base-url':
          baseUrl = args[++i];
          break;
        case '--model':
          model = args[++i];
          break;
        case '--api-key':
          apiKey = args[++i];
          break;
        case '--repl':
          repl = true;
          break;
        case '--help':
          help = true;
          break;
      }
    }

    this.promptsDir = promptsDir;
    this.provider = provider;
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
    this.repl = repl;
    this.help = help;
  }

  static printHelp(): void {
    console.log(`Usage: deepseek-codex [options]

Options:
  --repl                 Start the interactive REPL session
  --prompts-dir <path>   Path to prompts directory (default: ./prompts)
  --provider <name>      Inference provider (default: deepseek)
  --base-url <url>       Custom API base URL
  --model <name>         Model name override
  --api-key <key>        API key override
  --help                 Show this help message and exit
`);
  }
}
