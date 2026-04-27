import { jest } from '@jest/globals';
import type { IInferenceProvider } from '../src/interfaces.js';
import type { PromptLoader } from '../src/PromptLoader.js';

export const mockReadFile = jest.fn<() => Promise<string>>();
export const mockWriteFile = jest.fn<() => Promise<void>>();
export const mockAccess = jest.fn<() => Promise<void>>();

export function setupFsMocks(): void {
  jest.unstable_mockModule('node:fs/promises', () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    access: mockAccess,
  }));
}

export function createMockProvider(): jest.Mocked<IInferenceProvider> {
  return {
    providerName: 'MockProvider',
    apiKeyEnvVar: 'MOCK_KEY',
    chat: jest.fn<() => Promise<string>>(),
  } as unknown as jest.Mocked<IInferenceProvider>;
}

export function createMockLoader(): jest.Mocked<PromptLoader> {
  return {
    loadPrompt: jest.fn<() => Promise<string>>(),
    loadTechnicalSpec: jest.fn<() => Promise<string>>(),
    saveTechnicalSpec: jest.fn<() => Promise<void>>(),
    validate: jest.fn<() => Promise<{ valid: boolean; missing: string[] }>>(),
  } as unknown as jest.Mocked<PromptLoader>;
}

export function withEnvVar(name: string, value: string, fn: () => void): void {
  const original = process.env[name];
  process.env[name] = value;
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
}
