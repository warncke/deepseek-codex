import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import { PromptLoader } from '../src/PromptLoader.js';
import { AppConfig } from '../src/AppConfig.js';
import { DeepSeekProvider } from '../src/DeepSeekProvider.js';
import { ReplSession } from '../src/ReplSession.js';
import { IInferenceProvider, ChatMessage } from '../src/interfaces.js';

jest.mock('node:fs/promises');
const mockedFs = jest.mocked(fs);

describe('PromptLoader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('loadPrompt reads file correctly', async () => {
    mockedFs.readFile.mockResolvedValueOnce('prompt content' as any);
    const loader = new PromptLoader('/fake');
    const content = await loader.loadPrompt('test');
    expect(content).toBe('prompt content');
    expect(mockedFs.readFile).toHaveBeenCalledWith('/fake/test.md', 'utf-8');
  });

  test('loadTechnicalSpec validates header', async () => {
    mockedFs.readFile.mockResolvedValueOnce('# TECHNICAL SPECIFICATION\ncontent' as any);
    const loader = new PromptLoader('/fake');
    const spec = await loader.loadTechnicalSpec();
    expect(spec).toContain('# TECHNICAL SPECIFICATION');
  });

  test('loadTechnicalSpec throws if header missing', async () => {
    mockedFs.readFile.mockResolvedValueOnce('wrong header' as any);
    const loader = new PromptLoader('/fake');
    await expect(loader.loadTechnicalSpec()).rejects.toThrow('must start with');
  });

  test('validate returns missing files', async () => {
    mockedFs.access.mockImplementation(async () => {
      throw new Error('not found');
    });
    const loader = new PromptLoader('/fake');
    const result = await loader.validate();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('system-design-agent.md');
  });

  test('saveTechnicalSpec writes file', async () => {
    mockedFs.writeFile.mockResolvedValueOnce(undefined);
    const loader = new PromptLoader('/fake');
    await loader.saveTechnicalSpec('new content');
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      '/fake/technical-specification.md',
      'new content',
      'utf-8',
    );
  });
});

describe('AppConfig', () => {
  test('parses defaults', () => {
    const config = new AppConfig(['node', 'script']);
    expect(config.promptsDir).toBe('./prompts');
    expect(config.provider).toBe('deepseek');
    expect(config.baseUrl).toBeUndefined();
  });

  test('parses custom arguments', () => {
    const argv = [
      'node',
      'script',
      '--prompts-dir',
      './my-prompts',
      '--provider',
      'custom',
      '--base-url',
      'http://localhost',
      '--model',
      'test-model',
      '--api-key',
      'abc123',
    ];
    const config = new AppConfig(argv);
    expect(config.promptsDir).toBe('./my-prompts');
    expect(config.provider).toBe('custom');
    expect(config.baseUrl).toBe('http://localhost');
    expect(config.model).toBe('test-model');
    expect(config.apiKey).toBe('abc123');
  });
});

describe('DeepSeekProvider', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: 'test-key' };
    jest.resetAllMocks();
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  test('constructor throws if API key missing', () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => new DeepSeekProvider()).toThrow('DEEPSEEK_API_KEY');
  });

  test('chat sends correct request and returns content', async () => {
    const mockResponse = { choices: [{ message: { content: 'Hello world' } }] };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new DeepSeekProvider();
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    const reply = await provider.chat(messages, { temperature: 0.7 });
    expect(reply).toBe('Hello world');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
        body: expect.stringContaining('"model":"deepseek-v4-pro"'),
      }),
    );
  });

  test('handles 401 error without retry', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);
    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'HTTP 401: Unauthorized',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('retries on 429 with exponential backoff', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, text: async () => 'Rate limited' } as Response;
      } else {
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'retry success' } }] }),
        } as Response;
      }
    });
    jest.useFakeTimers();
    const provider = new DeepSeekProvider();
    const promise = provider.chat([{ role: 'user', content: 'test' }]);
    await jest.runAllTimersAsync();
    const reply = await promise;
    expect(reply).toBe('retry success');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe('ReplSession commands', () => {
  let mockProvider: jest.Mocked<IInferenceProvider>;
  let mockLoader: jest.Mocked<PromptLoader>;
  let session: ReplSession;

  beforeEach(() => {
    mockProvider = {
      chat: jest.fn(),
      providerName: 'Mock',
      apiKeyEnvVar: 'MOCK_KEY',
    };
    mockLoader = {
      loadPrompt: jest.fn(),
      loadTechnicalSpec: jest.fn(),
      saveTechnicalSpec: jest.fn(),
      validate: jest.fn(),
    } as any;
    session = new ReplSession(mockProvider, mockLoader);
  });

  test('commands are registered', () => {
    const commands = ['help', 'load', 'spec', 'chat', 'append-spec', 'run', 'exit'];
    for (const cmd of commands) {
      expect((session as any).commands.has(cmd)).toBe(true);
    }
  });

  test('/help prints help text', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const helpCmd = (session as any).commands.get('help');
    await helpCmd.execute([], session);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Available commands:'));
    spy.mockRestore();
  });

  test('/load loads prompt and adds system message', async () => {
    mockLoader.loadPrompt.mockResolvedValueOnce('system content');
    const loadCmd = (session as any).commands.get('load');
    await loadCmd.execute(['system-design-agent'], session);
    expect(mockLoader.loadPrompt).toHaveBeenCalledWith('system-design-agent');
    expect((session as any).messages).toContainEqual({ role: 'system', content: 'system content' });
  });

  test('/spec prints spec', async () => {
    mockLoader.loadTechnicalSpec.mockResolvedValueOnce('# TECHNICAL SPECIFICATION\ntest spec');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const specCmd = (session as any).commands.get('spec');
    await specCmd.execute([], session);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('test spec'));
    spy.mockRestore();
  });

  test('/chat sends message and appends response', async () => {
    mockProvider.chat.mockResolvedValueOnce('assistant reply');
    const chatCmd = (session as any).commands.get('chat');
    await chatCmd.execute(['hello', 'world'], session);
    expect((session as any).messages).toHaveLength(2);
    expect((session as any).messages[0]).toEqual({ role: 'user', content: 'hello world' });
    expect((session as any).messages[1]).toEqual({ role: 'assistant', content: 'assistant reply' });
  });

  test('/append-spec writes last assistant message to spec', async () => {
    mockLoader.loadTechnicalSpec.mockResolvedValueOnce('old spec');
    mockLoader.saveTechnicalSpec.mockResolvedValueOnce();
    (session as any).messages.push({ role: 'assistant', content: 'new content' });
    const appendCmd = (session as any).commands.get('append-spec');
    await appendCmd.execute([], session);
    expect(mockLoader.saveTechnicalSpec).toHaveBeenCalledWith(
      expect.stringContaining('new content'),
    );
  });

  test('/run loads prompt + spec and prints response', async () => {
    mockLoader.loadPrompt.mockResolvedValueOnce('prompt text');
    mockLoader.loadTechnicalSpec.mockResolvedValueOnce('spec text');
    mockProvider.chat.mockResolvedValueOnce('AI output');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const runCmd = (session as any).commands.get('run');
    await runCmd.execute(['system-design-agent'], session);
    expect(mockProvider.chat).toHaveBeenCalledWith([
      { role: 'user', content: 'prompt text\n\nTECHNICAL SPECIFICATION:\nspec text' },
    ]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('AI output'));
    spy.mockRestore();
  });

  test('/exit stops running', async () => {
    const exitCmd = (session as any).commands.get('exit');
    (session as any).running = true;
    await exitCmd.execute([], session);
    expect((session as any).running).toBe(false);
  });
});
