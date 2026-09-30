// Page rendering, shared by the build (vite.config.js) and the Decap editor's
// preview pane (src/admin.js), so the preview matches the real site.
//
// A page's front matter holds a list of sections (see public/admin/config.yml):
//
//   text      markdown
//   band      full-width coloured stripe with markdown in it
//   columns   side-by-side columns (stack on phones), each with markdown
//   stats     number tiles, e.g. "638 camperships awarded"
//
// Inside any markdown, two boxes are available (Decap shows them as forms):
//
//   ::: details Question {open}   accordion item
//   ::: quote                     green emphasised text
//
// Sections are turned into markdown with ::: containers and rendered with
// markdown-it. Outer containers need more colons than the ones inside them.

import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

md.use(container, 'band', {
  render(tokens, i) {
    if (tokens[i].nesting !== 1) return '</div></section>\n';
    const color = tokens[i].info.trim().split(/\s+/)[1] || '';
    const style = /^#[0-9a-f]{3,8}$/i.test(color) ? ` style="--band:${color}"` : '';
    return `<section class="band"${style}><div class="wrap">\n`;
  },
});

md.use(container, 'columns', {
  render(tokens, i) {
    if (tokens[i].nesting !== 1) return '</div>\n';
    const widths = tokens[i].info.trim().split(/\s+/).slice(1).map((w) => {
      const [a, b] = w.split('/').map(Number);
      return b ? `${+(a / b * 12).toFixed(2)}fr` : '1fr';
    });
    return `<div class="columns" style="--cols:${widths.join(' ') || 'repeat(auto-fit,minmax(0,1fr))'}">\n`;
  },
});

md.use(container, 'column', {
  render: (tokens, i) => (tokens[i].nesting === 1 ? '<div class="column">\n' : '</div>\n'),
});

md.use(container, 'details', {
  render(tokens, i) {
    if (tokens[i].nesting !== 1) return '</div></details>\n';
    let title = tokens[i].info.trim().replace(/^details\s*/, '');
    const open = /\{open\}\s*$/.test(title);
    title = title.replace(/\s*\{open\}\s*$/, '');
    return `<details class="accordion"${open ? ' open' : ''}><summary>${md.renderInline(title)}</summary><div>\n`;
  },
});

md.use(container, 'quote', {
  render: (tokens, i) => (tokens[i].nesting === 1 ? '<div class="quote">\n' : '</div>\n'),
});

const trim = (s) => (s || '').trim();

function stat({ shape = 'circle', number = '', caption = '' }) {
  return `<div class="stat stat-${esc(shape)}"><span>${esc(number)}</span></div>\n\n::: quote\n${trim(caption)}\n:::`;
}

function sectionToMarkdown(s) {
  switch (s.type) {
    case 'band':
      return `:::::: band ${s.color || ''}\n${trim(s.body)}\n::::::`;
    case 'columns':
      return `::::: columns ${s.layout || ''}\n` +
        (s.columns || []).map((c) => `:::: column\n${trim(c.body)}\n::::`).join('\n\n') +
        '\n:::::';
    case 'stats': {
      const items = s.items || [];
      return `::::: columns ${items.map(() => `1/${items.length}`).join(' ')}\n` +
        items.map((it) => `:::: column\n${stat(it)}\n::::`).join('\n\n') +
        '\n:::::';
    }
    default:
      return trim(s.body);
  }
}

export const renderMarkdown = (s) => md.render(s);

// data: a page's front matter. body: markdown after it (older pages, or none).
export function renderPage(data, body = '') {
  const parts = (data.sections || []).map(sectionToMarkdown);
  if (trim(body)) parts.push(trim(body));
  return `<div class="page">${md.render(parts.join('\n\n'))}</div>`;
}
