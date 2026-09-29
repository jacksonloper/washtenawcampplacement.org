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

// Spanish: hand the current page to Google Translate's proxy, which is what
// the GTranslate plugin does under the hood. No script or cookie needed.
document.querySelector('[data-translate]')?.addEventListener('click', (e) => {
  e.preventDefault();
  const host = location.hostname.replace(/-/g, '--').replace(/\./g, '-');
  const lang = e.currentTarget.dataset.translate;
  if (/localhost|127\.0\.0\.1/.test(host)) {
    alert(`Translation works once the site is public (Google needs to fetch the page).`);
    return;
  }
  location.href = `https://${host}.translate.goog${location.pathname}?_x_tr_sl=en&_x_tr_tl=${lang}&_x_tr_hl=${lang}`;
});

if (!render(location.pathname, { scroll: false })) {
  main.innerHTML = '<div class="page"><h1>Page not found</h1><p>Sorry, that page doesn’t exist. Try the <a href="/">home page</a>.</p></div>';
}
