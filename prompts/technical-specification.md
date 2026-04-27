# TECHNICAL SPECIFICATION

## Deepseek Codex CLI — Interactive AI-Assisted System Design Agent

**Version 1.0**  
**Target platform:** Node.js (≥ 24.15.0 LTS), invoked via `npx`  
**Languages:** TypeScript (implementation), portable design for C/Rust wrappers via subprocess  
**License:** MIT

---

## 1. Overview

The Deepseek Codex CLI (`deepseek-codex`) is an interactive command‑line tool that implements the **Prompting Work Flow** for AI‑assisted system design. It provides a REPL that loads prompt templates and technical specifications from a local `prompts/` directory, communicates with an inference platform API (defaulting to DeepSeek V4), and guides the user through the iterative workflow: **revise technical paper → generate technical specification → apply → repeat**.

The tool is designed to be invoked directly via `npx deepseek-codex` with zero installation beyond Node.js. It uses an extensible provider model so that any OpenAI‑compatible API can be substituted, while shipping with a DeepSeek‑first default.

---

## 2. Key Material Abstraction

**There is no cryptographic key material in this system.** The only secret is the API key for the inference platform, which is read from the environment variable `DEEPSEEK_API_KEY` (configurable via a provider-specific environment variable name). The tool never stores, logs, or transmits the API key except in the `Authorization` header of requests to the configured base URL.

---

## 3. Module Specifications

All modules use simple classes, no inheritance. The only interfaces are `IInferenceProvider` and `IReplCommand`.

---

### 3.1 `IInferenceProvider`

```typescript
interface IInferenceProvider {
  /**
   * Send a list of messages to the inference API and return the assistant's reply.
   * @param messages  Array of role/content pairs (system, user, assistant).
   * @param options   Optional parameters (model, temperature, maxTokens, thinking, stream).
   * @returns The assistant's response text.
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;

  /** Human-readable name of this provider (e.g. "DeepSeek V4"). */
  readonly providerName: string;

  /** The environment variable used for the API key (e.g. "DEEPSEEK_API_KEY"). */
  readonly apiKeyEnvVar: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: { type: 'enabled' | 'disabled' };
  reasoningEffort?: 'high' | 'max';
  stream?: boolean;
}
```

---

### 3.2 `DeepSeekProvider`

**Purpose:** Concrete provider for the DeepSeek V4 API (OpenAI‑compatible endpoint). Uses `https://api.deepseek.com` as the base URL and reads the API key from `DEEPSEEK_API_KEY`.

**Internal state:**

| Property       | Type     | Description                                                 |
| -------------- | -------- | ----------------------------------------------------------- |
| `baseUrl`      | `string` | `https://api.deepseek.com`                                  |
| `apiKey`       | `string` | Read from `process.env[apiKeyEnvVar]` at construction time. |
| `defaultModel` | `string` | `"deepseek-v4-pro"`                                         |

**Public interface:**

```typescript
class DeepSeekProvider implements IInferenceProvider {
  readonly providerName = 'DeepSeek V4';
  readonly apiKeyEnvVar = 'DEEPSEEK_API_KEY';

  constructor();
  // Reads apiKey from process.env.DEEPSEEK_API_KEY.
  // Throws if the variable is not set.

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  // POSTs to https://api.deepseek.com/chat/completions (OpenAI format).
  // Headers: { "Content-Type": "application/json", "Authorization": "Bearer <apiKey>" }.
  // Body: { model, messages, thinking, reasoning_effort, stream: false, ... }.
  // Returns response.choices[0].message.content.
  // On HTTP error, throws with status code and response body.
}
```

**Error handling:** Maps HTTP status codes to user‑friendly messages (401 → bad API key, 429 → rate limited, 500/503 → server errors with retry advice). Implements a simple exponential‑backoff retry (up to 3 attempts) for 429 and 5xx responses.

---

### 3.3 `PromptLoader`

**Purpose:** Reads prompt template files and the technical specification from the `prompts/` subdirectory of the current working directory.

**Internal state:** None — stateless utility.

**Public interface:**

