import { jest, describe, it, expect } from '@jest/globals';
import {
  parseMarkdownHeadings,
  renderTree,
  flattenTree,
  showInteractiveSpec,
  findParent,
} from './SpecTreeView.js';

describe('SpecTreeView', () => {
  describe('parseMarkdownHeadings', () => {
    it('should parse top-level headings', () => {
      const markdown = '# Title\n\nSome text\n\n## Section 1\n\nContent\n\n## Section 2\n\nMore';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].level).toBe(1);
      expect(nodes[0].text).toBe('Title');
      expect(nodes[0].children).toHaveLength(2);
      expect(nodes[0].children[0].text).toBe('Section 1');
      expect(nodes[0].children[1].text).toBe('Section 2');
    });

    it('should parse multiple top-level H2 headings', () => {
      const markdown = '## Overview\n\nText\n\n## Details\n\nMore';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].text).toBe('Overview');
      expect(nodes[1].text).toBe('Details');
    });

    it('should handle nested headings at various levels', () => {
      const markdown = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].children).toHaveLength(1);
      expect(nodes[0].children[0].children).toHaveLength(1);
      expect(nodes[0].children[0].children[0].children).toHaveLength(1);
      expect(nodes[0].children[0].children[0].children[0].children).toHaveLength(1);
      expect(nodes[0].children[0].children[0].children[0].children[0].children).toHaveLength(1);
    });

    it('should return empty array for markdown with no headings', () => {
      const nodes = parseMarkdownHeadings('Just some text\n\nNo headings here');
      expect(nodes).toHaveLength(0);
    });

    it('should set expanded based on level', () => {
      const markdown = '# H1\n\n## H2\n\n### H3\n\n#### H4';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes[0].expanded).toBe(true);
      expect(nodes[0].children[0].expanded).toBe(true);
      expect(nodes[0].children[0].children[0].expanded).toBe(false);
      expect(nodes[0].children[0].children[0].children[0].expanded).toBe(false);
    });

    it('should parse body text between headings', () => {
      const markdown =
        '# Title\n\nSome body content\n\nMore body\n\n## Section 1\n\nSection body text';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes[0].body).toContain('Some body content');
      expect(nodes[0].body).toContain('More body');
      expect(nodes[0].children[0].body).toBe('Section body text');
    });

    it('should have empty body for heading with no body text', () => {
      const markdown = '# Title\n\n## Section 1';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes[0].body).toBe('');
      expect(nodes[0].children[0].body).toBe('');
    });

    it('should have showBody default to false', () => {
      const markdown = '# Title\n\nBody text\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      expect(nodes[0].showBody).toBe(false);
      expect(nodes[0].children[0].showBody).toBe(false);
    });
  });

  describe('flattenTree', () => {
    it('should flatten a simple tree', () => {
      const markdown = '# H1\n\n## H2a\n\n## H2b';
      const nodes = parseMarkdownHeadings(markdown);
      const flat = flattenTree(nodes);
      expect(flat).toHaveLength(3);
      expect(flat[0].node.text).toBe('H1');
      expect(flat[1].node.text).toBe('H2a');
      expect(flat[2].node.text).toBe('H2b');
    });

    it('should include body lines when showBody is true', () => {
      const markdown = '# Title\n\nBody line 1\nBody line 2\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      nodes[0].showBody = true;
      const flat = flattenTree(nodes);
      const bodyItems = flat.filter((f) => f.isBody);
      expect(bodyItems).toHaveLength(2);
      expect(bodyItems[0].node.text).toBe('Title');
    });

    it('should not include body lines when showBody is false', () => {
      const markdown = '# Title\n\nBody text\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      const flat = flattenTree(nodes);
      const bodyItems = flat.filter((f) => f.isBody);
      expect(bodyItems).toHaveLength(0);
    });

    it('should not include children when expanded is false', () => {
      const markdown = '# H1\n\n## H2';
      const nodes = parseMarkdownHeadings(markdown);
      nodes[0].expanded = false;
      const flat = flattenTree(nodes);
      expect(flat).toHaveLength(1);
      expect(flat[0].node.text).toBe('H1');
    });
  });

  describe('renderTree', () => {
    it('should render tree with box drawing characters', () => {
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

    it('should render tree with correct heading text', () => {
      const markdown = '# Main Title\n\n## Section One';
      const nodes = parseMarkdownHeadings(markdown);
      const output = renderTree(nodes, 0);
      expect(output).toContain('Main Title');
      expect(output).toContain('Section One');
    });

    it('should have exactly one > marker when an item is selected', () => {
      const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
      const nodes = parseMarkdownHeadings(markdown);
      const output = renderTree(nodes, 0);
      const markerCount = (output.match(/>/g) || []).length;
      expect(markerCount).toBe(1);
    });

    it('should have exactly one > marker when a middle item is selected', () => {
      const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
      const nodes = parseMarkdownHeadings(markdown);
      const output = renderTree(nodes, 2);
      const markerCount = (output.match(/>/g) || []).length;
      expect(markerCount).toBe(1);
    });

    it('should have exactly one > marker when last item is selected', () => {
      const markdown = '# H1\n\n## H2a\n\n## H2b\n\n### H3a\n\n### H3b';
      const nodes = parseMarkdownHeadings(markdown);
      const flat = flattenTree(nodes);
      const lastIndex = flat.length - 1;
      const output = renderTree(nodes, lastIndex);
      const markerCount = (output.match(/>/g) || []).length;
      expect(markerCount).toBe(1);
    });

    it('should have no > markers when selectedIndex is out of range', () => {
      const markdown = '# H1\n\n## H2a';
      const nodes = parseMarkdownHeadings(markdown);
      const output = renderTree(nodes, 999);
      const markerCount = (output.match(/>/g) || []).length;
      expect(markerCount).toBe(0);
    });

    it('should move > marker when selectedIndex changes', () => {
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

    it('should render body content with box drawing framing when showBody is true', () => {
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

    it('should not render body content when showBody is false', () => {
      const markdown = '# Title\n\nHidden body text\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      nodes[0].showBody = false;
      const output = renderTree(nodes, 0);
      expect(output).not.toContain('Hidden body text');
    });

    it('should include expand body hint in bottom border', () => {
      const markdown = '# Title';
      const nodes = parseMarkdownHeadings(markdown);
      const output = renderTree(nodes, 0);
      expect(output).toContain('expand body');
    });

    it('should render empty nodes gracefully', () => {
      const output = renderTree([], 0);
      expect(output).toContain('Technical Specification');
    });

    it('should render body lines with correct framing characters', () => {
      const markdown = '# Title\n\nLine 1\nLine 2\nLine 3\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      nodes[0].showBody = true;
      const output = renderTree(nodes, 0);
      const lines = output.split('\n');
      const bodyLines = lines.filter(
        (l) => l.includes('Line 1') || l.includes('Line 2') || l.includes('Line 3'),
      );
      expect(bodyLines[0]).toContain('\u250C');
      expect(bodyLines[bodyLines.length - 1]).toContain('\u2514');
      expect(bodyLines.length).toBe(3);
    });

    it('should render selected body line with > marker', () => {
      const markdown = '# Title\n\nBody text\n\n## Section';
      const nodes = parseMarkdownHeadings(markdown);
      nodes[0].showBody = true;
      const flat = flattenTree(nodes);
      const bodyIndex = flat.findIndex((f) => f.isBody);
      const output = renderTree(nodes, bodyIndex);
      const lines = output.split('\n');
      const selectedLine = lines.find((l) => l.startsWith('\u2502>'));
      expect(selectedLine).toContain('Body text');
    });
  });

  describe('showInteractiveSpec', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    it('should log message when spec has no headings', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await showInteractiveSpec('Just some text with no headings');
      expect(consoleSpy).toHaveBeenCalledWith('(no headings found in specification)');
      consoleSpy.mockRestore();
    });

    it('should render tree when not a TTY', async () => {
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = false;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await showInteractiveSpec('# Title\n\n## Section');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('Technical Specification');
      expect(output).toContain('Title');
      expect(output).toContain('Section');
      consoleSpy.mockRestore();
      process.stdin.isTTY = originalIsTTY;
    });

    it('should handle TTY mode with q to quit', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\n## Section');

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(process.stdin.resume).toHaveBeenCalled();
      expect(stdoutWriteSpy).toHaveBeenCalled();

      dataHandler!('q');

      await promise;

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
      expect(process.stdin.pause).toHaveBeenCalled();

      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle TTY mode with Enter key to expand body', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\nBody content\n\n## Section');

      dataHandler!('\r');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle TTY mode with arrow keys', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a\n\n## H2b');

      dataHandler!('\u001b[B');
      dataHandler!('\u001b[C');
      dataHandler!('\u001b[D');
      dataHandler!('\u001b[A');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle right arrow to expand children', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a\n\n## H2b');

      dataHandler!('\u001b[C');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle left arrow to collapse expanded children', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a\n\n## H2b');

      dataHandler!('\u001b[C');
      dataHandler!('\u001b[D');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle Enter key to expand children when no body', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a');

      dataHandler!('\r');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle partial escape sequence buffers', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\n## Section');

      dataHandler!('\u001b');
      dataHandler!('\u001b[');
      dataHandler!('\u001b[A');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle right arrow on item with body to expand body', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\nBody content\n\n## Section');

      dataHandler!('\u001b[C');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle left arrow on body item to collapse', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\nBody content\n\n## Section');

      dataHandler!('\u001b[C');
      dataHandler!('\u001b[D');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle Enter on item with children but no body', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a\n\n### H3a');

      dataHandler!('\u001b[B');
      dataHandler!('\u001b[B');
      dataHandler!('\r');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle right arrow on item with body and children to expand children after body', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\nBody\n\n## Section');

      dataHandler!('\u001b[C');
      dataHandler!('\u001b[C');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle left arrow on body item to collapse and jump to heading', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# Title\n\nBody content\n\n## Section');

      dataHandler!('\u001b[C');
      dataHandler!('\u001b[B');
      dataHandler!('\u001b[D');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });

    it('should handle left arrow on collapsed child to find parent', async () => {
      const orig = {
        isTTY: process.stdin.isTTY,
        isRaw: (process.stdin as any).isRaw,
        setRawMode: process.stdin.setRawMode,
        resume: process.stdin.resume,
        pause: process.stdin.pause,
        setEncoding: process.stdin.setEncoding,
        on: process.stdin.on,
        removeListener: process.stdin.removeListener,
      };

      process.stdin.isTTY = true;
      Object.defineProperty(process.stdin, 'isRaw', { value: false, writable: true });
      (process.stdin as any).setRawMode = jest.fn();
      (process.stdin as any).resume = jest.fn();
      (process.stdin as any).pause = jest.fn();
      (process.stdin as any).setEncoding = jest.fn();
      (process.stdin as any).removeListener = jest.fn();

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let dataHandler: ((chunk: string) => void) | null = null;
      (process.stdin as any).on = jest.fn((_event: string, handler: (chunk: string) => void) => {
        dataHandler = handler;
      });

      const promise = showInteractiveSpec('# H1\n\n## H2a\n\n### H3a');

      dataHandler!('\u001b[B');
      dataHandler!('\u001b[B');
      dataHandler!('\u001b[D');
      dataHandler!('q');

      await promise;

      expect(stdoutWriteSpy).toHaveBeenCalled();
      stdoutWriteSpy.mockRestore();
      process.stdin.isTTY = orig.isTTY;
      Object.defineProperty(process.stdin, 'isRaw', { value: orig.isRaw, writable: true });
      (process.stdin as any).setRawMode = orig.setRawMode;
      (process.stdin as any).resume = orig.resume;
      (process.stdin as any).pause = orig.pause;
      (process.stdin as any).setEncoding = orig.setEncoding;
      (process.stdin as any).on = orig.on;
      (process.stdin as any).removeListener = orig.removeListener;
    });
  });

  describe('findParent', () => {
    it('should find parent of a direct child', () => {
      const markdown = '# Parent\n\n## Child';
      const nodes = parseMarkdownHeadings(markdown);
      const parent = findParent(nodes, nodes[0].children[0]);
      expect(parent).toBe(nodes[0]);
    });

    it('should find parent of a nested child', () => {
      const markdown = '# Grandparent\n\n## Parent\n\n### Child';
      const nodes = parseMarkdownHeadings(markdown);
      const child = nodes[0].children[0].children[0];
      const parent = findParent(nodes, child);
      expect(parent).toBe(nodes[0].children[0]);
    });

    it('should return null when no parent exists', () => {
      const markdown = '# Root1\n\n# Root2';
      const nodes = parseMarkdownHeadings(markdown);
      const result = findParent(nodes, nodes[0]);
      expect(result).toBeNull();
    });
  });
});
