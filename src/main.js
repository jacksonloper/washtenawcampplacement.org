// Client-side navigation between pre-rendered pages.
//
// Every page is also a real HTML file, so this is only an enhancement:
// with JavaScript off, links just load the next page normally.

import routes from 'virtual:pages';

const main = document.getElementById('content');

function normalize(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function lookup(pathname) {
  let r = routes[normalize(pathname)];
  if (r && r.redirect) r = routes[r.redirect];
  return r;
}

function markCurrent(pathname) {
  const here = normalize(pathname);
  for (const a of document.querySelectorAll('.site-nav a')) {
    if (normalize(new URL(a.href).pathname) === here) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function render(pathname, { scroll = true } = {}) {
  const r = lookup(pathname);
  if (!r) return false;
  // Pre-rendered HTML is already in place on first load; don't redo it.
  if (main.dataset.path || !main.firstElementChild) {
    main.innerHTML = r.html;
    document.title = r.title;
  }
  main.dataset.path = normalize(pathname);
  markCurrent(pathname);
  if (scroll) window.scrollTo(0, 0);
  return true;
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return;
  if (!lookup(url.pathname)) return;
  e.preventDefault();
  history.pushState(null, '', normalize(url.pathname) + url.search + url.hash);
  render(url.pathname);
  document.body.classList.remove('menu-open');
  document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
});

window.addEventListener('popstate', () => render(location.pathname, { scroll: false }));

// Mobile menu.
document.querySelector('.menu-toggle')?.addEventListener('click', (e) => {
  const open = document.body.classList.toggle('menu-open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

// Spanish: what the free GTranslate plugin did on the WordPress site. Google's
// Website Translator script rewrites the page text in the browser, and its
// "googtrans" cookie keeps the language as the visitor moves between pages.
const langLink = document.querySelector('[data-translate]');
const translating = /(?:^|;\s*)googtrans=\/en\/\w/.test(document.cookie);

function setGoogtrans(value) {
  // Google's script may also set the cookie on the domain, so write both forms.
  const expires = value ? '' : '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `googtrans=${value}; path=/${expires}`;
  document.cookie = `googtrans=${value}; path=/; domain=${location.hostname}${expires}`;
}

function loadTranslator() {
  const holder = document.createElement('div');
  holder.id = 'google_translate_element';
  holder.hidden = true;
  document.body.append(holder);
  window.wcpTranslateInit = () =>
    new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, holder.id);
  const s = document.createElement('script');
  s.src = 'https://translate.google.com/translate_a/element.js?cb=wcpTranslateInit';
  document.head.append(s);
}

if (langLink) {
  if (translating) {
    langLink.textContent = 'English';
    langLink.lang = 'en';
    loadTranslator();
  }
  langLink.addEventListener('click', (e) => {
    e.preventDefault();
    setGoogtrans(translating ? '' : `/en/${langLink.dataset.translate}`);
    location.reload();
  });
}

if (!render(location.pathname, { scroll: false })) {
  main.innerHTML = '<div class="page"><h1>Page not found</h1><p>Sorry, that page doesn’t exist. Try the <a href="/">home page</a>.</p></div>';
}
