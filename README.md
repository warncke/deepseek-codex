# Deepseek Codex

Interactive AI‑assisted system design CLI using the DeepSeek API. Implements the **Prompting Work Flow** – revise technical paper → generate technical specification → apply → repeat – via an extensible REPL.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd deekseek-codex

# Install dependencies
npm install

# Build the TypeScript sources
npm run build

# Set your DeepSeek API key
export DEEPSEEK_API_KEY="your-api-key"

# Run the CLI
npx deekseek-codex
```

````

## 📦 Prerequisites

- **Node.js** ≥ 18.0.0 (≥ 24.15.0 LTS recommended)
- **npm** (comes with Node.js)
- A [DeepSeek API key](https://platform.deepseek.com/)

## 🛠️ Development Workflow

All source files live in `src/`. Compiled output goes to `lib/`.

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

Watches for changes (if you prefer):

```bash
npx tsc --watch
```

### Run tests

```bash
npm test
```

Tests use `ts-jest` with ESM support. All network calls are mocked – no live API key required.

### Lint

```bash
npm run lint
```

### Format code

```bash
npm run format
```

### Prepare (automatically runs `npm run build`)

```bash
npm run prepare
```

## 📂 Project Structure

```
.
├── bin/
│   └── deekseek-codex.mjs   # Shebang entry point
├── src/
│   ├── interfaces.ts
│   ├── DeepSeekProvider.ts
│   ├── PromptLoader.ts
│   ├── AppConfig.ts
│   ├── ReplSession.ts
│   ├── DeepseekCodexApp.ts
│   └── index.ts             # Main exported logic
├── tests/
│   └── deekseek-codex.test.ts
├── prompts/                 # Runtime directory (must exist)
│   ├── system-design-agent.md
│   ├── npm-project-creation-prompt.md
│   └── technical-specification.md
├── lib/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md
```

## 🧪 Testing Guidelines

- **Unit tests** are mandatory for `PromptLoader`, `AppConfig`, `DeepSeekProvider`, and REPL commands.
- Use `jest.mock('node:fs/promises')` for file system tests.
- Mock `global.fetch` for provider tests (simulate 200, 401, 429, retries).
- Never perform live API calls in tests.

## 🔧 Configuration

The CLI respects the following environment variables and command‑line arguments:

| Argument        | Env variable       | Default            | Description                                  |
| --------------- | ------------------ | ------------------ | -------------------------------------------- |
| `--prompts-dir` | -                  | `./prompts`        | Path to prompts directory                    |
| `--provider`    | -                  | `deepseek`         | Inference provider (only `deepseek` for now) |
| `--base-url`    | -                  | (provider default) | Override API base URL                        |
| `--model`       | -                  | `deepseek-v4-pro`  | Model name                                   |
| `--api-key`     | `DEEPSEEK_API_KEY` | -                  | API key (overrides env)                      |

Example:

```bash
npx deekseek-codex --prompts-dir ./my-prompts --model deepseek-chat
```

## 🧠 REPL Commands (Built‑in)

| Command                                                      | Description                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `/help`                                                      | Show all commands                                                  |
| `/load [system-design-agent \| npm-project-creation-prompt]` | Load a prompt as system message                                    |
| `/spec`                                                      | Show current technical specification                               |
| `/chat <message>`                                            | Send a message to the AI (maintains conversation history)          |
| `/append-spec`                                               | Append the last assistant response to `technical-specification.md` |
| `/run <prompt-name>`                                         | Load prompt + spec, send to AI, print response (core workflow)     |
| `/exit`                                                      | Exit the REPL                                                      |

## 📝 Adding a New Inference Provider

1. Implement `IInferenceProvider` interface.
2. Register it inside `DeepseekCodexApp.initialize()` (see section 7 of the technical specification).

Only `DeepSeekProvider` is shipped in v1.0.

## 🤝 Contributing

- Stick strictly to the **TECHNICAL SPECIFICATION** (embedded in `.clinerules`).
- No external dependencies – use only Node.js built‑ins.
- Maintain 100% ESM (type: `module`).
- Run `npm run lint` and `npm test` before submitting changes.

## 📄 License

MIT
````
