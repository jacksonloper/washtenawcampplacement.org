// One-time migration: WordPress/Divi pages (from db.json) -> markdown.
//
//   node tools/convert.mjs [path/to/db.json]
//
// db.json is the WordPress database as JSON, made from a SQL backup by
// parse_dump.py. It holds private data (users, emails), so keep it out of git.
//
// Writes content/*.md and images.txt (the uploads the pages use; download
// them into public/images/).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// Works both in the site repo (tools/ beside content/) and in a scratch
// folder where the site lives in site/.
const site = fs.existsSync(path.join(root, 'site', 'package.json')) ? path.join(root, 'site') : root;
const require = createRequire(path.join(site, 'package.json'));
const TurndownService = require('turndown');

const db = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'db.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Divi 4 shortcodes -> tree
// ---------------------------------------------------------------------------

function parseAttrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function parseShortcodes(src) {
  const re = /\[(\/?)(et_pb_[\w]+)([^\]]*)\]/g;
  const rootNode = { name: 'root', attrs: {}, children: [], text: '' };
  const stack = [rootNode];
  let last = 0;
  for (const m of src.matchAll(re)) {
    const top = stack[stack.length - 1];
    top.text += src.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[1]) {
      // closing tag: pop back to the matching open
      while (stack.length > 1 && stack.pop().name !== m[2]);
    } else {
      const node = { name: m[2], attrs: parseAttrs(m[3]), children: [], text: '' };
      top.children.push(node);
      stack.push(node);
    }
  }
  stack[stack.length - 1].text += src.slice(last);
  return rootNode;
}

