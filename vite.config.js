import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import matter from 'gray-matter';
import { load as loadYaml } from 'js-yaml';

const CONTENT = fileURLToPath(new URL('./content', import.meta.url));

// ---------------------------------------------------------------------------
// Markdown: CommonMark + raw HTML + a few ::: containers for Divi-style layout.
//
//   :::::: band #d6efb0      full-width coloured stripe
//   ::::: columns 3/4 1/4    side-by-side columns (stack on phones)
//   :::: column
//   ::: details Question {open}   accordion item
//   ::: quote                green emphasised text
//
// Outer containers need more colons than the ones nested inside them.
// ---------------------------------------------------------------------------

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------

function loadSite() {
  const site = loadYaml(fs.readFileSync(path.join(CONTENT, 'site.yml'), 'utf8'));
  const pages = [];
  for (const file of fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md')).sort()) {
    const { data, content } = matter(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
    const url = data.url || (file === 'index.md' ? '/' : `/${file.replace(/\.md$/, '')}/`);
    pages.push({ file, url, title: data.title || url, description: data.description || '', aliases: data.aliases || [], html: `<div class="page">${md.render(content)}</div>` });
  }
  return { site, pages };
}

// ---------------------------------------------------------------------------
// Header and footer, rendered once at build time from site.yml.
// ---------------------------------------------------------------------------

const ICONS = {
  facebook: '<path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/>',
  instagram: '<path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.9-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM20 5a4.5 4.5 0 0 0-3-1c-1.2-.1-8.8-.1-10 0a4.5 4.5 0 0 0-3 1 4.5 4.5 0 0 0-1 3c-.1 1.2-.1 6.8 0 8a4.5 4.5 0 0 0 1 3 4.5 4.5 0 0 0 3 1c1.2.1 8.8.1 10 0a4.5 4.5 0 0 0 3-1 4.5 4.5 0 0 0 1-3c.1-1.2.1-6.8 0-8a4.5 4.5 0 0 0-1-3z" fill-rule="evenodd"/>',
  linkedin: '<path d="M6.9 8.7H3.3V20h3.6zM5.1 3a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM20.7 13.4c0-3.3-.7-5-3.9-5a3.6 3.6 0 0 0-3.2 1.7V8.7h-3.4V20h3.6v-5.6c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20h3.6z"/>',
};

function header(site) {
  const item = (m) => {
    if (!m.children) return `<li><a href="${m.url}">${esc(m.label)}</a></li>`;
    return `<li class="has-sub"><a href="${m.url}">${esc(m.label)}</a><ul>${m.children.map(item).join('')}</ul></li>`;
  };
  return `
<header class="site-header">
  <div class="wrap header-top">
    <a class="logo" href="/"><img src="${site.logo}" width="191" height="82" alt="${esc(site.title)}"></a>
    <p class="tagline">${esc(site.tagline)}</p>
    <div class="header-actions">
      <a class="lang" data-translate="es" href="#">Español</a>
      <a class="donate" href="${site.donate.url}" target="_blank" rel="noopener">${esc(site.donate.label)}</a>
    </div>
  </div>
  <nav class="site-nav" aria-label="Main">
    <div class="wrap">
      <button class="menu-toggle" aria-expanded="false" aria-controls="menu">Menu</button>
      <ul id="menu">${site.menu.map(item).join('')}</ul>
    </div>
  </nav>
</header>`;
}

function footer(site) {
  const c = site.contact;
  const social = Object.entries(site.social || {})
    .map(([k, url]) => `<a href="${url}" target="_blank" rel="noopener" aria-label="${k}"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${ICONS[k] || ''}</svg></a>`)
    .join('');
  const cols = site.footer.map((col) => `<ul>${col.map((l) => `<li><a href="${l.url}">${esc(l.label)}</a></li>`).join('')}</ul>`).join('');
  return `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-contact">
      <img src="${site.logo}" width="150" height="64" alt="" loading="lazy">
      <p>${esc(c.address.trim()).replace(/\n/g, '<br>')}<br>${esc(c.phone)}<br>fax ${esc(c.fax)}<br><a href="mailto:${c.email}">${esc(c.email)}</a></p>
    </div>
    <nav class="footer-links" aria-label="Footer">${cols}</nav>
    <div class="social">${social}</div>
  </div>
  <p class="copyright">Copyright ${new Date().getFullYear()} ${esc(site.title)}. All rights reserved.</p>
</footer>`;
}

// ---------------------------------------------------------------------------
// Plugin: serves pages as a virtual module in dev, and writes one real HTML
// file per URL at build time so every page works without JavaScript.
// ---------------------------------------------------------------------------

function wcpContent() {
  const ID = 'virtual:pages';
  let data = loadSite();
  let outDir;

  const titleFor = (p) => (p.url === '/' ? data.site.title : `${p.title} - ${data.site.title}`);

  return {
    name: 'wcp-content',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    load(id) {
      if (id !== '\0' + ID) return;
      const routes = {};
      for (const p of data.pages) {
        routes[p.url] = { title: titleFor(p), html: p.html };
        for (const a of p.aliases) routes[a] = { redirect: p.url };
      }
      return `export default ${JSON.stringify(routes)};`;
    },
    transformIndexHtml(html) {
      return html.replace('<!--header-->', header(data.site)).replace('<!--footer-->', footer(data.site));
    },
    configureServer(server) {
      server.watcher.add(CONTENT);
      server.watcher.on('all', (_e, file) => {
        if (!file.startsWith(CONTENT)) return;
        data = loadSite();
        const mod = server.moduleGraph.getModuleById('\0' + ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
    closeBundle() {
      const shell = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const page = (title, body, extraHead = '') =>
        shell
          .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>${extraHead}`)
          .replace('<main id="content"></main>', `<main id="content">${body}</main>`);

      for (const p of data.pages) {
        const canonical = `<link rel="canonical" href="${data.site.url}${p.url}">` +
          (p.description ? `<meta name="description" content="${esc(p.description)}">` : '');
        const file = path.join(outDir, p.url, 'index.html');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, page(titleFor(p), p.html, canonical));
        for (const a of p.aliases) {
          const af = path.join(outDir, a, 'index.html');
          fs.mkdirSync(path.dirname(af), { recursive: true });
          fs.writeFileSync(af, `<!doctype html><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${p.url}"><meta http-equiv="refresh" content="0; url=${p.url}"><a href="${p.url}">${esc(p.title)}</a>`);
        }
      }
      // Netlify: real 301s for aliases; the "!" makes them win over the refresh pages above.
      fs.writeFileSync(path.join(outDir, '_redirects'),
        data.pages.flatMap((p) => p.aliases.map((a) => `${a} ${p.url} 301!`)).join('\n') + '\n');
      fs.writeFileSync(path.join(outDir, '404.html'), page(`Page not found - ${data.site.title}`,
        '<div class="page"><h1>Page not found</h1><p>Sorry, that page doesn’t exist. Try the <a href="/">home page</a>.</p></div>'));
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        data.pages.map((p) => `  <url><loc>${data.site.url}${p.url}</loc></url>`).join('\n') + '\n</urlset>\n');
      console.log(`wcp-content: wrote ${data.pages.length} pages, ${data.pages.reduce((n, p) => n + p.aliases.length, 0)} redirects, 404.html, sitemap.xml`);
    },
  };
}

export default defineConfig({
  plugins: [wcpContent()],
  appType: 'spa',
});
