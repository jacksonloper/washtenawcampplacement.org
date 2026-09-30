// The Decap editor at /admin/. Decap itself loads from unpkg in
// admin/index.html; this adds the site's preview and the two boxes staff can
// put in any text: expandable questions and green quotes.

import { load as loadYaml, dump as dumpYaml, JSON_SCHEMA } from 'js-yaml';
import configYml from '../admin/config.yml?raw';
import css from './style.css?inline';
import { renderPage, renderMarkdown, esc } from './render.js';

const CMS = window.CMS;
const h = window.h;

// Preview pane: the page as the site renders it, with the site's fonts and CSS.
CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap');
CMS.registerPreviewStyle(css, { raw: true });
CMS.registerPreviewTemplate('pages', ({ entry }) =>
  h('main', { id: 'content', dangerouslySetInnerHTML: { __html: renderPage(entry.get('data').toJS()) } }));

// ::: details Question {open}
CMS.registerEditorComponent({
  id: 'details',
  label: 'Question (click to expand)',
  fields: [
    { name: 'summary', label: 'Question', widget: 'string' },
    { name: 'open', label: 'Start expanded', widget: 'boolean', default: false },
    { name: 'body', label: 'Answer', widget: 'markdown', buttons: ['bold', 'italic', 'link', 'bulleted-list', 'numbered-list'], editor_components: [] },
  ],
  pattern: /^::: details (.+?)( \{open\})?\n([\s\S]*?)\n:::(?=\n|$)/,
  fromBlock: (m) => ({ summary: m[1], open: Boolean(m[2]), body: m[3] }),
  toBlock: (d) => `::: details ${d.summary || ''}${d.open ? ' {open}' : ''}\n${(d.body || '').trim()}\n:::`,
  toPreview: (d) =>
    `<details class="accordion"${d.open ? ' open' : ''}><summary>${esc(d.summary || '')}</summary><div>${renderMarkdown(d.body || '')}</div></details>`,
});

// ::: quote
CMS.registerEditorComponent({
  id: 'quote',
  label: 'Green quote',
  fields: [{ name: 'body', label: 'Text', widget: 'markdown', editor_components: [] }],
  pattern: /^::: quote\n([\s\S]*?)\n:::(?=\n|$)/,
  fromBlock: (m) => ({ body: m[1] }),
  toBlock: (d) => `::: quote\n${(d.body || '').trim()}\n:::`,
  toPreview: (d) => `<div class="quote">${renderMarkdown(d.body || '')}</div>`,
});

// Decap hands formats the fields in no particular order; keep files stable.
const yamlOut = (data, keys) => dumpYaml(
  Object.fromEntries([...keys.filter((k) => k in data).map((k) => [k, data[k]]), ...Object.entries(data).filter(([k]) => !keys.includes(k))]),
  { schema: JSON_SCHEMA, lineWidth: -1, noRefs: true },
);

// Pages are front matter only. Write it the way tools/to_sections.mjs does,
// with text as readable `|-` blocks, instead of Decap's folded YAML. The JSON
// schema keeps dates like 2026-06-01 as plain text.
CMS.registerCustomFormat('page-yaml', 'md', {
  fromFile(text) {
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const data = loadYaml(m ? m[1] : text, { schema: JSON_SCHEMA }) || {};
    return m && m[2].trim() ? { ...data, body: m[2] } : data;
  },
  toFile(data) {
    const { body, ...front } = data;
    const yaml = yamlOut(front, ['title', 'url', 'aliases', 'updated', 'description', 'sections']);
    return `---\n${yaml}---\n${body ? `\n${body.trim()}\n` : ''}`;
  },
});

// Site settings: plain YAML in the same style, keeping the note at the top.
const SITE_NOTE = '# Site-wide settings: header, menu and footer. Edit at /admin/ or by hand.\n# Pages live next to this file as markdown.\n\n';
CMS.registerCustomFormat('site-yaml', 'yml', {
  fromFile: (text) => loadYaml(text, { schema: JSON_SCHEMA }),
  toFile: (data) => SITE_NOTE + yamlOut(data, ['title', 'tagline', 'logo', 'url', 'donate', 'menu', 'contact', 'social', 'footer']),
});

// Save to the branch this copy of the site was built from (see vite.config.js).
const config = loadYaml(configYml);
config.backend.branch = __CMS_BRANCH__;
CMS.init({ config: { ...config, load_config_file: false } });
