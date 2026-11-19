// Shared by every page: theme toggle, live release data, and the ⌘K command menu.
// Other scripts add menu items with: window.dispatchEvent(new CustomEvent('palette:add', {detail: [...items]}))
// where an item is {group, label, hint, run}.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- theme ---------- */
function setTheme(t) {
  if (t === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('spud-theme', t); } catch (_) {}
  const m = $('meta[name="theme-color"]');
  if (m) m.content = t === 'light' ? '#ECEBE5' : '#1C1D1B';
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
$$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));

/* ---------- release data (GitHub API; buttons keep their fallback link if it fails) ---------- */
const RELEASES = 'https://github.com/LuiGiJohn/spud-releases/releases';
(async () => {
  try {
    const r = await fetch('https://api.github.com/repos/LuiGiJohn/spud-releases/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return;
    const rel = await r.json();
    const dmg = (rel.assets || []).find((a) => a.name.endsWith('.dmg'));
    const v = (rel.tag_name || '').replace(/^v/, '');
    if (dmg) $$('[data-dl]').forEach((a) => (a.href = dmg.browser_download_url));
    if (!v) return;
    $$('[data-version]').forEach((e) => (e.textContent = v));
    $$('[data-version-line]').forEach((e) => (e.textContent = 'Version ' + v));
    $$('[data-version-plain]').forEach((e) => { e.textContent = ''; const a = document.createElement('a'); a.href = rel.html_url; a.textContent = v; e.append(a); });
    if (rel.published_at) {
      const d = new Date(rel.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      $$('[data-released]').forEach((e) => (e.textContent = d));
    }
  } catch (_) {}
})();

/* ---------- ⌘K command menu ---------- */
const SHORTCUTS = [
  ['Space', 'Play / pause'], ['← / →', 'Step one frame (⇧ for 1 s)'], ['↑ / ↓', 'Previous / next clip'],
  ['I / O', 'Set trim in / out'], ['\\', 'Before / after'], ['R', 'Crop & transform'], ['F', 'Focus mode'],
  ['0–5', 'Rating'], ['⌘Z / ⇧⌘Z', 'Undo / redo'], ['⌘C / ⌘V', 'Copy / paste adjustments'], ['⌘E', 'Export panel'],
  ['A / B', 'Timeline: selection / blade tool'], ['S or ⌘B', 'Timeline: split at playhead'], ['N', 'Timeline: snapping'],
];
const onHome = !!$('#top.stage');
const go = (hash) => () => { if (onHome) location.hash = hash; else location.href = './' + hash; };
let items = [
  { group: 'Pages', label: 'Home', hint: '/', run: () => (location.href = './') },
  { group: 'Pages', label: 'Grade', hint: '#grade', run: go('#grade') },
  { group: 'Pages', label: 'Edit', hint: '#edit', run: go('#edit') },
  { group: 'Pages', label: 'Export', hint: '#export', run: go('#export') },
  { group: 'Pages', label: 'Looks: all 51, before and after', hint: '/presets', run: () => (location.href = 'presets.html') },
  { group: 'Get SPUD', label: 'Download for Mac', hint: 'DMG', run: () => (location.href = ($('[data-dl]') || {}).href || RELEASES + '/latest') },
  { group: 'Get SPUD', label: 'All releases and source', hint: 'GitHub', run: () => (location.href = RELEASES) },
  { group: 'Tools', label: 'App keyboard shortcuts', hint: '?', run: () => openShortcuts() },
  { group: 'Tools', label: 'Switch light / dark theme', hint: 'theme', run: toggleTheme },
];
window.addEventListener('palette:add', (e) => { items = items.concat(e.detail); });

const pal = document.createElement('div');
pal.className = 'palette';
pal.setAttribute('role', 'dialog');
pal.setAttribute('aria-modal', 'true');
pal.setAttribute('aria-label', 'Command menu');
pal.innerHTML = `<div class="box">
  <input type="text" placeholder="Search pages, nodes, frames, looks…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pal-list">
  <ul id="pal-list" role="listbox"></ul>
  <div class="sc"><table></table></div>
  <div class="foot"><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span></div></div>`;
document.body.append(pal);
const input = $('input', pal), list = $('ul', pal);
$('.sc table', pal).innerHTML = SHORTCUTS.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
let shown = [], sel = 0, lastFocus = null;

function render() {
  const q = input.value.trim().toLowerCase();
  shown = items.filter((i) => !q || (i.label + ' ' + i.group + ' ' + (i.hint || '')).toLowerCase().includes(q));
  sel = Math.min(sel, Math.max(shown.length - 1, 0));
  let html = '', g = '';
  shown.forEach((it, n) => {
    if (it.group !== g) { g = it.group; html += `<li class="h" role="presentation">${g}</li>`; }
    html += `<li class="i" role="option" id="pal-${n}" data-n="${n}" aria-selected="${n === sel}"><span></span><small></small></li>`;
  });
  list.innerHTML = html || '<li class="h">No match</li>';
  shown.forEach((it, n) => { const li = $(`#pal-${n}`, list); li.firstChild.textContent = it.label; li.lastChild.textContent = it.hint || ''; });
  input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + sel : '');
  const cur = $(`#pal-${sel}`, list); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function open() { lastFocus = document.activeElement; pal.classList.add('open'); pal.classList.remove('sc-open'); input.value = ''; sel = 0; render(); input.focus(); }
function close() { pal.classList.remove('open', 'sc-open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function openShortcuts() { if (!pal.classList.contains('open')) open(); pal.classList.add('sc-open'); $('.box', pal).focus?.(); }
function choose(n) { const it = shown[n]; if (!it) return; close(); it.run(); }

input.addEventListener('input', () => { sel = 0; render(); });
list.addEventListener('click', (e) => { const li = e.target.closest('li.i'); if (li) choose(+li.dataset.n); });
pal.addEventListener('mousedown', (e) => { if (e.target === pal) close(); });
document.addEventListener('keydown', (e) => {
  const isOpen = pal.classList.contains('open');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); isOpen ? close() : open(); return; }
  if (!isOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); pal.classList.contains('sc-open') ? pal.classList.remove('sc-open') || input.focus() : close(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); render(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
});
$$('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
