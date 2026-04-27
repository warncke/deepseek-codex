import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DeepSeekProvider } from '../src/DeepSeekProvider.js';
import { AppConfig } from '../src/AppConfig.js';
import { ReplSession } from '../src/ReplSession.js';
import type { IInferenceProvider, IReplCommand } from '../src/interfaces.js';

const mockReadFile = jest.fn<() => Promise<string>>();
const mockWriteFile = jest.fn<() => Promise<void>>();
const mockAccess = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  access: mockAccess,
}));

const { PromptLoader } = await import('../src/PromptLoader.js');

describe('AppConfig', () => {
  it('should parse default values', () => {
    const config = new AppConfig(['node', 'script.js']);
    expect(config.promptsDir).toBe('./prompts');
    expect(config.provider).toBe('deepseek');
    expect(config.baseUrl).toBeUndefined();
    expect(config.model).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
  });

  it('should parse --prompts-dir', () => {
    const config = new AppConfig(['node', 'script.js', '--prompts-dir', '/custom/prompts']);
    expect(config.promptsDir).toBe('/custom/prompts');
  });

  it('should parse --provider', () => {
    const config = new AppConfig(['node', 'script.js', '--provider', 'openai']);
    expect(config.provider).toBe('openai');
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
});

describe('DeepSeekProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if DEEPSEEK_API_KEY is not set', () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => new DeepSeekProvider()).toThrow(
      'DEEPSEEK_API_KEY environment variable is not set.',
    );
  });

  it('should create instance when API key is set', () => {
    const provider = new DeepSeekProvider();
    expect(provider.providerName).toBe('DeepSeek V4');
    expect(provider.apiKeyEnvVar).toBe('DEEPSEEK_API_KEY');
  });

  it('should successfully chat and return response', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello from AI' } }],
    };

    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Hello from AI');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and succeed', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Success after retry' } }],
    };

    const fetchMock = jest
      .fn<typeof global.fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

    global.fetch = fetchMock;

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Success after retry');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw on 401', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Authentication failed',
    );
  });

  it('should throw after exhausting retries on 500', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Server error');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

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
});

