import readline from 'node:readline';
import { IInferenceProvider, IReplCommand, ChatMessage } from './interfaces.js';
import { PromptLoader } from './PromptLoader.js';

export class ReplSession {
  private provider: IInferenceProvider;
  private loader: PromptLoader;
  private messages: ChatMessage[] = [];
  private running = false;
  private commands: Map<string, IReplCommand> = new Map();
  private rl?: readline.Interface;

  constructor(provider: IInferenceProvider, loader: PromptLoader) {
    this.provider = provider;
    this.loader = loader;
    this.registerBuiltinCommands();
  }

  private registerBuiltinCommands(): void {
    const add = (
      name: string,
      description: string,
      exec: (args: string[], session: ReplSession) => Promise<void>,
    ) => {
      this.commands.set(name, { description, execute: exec });
    };

    add('help', 'Show this help message', async (_, session) => {
      console.log('\nAvailable commands:');
      for (const [name, cmd] of session.commands.entries()) {
        console.log(`  /${name} - ${cmd.description}`);
      }
      console.log();
    });

    add(
      'load',
      'Load prompt file as system message: /load [name] (names: system-design-agent, npm-project-creation-prompt)',
      async (args, session) => {
        let name = args[0];
        if (!name) {
          await session.commands.get('load')!.execute(['system-design-agent'], session);
          await session.commands.get('load')!.execute(['npm-project-creation-prompt'], session);
          return;
        }
        if (!['system-design-agent', 'npm-project-creation-prompt'].includes(name)) {
          console.error(
            `Unknown prompt name: ${name}. Use system-design-agent or npm-project-creation-prompt.`,
          );
          return;
        }
        try {
          const content = await session.loader.loadPrompt(name);
          session.messages.push({ role: 'system', content });
          console.log(`Loaded prompts/${name}.md (${content.length} bytes)`);
        } catch (err) {
          console.error(`Error loading prompt: ${(err as Error).message}`);
        }
      },
    );

    add('spec', 'Print current technical specification', async (_, session) => {
      try {
        const spec = await session.loader.loadTechnicalSpec();
        console.log('\n--- TECHNICAL SPECIFICATION ---\n');
        console.log(spec);
        console.log('\n--------------------------------\n');
      } catch (err) {
        console.error(`Error reading spec: ${(err as Error).message}`);
      }
    });

    add('chat', 'Send a message to the AI: /chat <message>', async (args, session) => {
      const userMsg = args.join(' ');
      if (!userMsg) {
        console.error('Usage: /chat <message>');
        return;
      }
      session.messages.push({ role: 'user', content: userMsg });
      try {
        console.log('Sending to provider...');
        const response = await session.provider.chat(session.messages);
        session.messages.push({ role: 'assistant', content: response });
        console.log(`\n${response}\n`);
      } catch (err) {
        console.error(`Chat error: ${(err as Error).message}`);
        session.messages.pop();
      }
    });

    add(
      'append-spec',
      'Append the last assistant response to technical-specification.md',
      async (_, session) => {
        const last = session.messages
          .slice()
          .reverse()
          .find((m) => m.role === 'assistant');
        if (!last) {
          console.error('No assistant response found to append.');
          return;
        }
        try {
          const currentSpec = await session.loader.loadTechnicalSpec();
          const newSpec = currentSpec + '\n\n' + last.content;
          await session.loader.saveTechnicalSpec(newSpec);
          console.log('Appended last response to technical-specification.md');
        } catch (err) {
          console.error(`Failed to append spec: ${(err as Error).message}`);
        }
      },
    );

    add(
      'run',
      'Load prompt, append current spec, send to AI: /run <prompt-name>',
      async (args, session) => {
        const name = args[0];
        if (!name || !['system-design-agent', 'npm-project-creation-prompt'].includes(name)) {
          console.error('Usage: /run <system-design-agent|npm-project-creation-prompt>');
          return;
        }
        try {
          const promptContent = await session.loader.loadPrompt(name);
          const spec = await session.loader.loadTechnicalSpec();
          const fullPrompt = `${promptContent}\n\nTECHNICAL SPECIFICATION:\n${spec}`;
          const response = await session.provider.chat([{ role: 'user', content: fullPrompt }]);
          console.log('\n--- RESPONSE ---\n');
          console.log(response);
          console.log('\n----------------\n');
        } catch (err) {
          console.error(`Run error: ${(err as Error).message}`);
        }
      },
    );

    add('exit', 'Exit the REPL', async (_, session) => {
      session.running = false;
      if (session.rl) session.rl.close();
    });
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
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl.prompt();
        continue;
      }
      if (trimmed.startsWith('/')) {
        const parts = trimmed.slice(1).split(/\s+/);
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);
        const command = this.commands.get(cmdName);
        if (command) {
          await command.execute(args, this);
        } else {
          console.error(`Unknown command: /${cmdName}. Type /help for available commands.`);
        }
      } else {
        console.error('Commands must start with /. Type /help');
      }
      if (!this.running) break;
      this.rl.prompt();
    }

    if (this.rl) this.rl.close();
  }
}
