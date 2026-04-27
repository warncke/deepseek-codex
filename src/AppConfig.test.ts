import { describe, it, expect, jest } from '@jest/globals';
import { AppConfig } from './AppConfig.js';

describe('AppConfig', () => {
  it('should parse default values', () => {
    const config = new AppConfig(['node', 'script.js']);
    expect(config.promptsDir).toBe('./prompts');
    expect(config.provider).toBe('deepseek');
    expect(config.baseUrl).toBeUndefined();
    expect(config.model).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
    expect(config.repl).toBe(false);
    expect(config.help).toBe(false);
  });

  it('should parse --prompts-dir', () => {
    const config = new AppConfig(['node', 'script.js', '--prompts-dir', '/custom/prompts']);
    expect(config.promptsDir).toBe('/custom/prompts');
  });

  it('should fallback to default prompts-dir when flag has no value', () => {
    const config = new AppConfig(['node', 'script.js', '--prompts-dir']);
    expect(config.promptsDir).toBe('./prompts');
  });

  it('should parse --provider', () => {
    const config = new AppConfig(['node', 'script.js', '--provider', 'openai']);
    expect(config.provider).toBe('openai');
  });

  it('should fallback to default provider when flag has no value', () => {
    const config = new AppConfig(['node', 'script.js', '--provider']);
    expect(config.provider).toBe('deepseek');
  });

  it('should parse --base-url', () => {
    const config = new AppConfig(['node', 'script.js', '--base-url', 'https://custom.api.com']);
    expect(config.baseUrl).toBe('https://custom.api.com');
  });

  it('should parse --model', () => {
    const config = new AppConfig(['node', 'script.js', '--model', 'gpt-4']);
    expect(config.model).toBe('gpt-4');
  });

  it('should parse --api-key', () => {
    const config = new AppConfig(['node', 'script.js', '--api-key', 'sk-test']);
    expect(config.apiKey).toBe('sk-test');
  });

  it('should parse --repl flag', () => {
    const config = new AppConfig(['node', 'script.js', '--repl']);
    expect(config.repl).toBe(true);
  });

  it('should parse --help flag', () => {
    const config = new AppConfig(['node', 'script.js', '--help']);
    expect(config.help).toBe(true);
  });

  it('should parse --repl alongside other options', () => {
    const config = new AppConfig([
      'node',
      'script.js',
      '--repl',
      '--prompts-dir',
      '/custom',
      '--model',
      'test-model',
    ]);
    expect(config.repl).toBe(true);
    expect(config.promptsDir).toBe('/custom');
    expect(config.model).toBe('test-model');
  });

  it('should print help with all options', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    AppConfig.printHelp();
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('--repl');
    expect(output).toContain('--prompts-dir');
    expect(output).toContain('--provider');
    expect(output).toContain('--base-url');
    expect(output).toContain('--model');
    expect(output).toContain('--api-key');
    expect(output).toContain('--help');
    consoleSpy.mockRestore();
  });
});
