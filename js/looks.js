// Looks page: switch between grid, list and reel views, filter the looks, and add them to the ⌘K menu.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const looks = $$('article.look');
const groups = $$('section.group');
const shown = $('[data-shown]');

/* views */
function setView(v) {
  document.body.dataset.view = v;
  $$('[data-view]').forEach((b) => b.setAttribute('aria-checked', b.dataset.view === v));
  try { localStorage.setItem('spud-looks-view', v); } catch (_) {}
  if (v === 'reel') tiltAll();
}
$$('.seg [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
let saved = 'grid';
try { saved = localStorage.getItem('spud-looks-view') || 'grid'; } catch (_) {}
setView(['grid', 'list', 'reel'].includes(saved) ? saved : 'grid');

/* reel tilt: each card turns by how far it sits from the row's centre */
function tilt(row) {
  if (reduce || document.body.dataset.view !== 'reel') return;
  const c = row.getBoundingClientRect(), mid = c.left + c.width / 2;
  for (const el of row.children) {
    const r = el.getBoundingClientRect();
    const off = Math.max(-1.5, Math.min(1.5, (r.left + r.width / 2 - mid) / r.width));
    el.style.setProperty('--off', off.toFixed(3));
    el.style.setProperty('--abs', Math.min(1, Math.abs(off)).toFixed(3));
  }
}
const tiltAll = () => $$('.looks').forEach(tilt);
$$('.looks').forEach((row) => {
  let raf = 0;
  row.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; tilt(row); }); }, { passive: true });
});
addEventListener('resize', tiltAll);

/* filter on name, description, best-for and source */
const text = new Map(looks.map((a) => [a, a.textContent.toLowerCase()]));
function filter(q) {
  q = q.trim().toLowerCase();
  let n = 0;
  looks.forEach((a) => { const hit = !q || text.get(a).includes(q); a.hidden = !hit; if (hit) n++; });
  groups.forEach((g) => { g.hidden = !$$('article.look', g).some((a) => !a.hidden); });
  shown.textContent = q ? `${n} of ${looks.length}` : `${looks.length} looks`;
  tiltAll();
}
$('[data-filter]').addEventListener('input', (e) => filter(e.target.value));
filter('');

/* ⌘K: jump to any look */
window.dispatchEvent(new CustomEvent('palette:add', { detail: [
  { group: 'View', label: 'Grid view', hint: 'looks', run: () => setView('grid') },
  { group: 'View', label: 'List view', hint: 'looks', run: () => setView('list') },
  { group: 'View', label: 'Reel view', hint: 'looks', run: () => setView('reel') },
  ...looks.map((a) => ({
    group: 'Looks', label: $('h3', a).textContent, hint: a.closest('section.group').id,
    run: () => { $('[data-filter]').value = ''; filter(''); a.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'center' }); },
  })),
] }));
