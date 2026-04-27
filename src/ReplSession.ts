import * as readline from 'node:readline';
import type { ChatMessage, IInferenceProvider, IReplCommand } from './interfaces.js';
import type { PromptLoader } from './PromptLoader.js';
import { showInteractiveSpec } from './SpecTreeView.js';

export class ReplSession {
  readonly provider: IInferenceProvider;
  readonly loader: PromptLoader;
  readonly messages: ChatMessage[] = [];
  readonly commands: Map<string, IReplCommand> = new Map();
  running = false;

  private rl: readline.Interface | null = null;

  constructor(provider: IInferenceProvider, loader: PromptLoader) {
    this.provider = provider;
    this.loader = loader;
    this.registerBuiltinCommands();
  }

  registerCommand(name: string, command: IReplCommand): void {
    this.commands.set(name, command);
  }

  async start(): Promise<void> {
    this.running = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    this.rl.prompt();

    for await (const line of this.rl) {
      if (!this.running) break;

      const trimmed = line.trim();

      if (trimmed.startsWith('/')) {
        const parts = trimmed.split(/\s+/);
        const cmdName = parts[0].slice(1);
        const args = parts.slice(1);

        const command = this.commands.get(cmdName);
        if (command) {
          try {
            await command.execute(args, this);
          } catch (err) {
            console.error(
              `Error executing /${cmdName}:`,
              err instanceof Error ? err.message : String(err),
            );
          }
        } else {
          console.log(`Unknown command: /${cmdName}. Type /help for available commands.`);
        }
      } else if (trimmed.length > 0) {
        console.log('Type /help for available commands.');
      }

      if (this.running) {
        this.rl.prompt();
      }
    }
  }

  stop(): void {
    this.running = false;
    if (this.rl) {
      this.rl.close();
    }
  }

  private registerBuiltinCommands(): void {
    this.registerCommand('help', {
      description: 'Display all available commands',
      execute: async () => {
        console.log('\nAvailable commands:');
        for (const [name, cmd] of this.commands) {
          console.log(`  /${name}  ${cmd.description}`);
        }
        console.log();
      },
    });

    this.registerCommand('load', {
      description:
        '[name] Load a prompt file (system-design-agent, npm-project-creation-prompt). If no name, loads both.',
      execute: async (args, session) => {
        const names =
          args.length > 0 ? args : ['system-design-agent', 'npm-project-creation-prompt'];

        for (const name of names) {
          try {
            const content = await session.loader.loadPrompt(name);
            session.messages.push({ role: 'system', content });
            console.log(`Loaded prompts/${name}.md (${content.length} B)`);
          } catch (err) {
            console.error(
              `Failed to load prompt '${name}':`,
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      },
    });

    this.registerCommand('spec', {
      description: 'Display the technical specification as an interactive collapsible tree',
      execute: async (_args, session) => {
        try {
          const spec = await session.loader.loadTechnicalSpec();
          if (this.rl) {
            this.rl.close();
            this.rl = null;
          }
          await showInteractiveSpec(spec);
          this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> ',
          });
          this.rl.prompt();
        } catch (err) {
          console.error(
            'Failed to load technical specification:',
            err instanceof Error ? err.message : String(err),
          );
          if (!this.rl) {
            this.rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
              prompt: '> ',
            });
          }
          this.rl.prompt();
        }
      },
    });

    this.registerCommand('chat', {
      description: '<message> Send a message to the AI and get a response',
      execute: async (args, session) => {
        if (args.length === 0) {
          console.log('Usage: /chat <message>');
          return;
        }

        const message = args.join(' ');
        session.messages.push({ role: 'user', content: message });

        try {
          const response = await session.provider.chat(session.messages);
          console.log('\n--- RESPONSE ---');
          console.log(response);
          console.log('------------------\n');
          session.messages.push({ role: 'assistant', content: response });
        } catch (err) {
          console.error('Chat error:', err instanceof Error ? err.message : String(err));
        }
      },
    });

    this.registerCommand('append-spec', {
      description: 'Append the last assistant response to the technical specification',
      execute: async (_args, session) => {
        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') {
          console.log('No assistant response to append.');
          return;
        }

        try {
          const currentSpec = await session.loader.loadTechnicalSpec();
          const newSpec = currentSpec + '\n\n' + lastMessage.content;
          await session.loader.saveTechnicalSpec(newSpec);
          console.log('Appended last response to prompts/technical-specification.md.');
        } catch (err) {
          console.error('Failed to append spec:', err instanceof Error ? err.message : String(err));
        }
      },
    });

    this.registerCommand('run', {
      description: '<prompt-name> Load a prompt, prepend the technical spec, and send to AI',
      execute: async (args, session) => {
        if (args.length === 0) {
          console.log('Usage: /run <prompt-name>');
          return;
        }

        const promptName = args[0];

        try {
          const prompt = await session.loader.loadPrompt(promptName);
          const spec = await session.loader.loadTechnicalSpec();

          const combined = `${prompt}\n\nTECHNICAL SPECIFICATION:\n${spec}`;

          console.log(`Sending to ${session.provider.providerName}...\n`);

          const response = await session.provider.chat([{ role: 'user', content: combined }]);

          console.log('--- RESPONSE ---');
          console.log(response);
          console.log('------------------\n');

          session.messages.push({ role: 'assistant', content: response });
        } catch (err) {
          console.error('Run error:', err instanceof Error ? err.message : String(err));
        }
      },
    });

    this.registerCommand('exit', {
      description: 'Exit the REPL',
      execute: async () => {
        console.log('Goodbye.');
        this.stop();
      },
    });
  }
}
