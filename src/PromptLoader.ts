import fs from 'node:fs/promises';
import path from 'node:path';

export class PromptLoader {
  private promptsDir: string;

  constructor(promptsDir = './prompts') {
    this.promptsDir = promptsDir;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read ${filePath}: ${(err as Error).message}`);
    }
  }

  async loadPrompt(name: string): Promise<string> {
    const file = path.join(this.promptsDir, `${name}.md`);
    return this.readFile(file);
  }

  async loadTechnicalSpec(): Promise<string> {
    const file = path.join(this.promptsDir, 'technical-specification.md');
    const content = await this.readFile(file);
    if (!content.trimStart().startsWith('# TECHNICAL SPECIFICATION')) {
      throw new Error('Technical specification must start with "# TECHNICAL SPECIFICATION"');
    }
    return content;
  }

  async saveTechnicalSpec(content: string): Promise<void> {
    const file = path.join(this.promptsDir, 'technical-specification.md');
    await fs.writeFile(file, content, 'utf-8');
  }

  async validate(): Promise<{ valid: boolean; missing: string[] }> {
    const required = [
      'system-design-agent.md',
      'npm-project-creation-prompt.md',
      'technical-specification.md',
    ];
    const missing: string[] = [];
    for (const file of required) {
      try {
        await fs.access(path.join(this.promptsDir, file));
      } catch {
        missing.push(file);
      }
    }
    return { valid: missing.length === 0, missing };
  }
}
