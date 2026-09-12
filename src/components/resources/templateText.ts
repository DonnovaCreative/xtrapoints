export type Block = { type?: string; kind?: string; id?: string; text?: string; [key: string]: any };
export function plainValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(plainValue).join(' — ');
  return String(value ?? '');
}
export function filledText(text: unknown, fields: Record<string, string> = {}) {
  return plainValue(text).replace(/\[([^\[\]\n]+)\]/g, (original, label) => fields[label]?.trim() || original);
}
export function blocksToText(blocks: Block[], fields: Record<string, string> = {}): string {
  const fill = (value: unknown) => filledText(value, fields);
  return blocks.map(block => {
    switch (block.type || block.kind) {
      case 'message': return [block.subject ? `Subject: ${fill(block.subject)}` : '', ...block.body.map(fill)].filter(Boolean).join('\n\n');
      case 'list': case 'bullets': return block.items.map((item: unknown) => `• ${fill(item)}`).join('\n');
      case 'table': return [block.headers, ...block.rows].map((row: unknown[]) => row.map(value => fill(value).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
      case 'link': return `${fill(block.text)}: ${block.href}`;
      case 'source': return `${block.title}\n${block.observation || ''}\n${block.url || ''}`;
      default: return fill(block.text);
    }
  }).filter(Boolean).join('\n\n');
}
export function placeholders(blocks: Block[]) {
  return [...new Set([...blocksToText(blocks).matchAll(/\[([^\[\]\n]+)\]/g)].map(match => match[1]))];
}