function fromDivi4(node) {
  const a = node.attrs;
  const kids = () => node.children.map(fromDivi4).filter(Boolean);
  switch (node.name) {
    case 'root': return { type: 'page', children: kids() };
    case 'et_pb_section': return { type: 'section', bg: a.background_color || null, children: kids() };
    case 'et_pb_row': return { type: 'row', children: kids() };
    case 'et_pb_column': return { type: 'column', width: a.type || '4_4', children: kids() };
    case 'et_pb_text': return { type: 'text', html: node.text, color: a.text_text_color || null };
    case 'et_pb_code': return { type: 'code', html: node.text };
    case 'et_pb_image': return { type: 'image', src: a.src, alt: a.alt || '', link: a.url || null };
    case 'et_pb_accordion': return { type: 'accordion', children: kids() };
    case 'et_pb_accordion_item':
      return { type: 'item', title: a.title || '', open: a.open === 'on', html: node.text };
    default:
      console.warn('  ! unhandled Divi 4 module', node.name);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Divi 5 block comments -> tree
// ---------------------------------------------------------------------------

const dv = (o, ...keys) => keys.reduce((x, k) => (x == null ? x : x[k]), o);
const desk = (o) => dv(o, 'innerContent', 'desktop', 'value');

function parseDivi5(src) {
  const re = /<!-- (\/?)wp:divi\/([\w-]+)(?: (\{.*?\}))? (\/?)-->/g;
  const rootNode = { name: 'root', json: {}, children: [] };
  const stack = [rootNode];
  for (const m of src.matchAll(re)) {
    if (m[1]) { stack.pop(); continue; }
    const node = { name: m[2], json: m[3] ? JSON.parse(m[3]) : {}, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!m[4]) stack.push(node);
  }
  return rootNode;
}

function fromDivi5(node) {
  const j = node.json;
  const kids = () => node.children.map(fromDivi5).filter(Boolean).flat();
  switch (node.name) {
    case 'root': return { type: 'page', children: kids() };
    case 'placeholder': return kids();
    case 'section':
      return { type: 'section', bg: dv(j, 'module', 'decoration', 'background', 'desktop', 'value', 'color') || null, children: kids() };
    case 'row': return { type: 'row', children: kids() };
    case 'column':
      return { type: 'column', width: dv(j, 'module', 'advanced', 'type', 'desktop', 'value') || '4_4', children: kids() };
    case 'text':
      return { type: 'text', html: desk(j.content) || '', color: dv(j, 'content', 'decoration', 'bodyFont', 'body', 'font', 'desktop', 'value', 'color') || null };
    case 'code': return { type: 'code', html: desk(j.content) || '' };
    case 'image': {
      const v = desk(j.image) || {};
      const attrs = dv(j, 'module', 'decoration', 'attributes', 'desktop', 'value', 'attributes') || [];
      const alt = v.alt || (attrs.find((x) => x.name === 'alt') || {}).value || '';
      return { type: 'image', src: v.src, alt, link: v.linkUrl || null };
    }
    case 'accordion': return { type: 'accordion', children: kids() };
    case 'accordion-item':
      return { type: 'item', title: desk(j.title) || '', open: dv(j, 'module', 'advanced', 'open', 'desktop', 'value') === 'on', html: desk(j.content) || '' };
    case 'fullwidth-header':
      return { type: 'section', bg: dv(j, 'module', 'decoration', 'background', 'desktop', 'value', 'color') || null,
        children: [{ type: 'text', html: `<h1 class="banner">${desk(j.title) || ''}</h1>` }] };
    default:
      console.warn('  ! unhandled Divi 5 module', node.name);
      return null;
  }
}

// ---------------------------------------------------------------------------
// HTML -> markdown
// ---------------------------------------------------------------------------

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', br: '\\', emDelimiter: '*' });
td.keep(['iframe', 'video', 'audio', 'details', 'summary']);

// Links that open a new tab are kept as HTML so target="_blank" survives.
td.addRule('externalLink', {
  filter: (n) => n.nodeName === 'A' && n.getAttribute('target') === '_blank',
  replacement: (content, n) => `<a href="${n.getAttribute('href')}" target="_blank" rel="noopener">${content}</a>`,
});

// WordPress stores Divi 4 text with bare newlines; wpautop turns them into
// <p> and <br>. Do the same before converting.
const BLOCK = /^\s*<(p|h[1-6]|ul|ol|div|blockquote|table|figure|iframe|hr)\b/i;
function autop(html) {
  if (!/\n/.test(html)) return html;
  return html
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (BLOCK.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br>\n')}</p>`))
    .join('\n');
}

const images = new Set();

function localImage(src) {
  if (!src) return src;
  const m = src.match(/\/wp-content\/uploads\/(.+)$/);
  if (!m) return src;
  images.add(m[1]);
  return `/images/${m[1]}`;
}

function relinks(s) {
  return s
    .replace(/https?:\/\/(www\.)?washtenawcampplacement\.org\/wp-content\/uploads\/([^"'\s)\\]+)/g, (_, _w, p) => localImage(`/wp-content/uploads/${p}`))
    .replace(/https?:\/\/(www\.)?washtenawcampplacement\.org(\/[^"'\s)]*)?/g, (_, _w, p) => p || '/');
}

function md(html) {
  return td.turndown(autop(relinks(html))).trim();
}

// ---------------------------------------------------------------------------
// Tree -> markdown with ::: containers
// ---------------------------------------------------------------------------

const FRACTION = { '4_4': '1', '1_2': '1/2', '1_3': '1/3', '2_3': '2/3', '1_4': '1/4', '3_4': '3/4', '1_5': '1/5', '2_5': '2/5', '3_5': '3/5' };

function renderModule(m) {
  switch (m.type) {
    case 'text': {
      const body = md(m.html);
      // Divi's green "quote" text colour becomes a class, not a hard-coded colour.
      return m.color && /27663d|006839/i.test(m.color) ? `::: quote\n${body}\n:::` : body;
    }
    case 'code': return relinks(m.html).trim();
    case 'image': {
      const img = `![${m.alt}](${localImage(m.src)})`;
      return m.link ? `[${img}](${relinks(m.link)})` : img;
    }
    case 'accordion':
      return m.children.map((it) => `::: details ${it.title}${it.open ? ' {open}' : ''}\n${md(it.html)}\n:::`).join('\n\n');
    default: return '';
  }
}

function renderColumn(c) {
  return c.children.map(renderModule).filter(Boolean).join('\n\n');
}

function renderRow(r) {
  const cols = r.children.filter((c) => c.type === 'column');
  if (cols.length <= 1) return cols.map(renderColumn).join('\n\n');
  // Empty spacer columns still take up width, so keep them.
  const widths = cols.map((c) => FRACTION[c.width] || c.width).join(' ');
  return `::::: columns ${widths}\n${cols.map((c) => `:::: column\n${renderColumn(c)}\n::::`).join('\n\n')}\n:::::`;
}

function renderSection(s) {
  // Full-width sections hold modules (or a nested section) directly, not rows.
  const body = s.children
    .map((c) => (c.type === 'row' ? renderRow(c) : c.type === 'section' ? renderSection(c) : renderModule(c)))
    .filter(Boolean).join('\n\n');
  // Nested containers need more colons on the outside: details/quote 3,
  // column 4, columns 5, band 6.
  return s.bg ? `:::::: band ${s.bg.toLowerCase()}\n${body}\n::::::` : body;
}

function renderPage(tree) {
  return tree.children.filter((s) => s.type === 'section').map(renderSection).filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const posts = db.wp_posts;
const byId = Object.fromEntries(posts.map((p) => [p.ID, p]));
const pages = posts.filter((p) => p.post_type === 'page' && p.post_status === 'publish');
const opts = Object.fromEntries(db.wp_options.map((o) => [o.option_name, o.option_value]));

function permalink(p) {
  if (p.ID === opts.page_on_front) return '/';
  const parts = [];
  for (let q = p; q && q.post_type === 'page'; q = byId[q.post_parent]) parts.unshift(q.post_name);
  return `/${parts.join('/')}/`;
}

const outDir = path.join(site, 'content');
// Replace generated pages only; site.yml is hand-written and lives here too.
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.md')) fs.rmSync(path.join(outDir, f));

for (const p of pages) {
  const src = p.post_content;
  const tree = /<!-- wp:divi\//.test(src) ? fromDivi5(parseDivi5(src)) : fromDivi4(parseShortcodes(src));
  const url = permalink(p);
  const fm = ['---', `title: ${JSON.stringify(p.post_title)}`, `url: ${url}`];
  // WordPress also answers child pages at their bare slug (/ways-to-give/).
  if (url.split('/').length > 3) fm.push(`aliases: [/${p.post_name}/]`);
  fm.push(`updated: ${p.post_modified_gmt.slice(0, 10)}`, '---', '');
  const file = url === '/' ? 'index.md' : `${p.post_name}.md`;
  fs.writeFileSync(path.join(outDir, file), fm.join('\n') + '\n' + renderPage(tree) + '\n');
  console.log(`${file.padEnd(32)} ${url}`);
}

fs.writeFileSync(path.join(root, 'images.txt'), [...images].sort().join('\n') + '\n');
console.log(`\n${pages.length} pages, ${images.size} images referenced -> images.txt`);
