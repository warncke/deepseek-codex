# Deepseek Codex CLI

An interactive command-line tool for AI-assisted system design. It provides a REPL that loads prompt templates and technical specifications from a local `prompts/` directory, communicates with an inference platform API (defaulting to DeepSeek V4), and guides the user through the iterative workflow.

## Installation

```bash
npx @opensassi/deepseek-codex
```

Requires Node.js ≥ 24.15.0 LTS.

## Usage

Set your DeepSeek API key:

```bash
export DEEPSEEK_API_KEY=your-api-key-here
```

Run the CLI:

```bash
npx @opensassi/deepseek-codex
```

### REPL Commands

| Command              | Description                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `/help`              | Display all available commands                                                                 |
| `/load [name]`       | Load a prompt file (system-design-agent, npm-project-creation-prompt). If no name, loads both. |
| `/spec`              | Print the current technical specification                                                      |
| `/chat <message>`    | Send a message to the AI and get a response                                                    |
| `/append-spec`       | Append the last assistant response to the technical specification                              |
| `/run <prompt-name>` | Load a prompt, prepend the technical spec, and send to AI                                      |
| `/exit`              | Exit the REPL                                                                                  |

### Command-Line Options

| Option                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `--prompts-dir <path>` | Path to prompts directory (default: `./prompts`) |
| `--provider <name>`    | Provider to use (default: `deepseek`)            |
| `--base-url <url>`     | Custom base URL for the API                      |
| `--model <name>`       | Model name to use                                |
| `--api-key <key>`      | API key (overrides environment variable)         |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT
