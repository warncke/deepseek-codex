import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AppConfig } from './AppConfig.js';

const mockSetApiKey = jest.fn<() => void>();
const mockSetBaseUrl = jest.fn<() => void>();
const mockSetDefaultModel = jest.fn<() => void>();
const mockChat = jest.fn<() => Promise<string>>();
const mockStart = jest.fn<() => Promise<void>>();
const mockValidate = jest.fn<() => Promise<{ valid: boolean; missing: string[] }>>();
const mockLoadPrompt = jest.fn<() => Promise<string>>();
const mockLoadTechnicalSpec = jest.fn<() => Promise<string>>();
const mockSaveTechnicalSpec = jest.fn<() => Promise<void>>();

class MockDeepSeekProvider {
  providerName = 'DeepSeek V4';
  apiKeyEnvVar = 'DEEPSEEK_API_KEY';
  chat = mockChat;
  setApiKey = mockSetApiKey;
  setBaseUrl = mockSetBaseUrl;
  setDefaultModel = mockSetDefaultModel;
}

jest.unstable_mockModule('./DeepSeekProvider.js', () => ({
  DeepSeekProvider: MockDeepSeekProvider,
}));

jest.unstable_mockModule('./PromptLoader.js', () => ({
  PromptLoader: jest.fn().mockImplementation(() => ({
    loadPrompt: mockLoadPrompt,
    loadTechnicalSpec: mockLoadTechnicalSpec,
    saveTechnicalSpec: mockSaveTechnicalSpec,
    validate: mockValidate,
  })),
}));

jest.unstable_mockModule('./ReplSession.js', () => ({
  ReplSession: jest.fn().mockImplementation(() => ({
    provider: {},
    loader: {},
    messages: [],
    commands: new Map(),
    running: false,
    start: mockStart,
    registerCommand: jest.fn(),
    stop: jest.fn(),
  })),
}));

const { DeepseekCodexApp } = await import('./DeepseekCodexApp.js');

describe('DeepseekCodexApp', () => {
  const originalExit = process.exit;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env = originalEnv;
  });

  it('should construct with config', () => {
    const config = new AppConfig(['node', 'script.js', '--repl']);
    const app = new DeepseekCodexApp(config);
    expect(app).toBeInstanceOf(DeepseekCodexApp);
  });

  it('should initialize with valid config', async () => {
    mockValidate.mockResolvedValue({ valid: true, missing: [] });
    const config = new AppConfig(['node', 'script.js', '--repl']);
    const app = new DeepseekCodexApp(config);
    await app.initialize();
    expect(mockValidate).toHaveBeenCalled();
  });

  it('should exit on unsupported provider', async () => {
    process.exit = jest.fn<() => never>().mockImplementation(() => {
      throw new Error('process.exit');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const config = new AppConfig(['node', 'script.js', '--repl', '--provider', 'unsupported']);
    const app = new DeepseekCodexApp(config);
    await expect(app.initialize()).rejects.toThrow('process.exit');
    consoleSpy.mockRestore();
  });

  it('should exit on missing prompt files', async () => {
    process.exit = jest.fn<() => never>().mockImplementation(() => {
      throw new Error('process.exit');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockValidate.mockResolvedValue({ valid: false, missing: ['system-design-agent.md'] });
    const config = new AppConfig(['node', 'script.js', '--repl']);
    const app = new DeepseekCodexApp(config);
    await expect(app.initialize()).rejects.toThrow('process.exit');
    consoleSpy.mockRestore();
  });

  it('should set API key override', async () => {
    mockValidate.mockResolvedValue({ valid: true, missing: [] });
    const config = new AppConfig(['node', 'script.js', '--repl', '--api-key', 'override-key']);
    const app = new DeepseekCodexApp(config);
    await app.initialize();
    expect(mockSetApiKey).toHaveBeenCalledWith('override-key');
  });

  it('should set base URL override', async () => {
    mockValidate.mockResolvedValue({ valid: true, missing: [] });
    const config = new AppConfig([
      'node',
      'script.js',
      '--repl',
      '--base-url',
      'https://custom.api.com',
    ]);
    const app = new DeepseekCodexApp(config);
    await app.initialize();
    expect(mockSetBaseUrl).toHaveBeenCalledWith('https://custom.api.com');
  });

  it('should set model override', async () => {
    mockValidate.mockResolvedValue({ valid: true, missing: [] });
    const config = new AppConfig(['node', 'script.js', '--repl', '--model', 'custom-model']);
    const app = new DeepseekCodexApp(config);
    await app.initialize();
    expect(mockSetDefaultModel).toHaveBeenCalledWith('custom-model');
  });

  it('should run and print banner', async () => {
    mockValidate.mockResolvedValue({ valid: true, missing: [] });
    mockStart.mockResolvedValue(undefined);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const config = new AppConfig(['node', 'script.js', '--repl']);
    const app = new DeepseekCodexApp(config);
    await app.initialize();
    await app.run();
    expect(consoleSpy).toHaveBeenCalledWith('Deepseek Codex CLI v1.0');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DeepSeek V4'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deepseek-v4-pro'));
    expect(mockStart).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
