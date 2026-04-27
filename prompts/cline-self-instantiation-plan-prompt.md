You are the **ACTION** agent for the Deepseek Codex CLI project. Execute the following plan immediately, without asking for confirmation.

Goal: In the current directory (which already contains `.clinerules` and a `prompts/` directory – the latter may be empty or contain placeholder files), you must generate all the source files, configuration files, tests, entry point, and **README.md** for the `deepseek-coder` npm package, exactly as specified in the technical specification (which is embedded in `.clinerules`). Do not copy a hard‑coded README; instead, **derive the README content from the information in `.clinerules`** following the outline below.

**Strict rules for README.md generation:**

- You MUST produce a `README.md` file that is **developer‑focused**, not just a user manual.
- Use the following **required sections** in this order:
  1. **Title & one‑line description** (from the spec Overview).
  2. **Quick Start** – clone, install, build, set API key, run.
  3. **Prerequisites** – Node.js version, npm, DeepSeek API key.
  4. **Development Workflow** – commands: `npm install`, `npm run build`, `npm test`, `npm run lint`, `npm run format`, `npm run prepare`.
  5. **Project Structure** – a tree diagram showing `bin/`, `src/`, `tests/`, `prompts/`, `lib/`, config files.
  6. **Testing Guidelines** – derived from the spec’s testing requirements (mocking, no live API, etc.).
  7. **Configuration** – table of CLI arguments and environment variables (from AppConfig and spec).
  8. **REPL Commands** – table of built‑in commands with descriptions (from spec section 3.6).
  9. **Adding a New Inference Provider** – brief steps referencing spec section 7.
  10. **Contributing** – rules: stick to spec, zero external deps, ESM, lint/test before commit.
  11. **License** – MIT.

- You MUST **not** copy any hard‑coded README text from this prompt. Instead, extract the actual values (e.g., default model name, provider name, commands, options) from the technical specification inside `.clinerules`.
- The README must be valid Markdown, with code blocks where appropriate.
- Do not include any placeholder text like `[TODO]` – fill everything from the spec.

**Other strict rules for all files:**

1. **DO NOT create, modify, or delete any files inside the `prompts/` directory.** If it doesn't exist, create it empty.
2. **DO NOT read or write `technical-specification.md` or any prompt files during bootstrap.** The tests use mocks.
3. **DO NOT modify `.clinerules`** – it stays as is.
4. Create **exactly** the following files using the exact content from the previous session (except README.md, which you will generate):
   - `package.json`
   - `tsconfig.json`
   - `.eslintrc.cjs`
   - `.prettierrc`
   - `.gitignore`
   - `.prettierignore`
   - `src/interfaces.ts`
   - `src/DeepSeekProvider.ts`
   - `src/PromptLoader.ts`
   - `src/AppConfig.ts`
   - `src/ReplSession.ts`
   - `src/DeepseekCodexApp.ts`
   - `src/index.ts`
   - `bin/deepseek-coder.mjs` (make executable)
   - `tests/deepseek-coder.test.ts`

5. After writing all files, run:
   ```bash
   npm install
   npm run build
   npm test
   ```
