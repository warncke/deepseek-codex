import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockReadFile, mockWriteFile, mockAccess, setupFsMocks } from '../tests/test-helper.js';

setupFsMocks();

const { PromptLoader } = await import('./PromptLoader.js');

describe('PromptLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load a prompt file', async () => {
    mockReadFile.mockResolvedValue('prompt content');

    const loader = new PromptLoader('./prompts');
    const result = await loader.loadPrompt('system-design-agent');

    expect(result).toBe('prompt content');
    expect(mockReadFile).toHaveBeenCalledWith('prompts/system-design-agent.md', 'utf-8');
  });

  it('should load technical spec and validate header', async () => {
    mockReadFile.mockResolvedValue('# TECHNICAL SPECIFICATION\n\nSome content');

    const loader = new PromptLoader('./prompts');
    const result = await loader.loadTechnicalSpec();

    expect(result).toBe('# TECHNICAL SPECIFICATION\n\nSome content');
  });

  it('should throw if technical spec has invalid header', async () => {
    mockReadFile.mockResolvedValue('Invalid content');

    const loader = new PromptLoader('./prompts');
    await expect(loader.loadTechnicalSpec()).rejects.toThrow('Invalid technical specification');
  });

  it('should save technical spec', async () => {
    mockWriteFile.mockResolvedValue(undefined);

    const loader = new PromptLoader('./prompts');
    await loader.saveTechnicalSpec('new content');

    expect(mockWriteFile).toHaveBeenCalledWith(
      'prompts/technical-specification.md',
      'new content',
      'utf-8',
    );
  });

  it('should validate prompts directory', async () => {
    mockAccess.mockResolvedValue(undefined);

    const loader = new PromptLoader('./prompts');
    const result = await loader.validate();

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should report missing files', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const loader = new PromptLoader('./prompts');
    const result = await loader.validate();

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(3);
    expect(result.missing).toContain('system-design-agent.md');
    expect(result.missing).toContain('npm-project-creation-prompt.md');
    expect(result.missing).toContain('technical-specification.md');
  });

  it('should use default prompts directory', async () => {
    mockReadFile.mockResolvedValue('default content');

    const loader = new PromptLoader();
    const result = await loader.loadPrompt('test-prompt');

    expect(result).toBe('default content');
    expect(mockReadFile).toHaveBeenCalledWith('prompts/test-prompt.md', 'utf-8');
  });

  it('should use custom prompts directory', async () => {
    mockReadFile.mockResolvedValue('custom content');

    const loader = new PromptLoader('/custom/path');
    const result = await loader.loadPrompt('test-prompt');

    expect(result).toBe('custom content');
    expect(mockReadFile).toHaveBeenCalledWith('/custom/path/test-prompt.md', 'utf-8');
  });
});
