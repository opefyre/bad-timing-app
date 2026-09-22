/** Bounded, non-validating XML reader for public feeds. No DTD, entity expansion, network, or HTML execution. */
export interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }
function decode(s: string) {
  return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const base: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (base[entity]) return base[entity];
    const n = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}
export function parseXml(xml: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD and entities are not supported');
  if (xml.length > 5 * 1024 * 1024) throw new Error('XML too large');
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' }; const stack = [root]; let count = 0;
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/[\w:.-]+\s*>|<[\w:.-]+(?:\s+[^<>]*?)?\s*\/?>|[^<]+/g;
  let end = 0;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== end) throw new Error('Invalid XML'); end = match.index! + match[0].length;
    const token = match[0]; const parent = stack[stack.length - 1];
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) { parent.text += token.slice(9, -3); continue; }
    if (token.startsWith('</')) { if (stack.length === 1 || parent.name !== token.slice(2, -1).trim()) throw new Error('Unbalanced XML'); stack.pop(); continue; }
    if (!token.startsWith('<')) { parent.text += decode(token); continue; }
    const name = /^<([\w:.-]+)/.exec(token)![1]; const attrs: Record<string, string> = {};
    for (const a of token.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
    const node = { name, attrs, children: [], text: '' };
    parent.children.push(node); if (++count > 70000 || stack.length > 64) throw new Error('XML limits exceeded');
    if (!token.endsWith('/>')) stack.push(node);
  }
  if (end !== xml.length || stack.length !== 1 || root.children.length !== 1) throw new Error('Invalid XML document');
  return root;
}
export const localName = (n: XmlNode) => n.name.split(':').pop()!;
export const children = (n: XmlNode, name: string) => n.children.filter(c => localName(c) === name);
export function descendants(n: XmlNode, name: string): XmlNode[] { return n.children.flatMap(c => [...(localName(c) === name ? [c] : []), ...descendants(c, name)]); }
export const content = (n?: XmlNode): string => n ? (n.text + n.children.map(content).join(' ')).trim() : '';
export const value = (n: XmlNode, name: string): string => content(children(n, name)[0]);
export const deepValue = (n: XmlNode, name: string): string => content(descendants(n, name)[0]);