```typescript
class PromptLoader {
  /**
   * @param promptsDir  Path to the prompts directory. Defaults to `./prompts`.
   */
  constructor(promptsDir?: string);

  /**
   * Load a prompt file by name (without extension).
   * @param name  "npm-project-creation-prompt" or "system-design-agent"
   * @returns The file contents as a string.
   * @throws If the file does not exist or cannot be read.
   */
  loadPrompt(name: string): string;

  /**
   * Load the current technical specification.
   * @returns The contents of `technical-specification.md`.
   * @throws If the file does not exist.
   */
  loadTechnicalSpec(): string;

  /**
   * Save a new technical specification (overwrites).
   * @param content  The new file contents.
   */
  saveTechnicalSpec(content: string): void;

  /** Check whether prompts/ directory and required files exist. */
  validate(): { valid: boolean; missing: string[] };
}
```

**File layout:**

```
./
└── prompts/
    ├── system-design-agent.md
    ├── npm-project-creation-prompt.md
    └── technical-specification.md
```

---

### 3.4 `ReplSession`

**Purpose:** Manages the interactive REPL loop that implements the Prompting Work Flow. Holds the conversation context, dispatches commands, and coordinates between the `PromptLoader` and the `IInferenceProvider`.

**Internal state:**

| Property   | Type                        | Description                               |
| ---------- | --------------------------- | ----------------------------------------- |
| `provider` | `IInferenceProvider`        | The active inference backend.             |
| `loader`   | `PromptLoader`              | Reads prompts and spec.                   |
| `messages` | `ChatMessage[]`             | The conversation history sent to the API. |
| `running`  | `boolean`                   | Whether the REPL is active.               |
| `commands` | `Map<string, IReplCommand>` | Registered REPL commands.                 |

**Public interface:**

```typescript
class ReplSession {
  /**
   * @param provider  Inference backend.
   * @param loader    Prompt file loader.
   */
  constructor(provider: IInferenceProvider, loader: PromptLoader);

  /**
   * Start the interactive REPL. Reads stdin line-by-line.
   * The REPL continues until the user types `/exit` or sends SIGINT.
   */
  async start(): Promise<void>;

  /**
   * Register a custom REPL command.
   * @param name     Command name (without leading /).
   * @param command  Handler.
   */
  registerCommand(name: string, command: IReplCommand): void;
}
```

---

### 3.5 `IReplCommand`

```typescript
interface IReplCommand {
  /** One-line help description. */
  readonly description: string;

  /**
   * Execute the command.
   * @param args  Arguments after the command name.
   * @param session  The active REPL session (for context access).
   */
  execute(args: string[], session: ReplSession): Promise<void>;
}
```

---

### 3.6 Built‑in Commands

The following commands are registered by default:

#### `/help`

Displays all registered commands and their descriptions.

#### `/load [name]`

Loads a prompt file and appends it to the conversation as a system message. Valid names: `system-design-agent`, `npm-project-creation-prompt`. If no name is given, loads both.

#### `/spec`

Prints the current technical specification (loaded from `prompts/technical-specification.md`) to the console.

#### `/chat <message>`

Sends `<message>` plus the full conversation history to the inference provider and prints the response. The response is added to conversation history.

#### `/append-spec`

Takes the last assistant response and appends it to `technical-specification.md`.

#### `/run <prompt-name>`

Loads the named prompt, appends `TECHNICAL SPECIFICATION: ${current-spec}` to it, sends the whole thing to the API, and prints the response. This is the core workflow command.

#### `/exit`

Exits the REPL.

---

### 3.7 `AppConfig`

**Purpose:** Parses command‑line arguments and environment variables into a typed configuration object.

**Public interface:**

```typescript
class AppConfig {
  /** Path to the prompts directory. Default: "./prompts". */
  readonly promptsDir: string;

  /** Provider to use. Default: "deepseek". */
  readonly provider: string;

  /** Custom base URL (overrides provider default). */
  readonly baseUrl?: string;

  /** Model name (overrides provider default). */
  readonly model?: string;

  /** API key (overrides environment variable). */
  readonly apiKey?: string;

  constructor(argv: string[]);
  // Parses process.argv:
  //   --prompts-dir <path>
  //   --provider <name>
  //   --base-url <url>
  //   --model <name>
  //   --api-key <key>
}
```

---

## 4. `DeepseekCodexApp` — Orchestrator

```typescript
class DeepseekCodexApp {
  private config: AppConfig;
  private provider: IInferenceProvider;
  private loader: PromptLoader;
  private session: ReplSession;

  constructor(config: AppConfig);

  /**
   * Initialises the provider, loader, and REPL session.
   * Validates that the prompts directory exists and contains required files.
   * Prints a welcome banner.
   */
  async initialize(): Promise<void>;

  /**
   * Starts the REPL. Returns when the user exits.
   */
  async run(): Promise<void>;
}
```

