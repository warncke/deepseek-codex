export interface SpecNode {
  level: number;
  text: string;
  body: string;
  children: SpecNode[];
  expanded: boolean;
  showBody: boolean;
}

export function parseMarkdownHeadings(markdown: string): SpecNode[] {
  const lines = markdown.split('\n');
  const root: SpecNode[] = [];
  const stack: { node: SpecNode; depth: number }[] = [];

  let currentBody: string[] = [];
  let currentParent: SpecNode | null = null;

  const flushBody = () => {
    if (currentParent) {
      currentParent.body = currentBody.join('\n').trim();
    }
    currentBody = [];
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      flushBody();

      const level = match[1].length;
      const text = match[2].trim();
      const node: SpecNode = {
        level,
        text,
        body: '',
        children: [],
        expanded: level < 3,
        showBody: false,
      };

      while (stack.length > 0 && stack[stack.length - 1].depth >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].node.children.push(node);
      }

      stack.push({ node, depth: level });
      currentParent = node;
    } else {
      currentBody.push(line);
    }
  }

  flushBody();

  return root;
}

export function flattenTree(
  nodes: SpecNode[],
  depth: number = 0,
  startIndex: number = 0,
): { node: SpecNode; depth: number; index: number; isBody: boolean }[] {
  const result: { node: SpecNode; depth: number; index: number; isBody: boolean }[] = [];
  let currentIndex = startIndex;
  for (const node of nodes) {
    result.push({ node, depth, index: currentIndex, isBody: false });
    currentIndex++;
    if (node.showBody && node.body) {
      const bodyLines = node.body.split('\n');
      for (let i = 0; i < bodyLines.length; i++) {
        result.push({ node, depth: depth + 1, index: currentIndex, isBody: true });
        currentIndex++;
      }
    }
    if (node.expanded && node.children.length > 0) {
      const children = flattenTree(node.children, depth + 1, currentIndex);
      result.push(...children);
      currentIndex += children.length;
    }
  }
  return result;
}

function renderLine(
  node: SpecNode,
  depth: number,
  selected: boolean,
  isBody: boolean,
  bodyLineIndex: number,
  totalBodyLines: number,
): string {
  if (isBody) {
    const indent = '  '.repeat(depth);
    const marker = selected ? '>' : ' ';
    const bodyLines = node.body.split('\n');
    const bodyText = bodyLines[bodyLineIndex] || '';
    const isFirst = bodyLineIndex === 0;
    const isLast = bodyLineIndex === totalBodyLines - 1;

    if (isFirst) {
      return `${marker} ${indent}\u250C ${bodyText}`;
    } else if (isLast) {
      return `${marker} ${indent}\u2514 ${bodyText}`;
    } else {
      return `${marker} ${indent}\u2502 ${bodyText}`;
    }
  }

  const indent = '  '.repeat(depth);
  const hasChildren = node.children.length > 0;

  let prefix: string;
  if (hasChildren) {
    prefix = node.expanded ? '\u25BC' : '\u25B6';
  } else {
    prefix = '\u2022';
  }

  const marker = selected ? '>' : ' ';
  return `${marker} ${indent}${prefix} ${node.text}`;
}

export function renderTree(nodes: SpecNode[], selectedIndex: number): string {
  const flat = flattenTree(nodes);
  const lines: string[] = [];

  const termWidth = process.stdout.columns || 80;
  const title = 'Technical Specification';
  const padding = Math.max(0, termWidth - title.length - 4);
  const topBorder =
    '\u250C' +
    '\u2500'.repeat(Math.floor(padding / 2)) +
    ' ' +
    title +
    ' ' +
    '\u2500'.repeat(Math.ceil(padding / 2)) +
    '\u2510';
  lines.push(topBorder);

  const bodyLineCounters = new Map<SpecNode, number>();

  for (const item of flat) {
    if (item.isBody) {
      const count = bodyLineCounters.get(item.node) || 0;
      const totalBodyLines = item.node.body.split('\n').length;
      const isSelected = item.index === selectedIndex;
      lines.push(
        '\u2502' + renderLine(item.node, item.depth, isSelected, true, count, totalBodyLines),
      );
      bodyLineCounters.set(item.node, count + 1);
    } else {
      const isSelected = item.index === selectedIndex;
      lines.push('\u2502' + renderLine(item.node, item.depth, isSelected, false, 0, 0));
    }
  }

  const bottomText =
    ' \u2191\u2193 navigate  \u2192 expand body/children  \u2190 collapse  q quit ';
  const bottomPadding = Math.max(0, termWidth - bottomText.length - 2);
  const bottomBorder =
    '\u2514' +
    '\u2500'.repeat(Math.floor(bottomPadding / 2)) +
    bottomText +
    '\u2500'.repeat(Math.ceil(bottomPadding / 2)) +
    '\u2518';
  lines.push(bottomBorder);

  return lines.join('\n');
}

