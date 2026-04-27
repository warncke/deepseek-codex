import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { createMockProvider, createMockLoader } from '../tests/test-helper.js';
import type { IReplCommand } from './interfaces.js';
import type { ReplSession as ReplSessionType } from './ReplSession.js';

let ReplSession: typeof ReplSessionType;

const mockCreateInterface = jest.fn<
  () => {
    prompt: () => void;
    close: () => void;
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  }
>();

beforeAll(async () => {
  jest.unstable_mockModule('node:readline', () => ({
    createInterface: mockCreateInterface,
  }));
  const mod = await import('./ReplSession.js');
  ReplSession = mod.ReplSession;
});

describe('ReplSession', () => {
  let mockProvider: ReturnType<typeof createMockProvider>;
  let mockLoader: ReturnType<typeof createMockLoader>;
  let session: ReplSessionType;
  let mockRl: {
    prompt: jest.Mock<() => void>;
    close: jest.Mock<() => void>;
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  };

  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockLoader = createMockLoader();
    mockRl = {
      prompt: jest.fn<() => void>(),
      close: jest.fn<() => void>(),
      [Symbol.asyncIterator]: () => ({
        next: jest.fn<() => Promise<IteratorResult<string>>>(),
      }),
    };
    mockCreateInterface.mockReturnValue(mockRl);
    session = new ReplSession(mockProvider, mockLoader);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('command registration', () => {
    it('should register built-in commands', () => {
      const expectedCommands = ['help', 'load', 'spec', 'chat', 'append-spec', 'run', 'exit'];
      for (const cmd of expectedCommands) {
        expect(session.commands.has(cmd)).toBe(true);
      }
    });

    it('should register custom commands', () => {
      const customCommand: IReplCommand = {
        description: 'Custom command',
        execute: jest.fn<() => Promise<void>>(),
      };

      session.registerCommand('custom', customCommand);
      expect(session.commands.has('custom')).toBe(true);
      expect(session.commands.get('custom')?.description).toBe('Custom command');
    });

    it('should have 7 built-in commands', () => {
      expect(session.commands.size).toBe(7);
    });

    it('should have help command with description', () => {
      const helpCmd = session.commands.get('help');
      expect(helpCmd).toBeDefined();
      expect(helpCmd?.description).toBeTruthy();
    });

    it('should have exit command that stops the session', async () => {
      const exitCmd = session.commands.get('exit');
      expect(exitCmd).toBeDefined();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      session.running = true;
      await exitCmd!.execute([], session);
      expect(session.running).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should have load command', () => {
      const loadCmd = session.commands.get('load');
      expect(loadCmd).toBeDefined();
      expect(loadCmd?.description).toContain('Load a prompt file');
    });

    it('should have spec command', () => {
      const specCmd = session.commands.get('spec');
      expect(specCmd).toBeDefined();
      expect(specCmd?.description).toContain('technical specification');
    });

    it('should have chat command', () => {
      const chatCmd = session.commands.get('chat');
      expect(chatCmd).toBeDefined();
      expect(chatCmd?.description).toContain('Send a message');
    });

    it('should have append-spec command', () => {
      const appendCmd = session.commands.get('append-spec');
      expect(appendCmd).toBeDefined();
      expect(appendCmd?.description).toContain('Append');
    });

    it('should have run command', () => {
      const runCmd = session.commands.get('run');
      expect(runCmd).toBeDefined();
      expect(runCmd?.description).toContain('Load a prompt');
    });

    it('should have spec command with interactive description', () => {
      const specCmd = session.commands.get('spec');
      expect(specCmd).toBeDefined();
      expect(specCmd?.description).toContain('interactive collapsible tree');
    });
  });

  describe('/help command', () => {
    it('should print all available commands', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const helpCmd = session.commands.get('help')!;
      await helpCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('/help');
      expect(output).toContain('/load');
      expect(output).toContain('/spec');
      expect(output).toContain('/chat');
      expect(output).toContain('/append-spec');
      expect(output).toContain('/run');
      expect(output).toContain('/exit');
      consoleSpy.mockRestore();
    });
  });

  describe('/load command', () => {
    it('should load a specific prompt', async () => {
      mockLoader.loadPrompt.mockResolvedValue('prompt content');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const loadCmd = session.commands.get('load')!;
      await loadCmd.execute(['system-design-agent'], session);
      expect(mockLoader.loadPrompt).toHaveBeenCalledWith('system-design-agent');
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0]).toEqual({ role: 'system', content: 'prompt content' });
      consoleSpy.mockRestore();
    });

    it('should load both prompts when no name given', async () => {
      mockLoader.loadPrompt.mockResolvedValue('content');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const loadCmd = session.commands.get('load')!;
      await loadCmd.execute([], session);
      expect(mockLoader.loadPrompt).toHaveBeenCalledTimes(2);
      expect(mockLoader.loadPrompt).toHaveBeenCalledWith('system-design-agent');
      expect(mockLoader.loadPrompt).toHaveBeenCalledWith('npm-project-creation-prompt');
      expect(session.messages).toHaveLength(2);
      consoleSpy.mockRestore();
    });

    it('should handle load failure gracefully', async () => {
      mockLoader.loadPrompt.mockRejectedValue(new Error('File not found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const loadCmd = session.commands.get('load')!;
      await loadCmd.execute(['nonexistent'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Failed to load prompt');
      consoleSpy.mockRestore();
    });

    it('should handle load failure with non-Error thrown', async () => {
      mockLoader.loadPrompt.mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const loadCmd = session.commands.get('load')!;
      await loadCmd.execute(['nonexistent'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Failed to load prompt');
      consoleSpy.mockRestore();
    });
  });

  describe('/chat command', () => {
    it('should print usage when no message provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const chatCmd = session.commands.get('chat')!;
      await chatCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalledWith('Usage: /chat <message>');
      consoleSpy.mockRestore();
    });

    it('should send message and print response', async () => {
      mockProvider.chat.mockResolvedValue('AI response');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const chatCmd = session.commands.get('chat')!;
      await chatCmd.execute(['Hello'], session);
      expect(mockProvider.chat).toHaveBeenCalled();
      expect(session.messages).toHaveLength(2);
      expect(session.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(session.messages[1]).toEqual({ role: 'assistant', content: 'AI response' });
      expect(consoleSpy.mock.calls.some((c) => c[0] === 'AI response')).toBe(true);
      consoleSpy.mockRestore();
    });

    it('should handle chat error gracefully', async () => {
      mockProvider.chat.mockRejectedValue(new Error('API error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const chatCmd = session.commands.get('chat')!;
      await chatCmd.execute(['Hello'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('API error');
      consoleSpy.mockRestore();
    });

    it('should handle chat error with non-Error thrown', async () => {
      mockProvider.chat.mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const chatCmd = session.commands.get('chat')!;
      await chatCmd.execute(['Hello'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('string error');
      consoleSpy.mockRestore();
    });
  });

  describe('/append-spec command', () => {
    it('should print message when no assistant response exists', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const appendCmd = session.commands.get('append-spec')!;
      await appendCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalledWith('No assistant response to append.');
      consoleSpy.mockRestore();
    });

    it('should append last assistant response to spec', async () => {
      session.messages.push({ role: 'assistant', content: 'New spec content' });
      mockLoader.loadTechnicalSpec.mockResolvedValue('# TECHNICAL SPECIFICATION\n\nExisting');
      mockLoader.saveTechnicalSpec.mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const appendCmd = session.commands.get('append-spec')!;
      await appendCmd.execute([], session);
      expect(mockLoader.loadTechnicalSpec).toHaveBeenCalled();
      expect(mockLoader.saveTechnicalSpec).toHaveBeenCalledWith(
        '# TECHNICAL SPECIFICATION\n\nExisting\n\nNew spec content',
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Appended last response to prompts/technical-specification.md.',
      );
      consoleSpy.mockRestore();
    });

    it('should handle append failure gracefully', async () => {
      session.messages.push({ role: 'assistant', content: 'Content' });
      mockLoader.loadTechnicalSpec.mockRejectedValue(new Error('Read error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const appendCmd = session.commands.get('append-spec')!;
      await appendCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('Read error');
      consoleSpy.mockRestore();
    });

    it('should handle append failure with non-Error thrown', async () => {
      session.messages.push({ role: 'assistant', content: 'Content' });
      mockLoader.loadTechnicalSpec.mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const appendCmd = session.commands.get('append-spec')!;
      await appendCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('string error');
      consoleSpy.mockRestore();
    });
  });

  describe('/run command', () => {
    it('should print usage when no prompt name provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const runCmd = session.commands.get('run')!;
      await runCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalledWith('Usage: /run <prompt-name>');
      consoleSpy.mockRestore();
    });

    it('should load prompt, prepend spec, and send to AI', async () => {
      mockLoader.loadPrompt.mockResolvedValue('prompt content');
      mockLoader.loadTechnicalSpec.mockResolvedValue('# TECHNICAL SPECIFICATION\n\nSpec content');
      mockProvider.chat.mockResolvedValue('AI response');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const runCmd = session.commands.get('run')!;
      await runCmd.execute(['system-design-agent'], session);
      expect(mockLoader.loadPrompt).toHaveBeenCalledWith('system-design-agent');
      expect(mockLoader.loadTechnicalSpec).toHaveBeenCalled();
      expect(mockProvider.chat).toHaveBeenCalledWith([
        {
          role: 'user',
          content:
            'prompt content\n\nTECHNICAL SPECIFICATION:\n# TECHNICAL SPECIFICATION\n\nSpec content',
        },
      ]);
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0]).toEqual({ role: 'assistant', content: 'AI response' });
      consoleSpy.mockRestore();
    });

    it('should handle run failure gracefully', async () => {
      mockLoader.loadPrompt.mockRejectedValue(new Error('Load error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const runCmd = session.commands.get('run')!;
      await runCmd.execute(['system-design-agent'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('Load error');
      consoleSpy.mockRestore();
    });

    it('should handle run failure with non-Error thrown', async () => {
      mockLoader.loadPrompt.mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const runCmd = session.commands.get('run')!;
      await runCmd.execute(['system-design-agent'], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('string error');
      consoleSpy.mockRestore();
    });
  });

  describe('/spec command', () => {
    it('should load spec and call showInteractiveSpec', async () => {
      mockLoader.loadTechnicalSpec.mockResolvedValue('# TECHNICAL SPECIFICATION\n\nContent');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const specCmd = session.commands.get('spec')!;
      await specCmd.execute([], session);
      expect(mockLoader.loadTechnicalSpec).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle spec load failure gracefully', async () => {
      mockLoader.loadTechnicalSpec.mockRejectedValue(new Error('Spec load error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const specCmd = session.commands.get('spec')!;
      await specCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('Spec load error');
      consoleSpy.mockRestore();
    });

    it('should close existing rl and create new one when spec loads successfully', async () => {
      const mockClose = jest.fn<() => void>();
      const mockPrompt = jest.fn<() => void>();
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (session as any).rl = { close: mockClose, prompt: mockPrompt };

      mockLoader.loadTechnicalSpec.mockResolvedValue('# TECHNICAL SPECIFICATION\n\nContent');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const specCmd = session.commands.get('spec')!;
      await specCmd.execute([], session);

      expect(mockClose).toHaveBeenCalled();
      expect(mockLoader.loadTechnicalSpec).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should recreate rl when spec load fails and rl was set', async () => {
      const mockClose = jest.fn<() => void>();
      const mockPrompt = jest.fn<() => void>();
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (session as any).rl = { close: mockClose, prompt: mockPrompt };

      mockLoader.loadTechnicalSpec.mockRejectedValue(new Error('Spec load error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const specCmd = session.commands.get('spec')!;
      await specCmd.execute([], session);

      expect(mockClose).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('Spec load error');
      consoleSpy.mockRestore();
    });

    it('should handle spec load failure with non-Error thrown', async () => {
      mockLoader.loadTechnicalSpec.mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const specCmd = session.commands.get('spec')!;
      await specCmd.execute([], session);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('string error');
      consoleSpy.mockRestore();
    });
  });

  describe('stop method', () => {
    it('should set running to false', () => {
      session.running = true;
      session.stop();
      expect(session.running).toBe(false);
    });

    it('should close readline interface when rl is set', () => {
      const mockClose = jest.fn<() => void>();
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (session as any).rl = { close: mockClose };
      session.running = true;
      session.stop();
      expect(session.running).toBe(false);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('start method', () => {
    let mockNext: jest.Mock<() => Promise<IteratorResult<string>>>;

    beforeEach(() => {
      mockNext = jest.fn<() => Promise<IteratorResult<string>>>();
      mockRl[Symbol.asyncIterator] = () => ({ next: mockNext });
    });

    it('should create readline interface and prompt', async () => {
      mockNext.mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const promise = session.start();

      expect(mockCreateInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: '> ',
      });
      expect(mockRl.prompt).toHaveBeenCalled();

      await promise;
    });

    it('should process /help command through the loop', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: '/help' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('/help');
      expect(output).toContain('/load');
      expect(output).toContain('/spec');
      expect(output).toContain('/chat');
      expect(output).toContain('/append-spec');
      expect(output).toContain('/run');
      expect(output).toContain('/exit');
      consoleSpy.mockRestore();
    });

    it('should handle unknown command', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: '/unknown' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown command: /unknown. Type /help for available commands.',
      );
      consoleSpy.mockRestore();
    });

    it('should handle empty line', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: '' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).not.toHaveBeenCalledWith('Type /help for available commands.');
      consoleSpy.mockRestore();
    });

    it('should handle non-command non-empty line', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: 'some random text' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).toHaveBeenCalledWith('Type /help for available commands.');
      consoleSpy.mockRestore();
    });

    it('should stop loop when running becomes false', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(session.running).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should break loop when running is false at top of iteration', async () => {
      mockNext
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: false, value: 'should not be processed' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await session.start();

      expect(session.running).toBe(false);
      expect(consoleSpy).not.toHaveBeenCalledWith('Type /help for available commands.');
      consoleSpy.mockRestore();
    });

    it('should handle command execution error gracefully', async () => {
      const errorCmd: IReplCommand = {
        description: 'Error command',
        execute: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Command failed')),
      };
      session.registerCommand('error-cmd', errorCmd);

      mockNext
        .mockResolvedValueOnce({ done: false, value: '/error-cmd' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('Command failed');
      consoleSpy.mockRestore();
    });

    it('should handle command execution error with non-Error thrown', async () => {
      const errorCmd: IReplCommand = {
        description: 'Error command',
        execute: jest.fn<() => Promise<void>>().mockRejectedValue('string error'),
      };
      session.registerCommand('error-cmd', errorCmd);

      mockNext
        .mockResolvedValueOnce({ done: false, value: '/error-cmd' })
        .mockResolvedValueOnce({ done: false, value: '/exit' })
        .mockResolvedValueOnce({ done: true, value: undefined as unknown as string });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await session.start();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toContain('string error');
      consoleSpy.mockRestore();
    });
  });
});