describe('ReplSession', () => {
  let mockProvider: jest.Mocked<IInferenceProvider>;
  let mockLoader: jest.Mocked<PromptLoader>;
  let session: ReplSession;

  beforeEach(() => {
    mockProvider = {
      providerName: 'MockProvider',
      apiKeyEnvVar: 'MOCK_KEY',
      chat: jest.fn(),
    } as unknown as jest.Mocked<IInferenceProvider>;

    mockLoader = {
      loadPrompt: jest.fn(),
      loadTechnicalSpec: jest.fn(),
      saveTechnicalSpec: jest.fn(),
      validate: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    session = new ReplSession(mockProvider, mockLoader);
  });

  it('should register built-in commands', () => {
    const expectedCommands = ['help', 'load', 'spec', 'chat', 'append-spec', 'run', 'exit'];
    for (const cmd of expectedCommands) {
      expect(session.commands.has(cmd)).toBe(true);
    }
  });

  it('should register custom commands', () => {
    const customCommand: IReplCommand = {
      description: 'Custom command',
      execute: jest.fn(),
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

    session.running = true;
    await exitCmd!.execute([], session);
    expect(session.running).toBe(false);
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

describe('SpecTreeView', () => {
  it('should parse top-level headings', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\nSome text\n\n## Section 1\n\nContent\n\n## Section 2\n\nMore';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].level).toBe(1);
    expect(nodes[0].text).toBe('Title');
    expect(nodes[0].children).toHaveLength(2);
    expect(nodes[0].children[0].text).toBe('Section 1');
    expect(nodes[0].children[1].text).toBe('Section 2');
  });

  it('should parse multiple top-level H2 headings', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '## Overview\n\nText\n\n## Details\n\nMore';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].text).toBe('Overview');
    expect(nodes[1].text).toBe('Details');
  });

  it('should handle nested headings at various levels', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children).toHaveLength(1);
    expect(nodes[0].children[0].children).toHaveLength(1);
    expect(nodes[0].children[0].children[0].children).toHaveLength(1);
    expect(nodes[0].children[0].children[0].children[0].children).toHaveLength(1);
    expect(nodes[0].children[0].children[0].children[0].children[0].children).toHaveLength(1);
  });

  it('should return empty array for markdown with no headings', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const nodes = parseMarkdownHeadings('Just some text\n\nNo headings here');
    expect(nodes).toHaveLength(0);
  });

  it('should set expanded based on level', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2\n\n### H3\n\n#### H4';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes[0].expanded).toBe(true);
    expect(nodes[0].children[0].expanded).toBe(true);
    expect(nodes[0].children[0].children[0].expanded).toBe(false);
    expect(nodes[0].children[0].children[0].children[0].expanded).toBe(false);
  });

  it('should render tree with box drawing characters', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\n## Section 1\n\n### Subsection';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 0);
    expect(output).toContain('\u250C');
    expect(output).toContain('\u2510');
    expect(output).toContain('\u2514');
    expect(output).toContain('\u2518');
    expect(output).toContain('Technical Specification');
    expect(output).toContain('\u25BC');
    expect(output).toContain('\u2022');
    expect(output).toContain('>');
  });

  it('should render tree with correct heading text', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# Main Title\n\n## Section One';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 0);
    expect(output).toContain('Main Title');
    expect(output).toContain('Section One');
  });

  it('should have exactly one > marker when an item is selected', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 0);
    const markerCount = (output.match(/>/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it('should have exactly one > marker when a middle item is selected', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 2);
    const markerCount = (output.match(/>/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it('should have exactly one > marker when last item is selected', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
    const nodes = parseMarkdownHeadings(markdown);
    const flat = (await import('../src/SpecTreeView.js')).flattenTree;
    const flatItems = flat(nodes);
    const lastIndex = flatItems.length - 1;
    const output = renderTree(nodes, lastIndex);
    const markerCount = (output.match(/>/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it('should have no > markers when selectedIndex is out of range', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2a';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 999);
    const markerCount = (output.match(/>/g) || []).length;
    expect(markerCount).toBe(0);
  });

  it('should move > marker when selectedIndex changes', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# H1\n\n## H2a\n\n## H2b';
    const nodes = parseMarkdownHeadings(markdown);
    const output0 = renderTree(nodes, 0);
    const output1 = renderTree(nodes, 1);
    const lines0 = output0.split('\n');
    const lines1 = output1.split('\n');
    const selectedLine0 = lines0.find((l) => l.startsWith('\u2502>'));
    const selectedLine1 = lines1.find((l) => l.startsWith('\u2502>'));
    expect(selectedLine0).toContain('H1');
    expect(selectedLine1).toContain('H2a');
  });

  it('should parse body text between headings', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown =
      '# Title\n\nSome body content\n\nMore body\n\n## Section 1\n\nSection body text';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes[0].body).toContain('Some body content');
    expect(nodes[0].body).toContain('More body');
    expect(nodes[0].children[0].body).toBe('Section body text');
  });

  it('should have empty body for heading with no body text', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\n## Section 1';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes[0].body).toBe('');
    expect(nodes[0].children[0].body).toBe('');
  });

  it('should render body content with box drawing framing when showBody is true', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\nBody line 1\n\nBody line 2\n\n## Section';
    const nodes = parseMarkdownHeadings(markdown);
    nodes[0].showBody = true;
    const output = renderTree(nodes, 0);
    expect(output).toContain('\u250C');
    expect(output).toContain('\u2514');
    expect(output).toContain('\u2502');
    expect(output).toContain('Body line 1');
    expect(output).toContain('Body line 2');
  });

  it('should not render body content when showBody is false', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\nHidden body text\n\n## Section';
    const nodes = parseMarkdownHeadings(markdown);
    nodes[0].showBody = false;
    const output = renderTree(nodes, 0);
    expect(output).not.toContain('Hidden body text');
  });

  it('should include expand body hint in bottom border', async () => {
    const { parseMarkdownHeadings, renderTree } = await import('../src/SpecTreeView.js');
    const markdown = '# Title';
    const nodes = parseMarkdownHeadings(markdown);
    const output = renderTree(nodes, 0);
    expect(output).toContain('expand body');
  });

  it('should have showBody default to false', async () => {
    const { parseMarkdownHeadings } = await import('../src/SpecTreeView.js');
    const markdown = '# Title\n\nBody text\n\n## Section';
    const nodes = parseMarkdownHeadings(markdown);
    expect(nodes[0].showBody).toBe(false);
    expect(nodes[0].children[0].showBody).toBe(false);
  });
});
