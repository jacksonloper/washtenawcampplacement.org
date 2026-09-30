// One-off: move each page's layout from ::: containers in the markdown body
// into a `sections:` list in the front matter, which the Decap editor can show
// as forms. Details and quote boxes stay as ::: inside each markdown field.
//
//   node tools/to_sections.mjs content/*.md

import fs from 'node:fs';
import * as yaml from 'js-yaml';

// The home page's number tiles used to be images with the number drawn in.
const TILES = {
  'camperships-awarded': 'circle',
  'year-started': 'plain',
  'camperships-2026': 'person',
  'cost-to-families': 'bill',
  'average-cost': 'bill',
};
const TILE_NUMBERS = { 'Zero dollars': '$0', '900 dollars': '$900' };

const OPEN = /^(:{4,6})\s*(band|columns|column)\b\s*(.*)$/;

// Split markdown into top-level blocks: plain text runs and 4-6 colon containers.
function blocks(lines) {
  const out = [];
  let text = [];
  const flush = () => { if (text.join('\n').trim()) out.push({ kind: 'text', body: text.join('\n').trim() }); text = []; };
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(OPEN);
    if (!m) { text.push(lines[i]); continue; }
    flush();
    const fence = m[1];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== fence) j++;
    if (j === lines.length) throw new Error(`unclosed ${fence} ${m[2]}`);
    out.push({ kind: m[2], info: m[3].trim(), inner: lines.slice(i + 1, j) });
    i = j;
  }
  flush();
  return out;
}

function tile(body) {
  const m = body.match(/^!\[([^\]]*)\]\(\/images\/2026\/01\/([\w-]+)\.png\)\s*::: quote\n([\s\S]*?)\n:::$/);
  if (!m || !TILES[m[2]]) return null;
  return { shape: TILES[m[2]], number: TILE_NUMBERS[m[1]] || m[1], caption: m[3].trim() };
}

function toSection(b) {
  if (b.kind === 'text') return { type: 'text', body: b.body };
  if (b.kind === 'band') return { type: 'band', color: b.info, body: b.inner.join('\n').trim() };
  const columns = blocks(b.inner).map((c) => {
    if (c.kind !== 'column') throw new Error(`unexpected ${c.kind} inside columns`);
    return { body: c.inner.join('\n').trim() };
  });
  const tiles = columns.map((c) => tile(c.body));
  if (tiles.every(Boolean)) return { type: 'stats', items: tiles };
  return { type: 'columns', layout: b.info, columns };
}

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  // JSON schema keeps dates like 2026-06-01 as plain text.
  const front = yaml.load(m[1], { schema: yaml.JSON_SCHEMA });
  if (front.sections) { console.log(`${file}: already has sections`); continue; }
  front.sections = blocks(m[2].split('\n')).map(toSection);
  const out = `---\n${yaml.dump(front, { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true })}---\n`;
  fs.writeFileSync(file, out);
  console.log(`${file}: ${front.sections.length} sections`);
}
