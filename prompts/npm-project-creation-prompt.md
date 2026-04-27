You are a TypeScript developer implementing the Deepseek Codex (deepseek-codex) CLI application as specified below.
Your task is to produce the complete npm package code, adhering strictly to the given specification, with no deviations.
Output every file needed for the package, each in a separate code block with a heading indicating its relative file path (e.g., `src/index.ts`). Follow these instructions precisely:

- Use TypeScript with ESM output. `tsconfig.json` must set `"module": "ES2022"`, `"target": "ES2022"`, `"outDir": "lib"`, `"rootDir": "src"`, and `"strict": true`.
- Target Node.js ≥ 18. Use only Node.js built-in modules (`node:readline`, `node:fs/promises`, `fetch`) — no external dependencies.
- Package name: `deekseek-codex`. `package.json` must have `"type": "module"` and a `bin` entry: `"bin": { "deekseek-codex": "./bin/deekseek-codex.mjs" }`.
- The `bin/deekseek-codex.mjs` entry point must start with `#!/usr/bin/env node` and import from `../lib/index.js` (the compiled TypeScript).
- Define an ESLint config using `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`, with `eslint:recommended` and the TypeScript recommended rules. Use `.eslintrc.cjs` format. The environment should include `node: true` and `es2022: true`.
- Prettier config with `semi: true`, `singleQuote: true`, `trailingComma: "all"`.
- Testing with Jest (via `ts-jest` with ESM support). The test file is `tests/deekseek-codex.test.ts`. It must include:
  - Unit tests for `PromptLoader` (using `jest.mock` for `fs/promises`).
  - Unit tests for `AppConfig` (parsing various CLI arguments).
  - Unit tests for `DeepSeekProvider` (mocking the global `fetch` to test success, 401, 429, retry logic).
  - A test that the built-in REPL commands (`/help`, `/load`, `/spec`, `/chat`, `/append-spec`, `/run`, `/exit`) are registered and parse correctly (instantiate `ReplSession` with mocked I/O, call the command handlers).
  - No integration tests that require a live API key.

- Implementation specifics:
  - Interfaces:
    - `IInferenceProvider` with `chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>`, `providerName: string`, and `apiKeyEnvVar: string`.
    - `IReplCommand` with `description: string` and `execute(args: string[], session: ReplSession): Promise<void>`.
    - `ChatMessage` type: `role: "system" | "user" | "assistant"`, `content: string`.
    - `ChatOptions` type: optional `model`, `temperature`, `maxTokens`, `thinking` (object with `type` "enabled"|"disabled"), `reasoningEffort` ("high"|"max"), `stream` (boolean).
  - Classes:
    - `DeepSeekProvider`:
      - Constructor reads `DEEPSEEK_API_KEY` from `process.env`. Throws if not set.
      - `chat()` sends a POST to `https://api.deepseek.com/chat/completions` with JSON body `{ model: defaultModel, messages, ...options }` and headers `Authorization: Bearer <key>`. Returns `response.choices[0].message.content`.
      - On HTTP errors (401, 429, 5xx): retry up to 3 times with exponential backoff (delay = 2^attempt \* 100 ms). Map errors to user-friendly messages.
    - `PromptLoader`:
      - Constructor takes optional `promptsDir` (default `"./prompts"`).
      - `loadPrompt(name: string): string` reads `promptsDir/name.md`.
      - `loadTechnicalSpec(): string` reads `promptsDir/technical-specification.md`.
      - `saveTechnicalSpec(content: string): void` overwrites that file.
      - `validate()` returns `{ valid: boolean; missing: string[] }` (checks all required files exist).
      - Throws if the file does not start with `# TECHNICAL SPECIFICATION` (for the spec) or if any file is missing.
    - `ReplSession`:
      - Constructor takes `IInferenceProvider` and `PromptLoader`. Holds a conversation `ChatMessage[]`.
      - Built-in commands registered in constructor: `/help`, `/load [name]`, `/spec`, `/chat <message>`, `/append-spec`, `/run <prompt-name>`, `/exit`.
      - `/load`: appends the prompt file content as a system message.
      - `/spec`: prints the current technical spec content.
      - `/chat`: sends messages to the provider and appends the response.
      - `/append-spec`: appends the last assistant message to the spec file.
      - `/run <prompt-name>`: loads the prompt, appends `TECHNICAL SPECIFICATION:\n<spec contents>`, sends to provider, prints response.
      - `start()`: interactive loop using `node:readline`; displays prompt `> `.
      - `registerCommand(name, IReplCommand)`: adds custom commands.
    - `AppConfig`:
      - Parses `process.argv` for `--prompts-dir`, `--provider`, `--base-url`, `--model`, `--api-key`. Stores them as readonly properties. Defaults: promptsDir `"./prompts"`, provider `"deepseek"`.
    - `PromptWorkflowApp`:
      - Constructor takes `AppConfig`.
      - `initialize()`: creates the provider (only "deepseek" for now) and loader. Validates files. Prints a welcome banner showing provider, model, prompts dir, spec path. Returns `Promise<void>`.
      - `run()`: creates `ReplSession` and starts it.
  - All command implementations must match the specification exactly; no extra features.

- Config files:
  - `package.json` must include exact devDependencies (latest versions for `@types/node`, `@types/jest`, `eslint`, `prettier`, `typescript`, `jest`, `ts-jest`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` as of March 2025). Scripts: `build` (tsc), `test` (jest), `lint`, `format`, `prepare` (npm run build). Also add `"jest": { "preset": "ts-jest", "testEnvironment": "node", "transform": { "^.+\\.ts$": ["ts-jest", { "useESM": true }] }, "extensionsToTreatAsEsm": [".ts"], "moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" } }`.
  - Ensure `.gitignore`, `.prettierignore`, `.prettierrc`, `.eslintrc.cjs` are included.

- The spec is complete; do not add features beyond it. The output must be solely the code, no explanatory text outside the file code blocks.

Attached is the full technical specification.