**Startup sequence:**

1. Parse CLI arguments via `AppConfig`.
2. Instantiate the provider:
   - If `--provider deepseek` (default): `new DeepSeekProvider()`.
   - Future: `--provider openai` → `new OpenAIProvider()`, etc.
3. If `--api-key` is given, set it on the provider (override).
4. If `--base-url` is given, override the provider’s default.
5. Instantiate `PromptLoader` with `--prompts-dir`.
6. Run `loader.validate()`. If files are missing, print a helpful error and exit.
7. Load the current `technical-specification.md` into memory (for `/spec` and `/run`).
8. Print banner:

```
Deepseek Codex CLI v1.0
Provider:  DeepSeek V4
Model:     deepseek-v4-pro
Prompts:   ./prompts/
Spec:      ./prompts/technical-specification.md

Type /help for commands.
>
```

9. Start the REPL.

---

## 5. Data Layout and Normalisation

- All prompt files are UTF‑8 text.
- `technical-specification.md` must start with `# TECHNICAL SPECIFICATION` (validated on load).
- The `TECHNICAL SPECIFICATION:` tag appended during `/run` uses the literal string `TECHNICAL SPECIFICATION:` followed by a newline and the full file contents.

---

## 6. Implementation Guidance

### 6.1 TypeScript / Node.js

- Use `node:readline` for the REPL.
- Use `node:fs/promises` for file I/O.
- Use `fetch` (globally available, stable since Node 18) for HTTP requests.
- Package entry point: `bin/deepseek-codex.mjs` (ESM), with `#!/usr/bin/env node` shebang.
- `package.json`:
  ```json
  {
    "name": "deepseek-codex",
    "version": "1.0.0",
    "type": "module",
    "bin": {
      "deepseek-codex": "./bin/deepseek-codex.mjs"
    },
    "files": ["bin/", "lib/"],
    "engines": {
      "node": ">=24.15.0"
    }
  }
  ```

### 6.2 Rust Wrapper (Future)

A Rust binary can shell out to `deepseek-codex` via `std::process::Command`, passing `--prompts-dir` and `--api-key`. The REPL runs in the terminal; the Rust wrapper simply manages environment setup and argument forwarding.

### 6.3 C Wrapper (Future)

Identical approach: `popen()` or `system()` to invoke the Node.js binary. The C wrapper is a thin launcher.

---

## 7. Provider Extension

To add a new provider (e.g., OpenAI, Anthropic, local Ollama):

1. Implement `IInferenceProvider`.
2. Register the provider in a registry map inside `DeepseekCodexApp.initialize()`:

```typescript
const providers: Record<string, () => IInferenceProvider> = {
  deepseek: () => new DeepSeekProvider(),
  openai: () => new OpenAIProvider(),
  custom: () => new CustomProvider(config.baseUrl!, config.apiKey!),
};
```

The `DeepSeekProvider` is the reference implementation and the only one shipped in v1.0.

---

## 8. Error Handling

- **Missing API key**: Print `Error: DEEPSEEK_API_KEY environment variable is not set.` and exit with code 1.
- **Unsupported Node version**: If `process.version` is older than v24.15.0 LTS, print a warning: `Warning: Node.js ≥ 24.15.0 LTS is recommended (current: v…)` and continue (do not exit). The tool may function but is untested on older releases.
- **Missing prompts directory**: Print a list of missing files and exit with code 1.
- **API errors**: Print the status code, error message, and any retry advice. Exit the REPL command, but do not exit the REPL.
- **Invalid `TECHNICAL SPECIFICATION:` format**: Print a warning but proceed; the `/run` command will still append whatever is in the file.

---

## 9. Example Session

```
$ npx deepseek-codex

Deepseek Codex CLI v1.0
Provider:  DeepSeek V4
Model:     deepseek-v4-pro
Prompts:   ./prompts/
Spec:      ./prompts/technical-specification.md

Type /help for commands.

> /load system-design-agent
Loaded prompts/system-design-agent.md (4.2 kB)

> /run system-design-agent
Sending to DeepSeek V4 (deepseek-v4-pro)...

--- RESPONSE ---
## Analysis
... (AI response) ...
------------------

> /append-spec
Appended last response to prompts/technical-specification.md.

> /exit
Goodbye.
```