export async function showInteractiveSpec(spec: string): Promise<void> {
  const nodes = parseMarkdownHeadings(spec);
  if (nodes.length === 0) {
    console.log('(no headings found in specification)');
    return;
  }

  if (!process.stdin.isTTY) {
    console.log(renderTree(nodes, 0));
    return;
  }

  let selectedIndex = 0;

  const stdin = process.stdin;
  const stdout = process.stdout;
  const wasRaw = stdin.isRaw;

  return new Promise<void>((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    let buffer = '';

    const render = () => {
      const output = renderTree(nodes, selectedIndex);
      stdout.write('\x1b[?25l');
      stdout.write('\x1b[2J\x1b[H');
      stdout.write(output + '\n');
    };

    render();

    const onData = (chunk: string) => {
      buffer += chunk;

      if (buffer.length === 0) return;

      if (buffer === '\u001b') {
        return;
      }

      if (buffer === '\u001b[') {
        return;
      }

      if (buffer.startsWith('\u001b[') && buffer.length < 3) {
        return;
      }

      if (buffer.startsWith('\u001b[') && buffer.length >= 3) {
        const seq = buffer;
        buffer = '';

        const flatItems = flattenTree(nodes);

        if (seq === '\u001b[A') {
          if (selectedIndex > 0) {
            selectedIndex--;
            render();
          }
        } else if (seq === '\u001b[B') {
          if (selectedIndex < flatItems.length - 1) {
            selectedIndex++;
            render();
          }
        } else if (seq === '\u001b[C') {
          const item = flatItems[selectedIndex];
          if (item && !item.isBody) {
            if (item.node.body && !item.node.showBody) {
              item.node.showBody = true;
              render();
            } else if (item.node.children.length > 0 && !item.node.expanded) {
              item.node.expanded = true;
              render();
            }
          }
        } else if (seq === '\u001b[D') {
          const item = flatItems[selectedIndex];
          if (item && item.isBody && item.node.showBody) {
            item.node.showBody = false;
            const newFlat = flattenTree(nodes);
            const headingIdx = newFlat.findIndex((f) => f.node === item.node && !f.isBody);
            if (headingIdx >= 0) {
              selectedIndex = headingIdx;
            }
            render();
          } else if (item && !item.isBody && item.node.showBody) {
            item.node.showBody = false;
            render();
          } else if (item && !item.isBody && item.node.expanded) {
            item.node.expanded = false;
            render();
          } else if (item && !item.isBody && item.node.children.length > 0 && !item.node.expanded) {
            const parent = findParent(nodes, item.node);
            if (parent) {
              parent.expanded = false;
              const newFlat = flattenTree(nodes);
              const parentIdx = newFlat.findIndex((f) => f.node === parent);
              if (parentIdx >= 0) {
                selectedIndex = parentIdx;
              }
              render();
            }
          }
        }
        return;
      }

      const char = buffer;
      buffer = '';

      if (char === '\r' || char === '\n') {
        const flatItems = flattenTree(nodes);
        const item = flatItems[selectedIndex];
        if (item && !item.isBody) {
          if (item.node.body) {
            item.node.showBody = !item.node.showBody;
            render();
          } else if (item.node.children.length > 0 && !item.node.expanded) {
            item.node.expanded = true;
            render();
          }
        }
      } else if (char === 'q' || char === '\u001b') {
        cleanup();
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (!wasRaw) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      stdout.write('\x1b[?25h');
      stdout.write('\x1b[0J');
      resolve();
    };

    stdin.on('data', onData);
  });
}

function findParent(nodes: SpecNode[], target: SpecNode): SpecNode | null {
  for (const node of nodes) {
    if (node.children.includes(target)) return node;
    const found = findParent(node.children, target);
    if (found) return found;
  }
  return null;
}
