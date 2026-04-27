import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export class PromptLoader {
  private promptsDir: string;

  constructor(promptsDir = './prompts') {
    this.promptsDir = promptsDir;
  }

  async loadPrompt(name: string): Promise<string> {
    const filePath = join(this.promptsDir, `${name}.md`);
    const content = await readFile(filePath, 'utf-8');
    return content;
  }

  async loadTechnicalSpec(): Promise<string> {
    const filePath = join(this.promptsDir, 'technical-specification.md');
    const content = await readFile(filePath, 'utf-8');
    if (!content.startsWith('# TECHNICAL SPECIFICATION')) {
      throw new Error(
        "Invalid technical specification: file must start with '# TECHNICAL SPECIFICATION'",
      );
    }
    return content;
  }

  async saveTechnicalSpec(content: string): Promise<void> {
    const filePath = join(this.promptsDir, 'technical-specification.md');
    await writeFile(filePath, content, 'utf-8');
  }

  async validate(): Promise<{ valid: boolean; missing: string[] }> {
    const requiredFiles = [
      'system-design-agent.md',
      'npm-project-creation-prompt.md',
      'technical-specification.md',
    ];

    const missing: string[] = [];

    for (const file of requiredFiles) {
      const filePath = join(this.promptsDir, file);
      try {
        await access(filePath);
      } catch {
        missing.push(file);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
