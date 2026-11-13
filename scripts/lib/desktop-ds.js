/* Public DS pages retain one native Adaptive Edge, closed by default; they
   get no exemption from ownership, images, errors or geometry. Other DS apps
   retain their strict DS Edge contract, with a direct workspace shell only
   for ds-wereldwerkruimte. /ds/voorbeeld.html owns its framed examples.
   Each route's contract.json browser proof measures its deeper promises. */
'use strict';
module.exports = async function dsScherm(page, row, errors) {
  const publiek = await page.evaluate(() => document.documentElement.hasAttribute('data-ds') &&
    document.body.matches('.ds-magazine-page,.ds-public-story'));
  if (publiek) return publiekeEdge(page, row, errors);
  const voorbeeld = await page.evaluate(() => location.pathname.startsWith('/ds/'));
  await page.waitForFunction(({ voorbeeld }) => {
    const zichtbaar = selector => [...document.querySelectorAll(selector)].some(e =>
      e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    return zichtbaar(voorbeeld ? '.ds-toestel .ds-edge__balk' : '.ds-edge__balk [data-ds-edge="rahul"]') ||
      zichtbaar('.ds-foundation-toegang');
  }, { voorbeeld }, { timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('img')].filter(i => i.loading !== 'lazy' || i.getClientRects().length)
    .every(i => i.complete), null, { timeout: 12000 });
  row.state = await page.evaluate(() => {
    const zichtbaarElement = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const zichtbaar = s => [...document.querySelectorAll(s)].filter(zichtbaarElement).length;
    const oudeShells = [...document.querySelectorAll('.wd-shell')].filter(e =>
      zichtbaarElement(e) &&
      !(document.body.classList.contains('ds-wereldwerkruimte') && e.parentElement === document.body)
    ).length;
    return {
      world: document.body.dataset.rtgWorld,
      systeem: getComputedStyle(document.documentElement).getPropertyValue('--ds-schermhoogte').trim(),
      edges: zichtbaar('.ds-edge__balk'),
      oudeEdges: zichtbaar('.rtg-adaptive-bar,.rtg-edge-chrome') + oudeShells,
      toegang: zichtbaar('.ds-foundation-toegang'),
      toegangRect: (() => { const e = document.querySelector('.ds-foundation-toegang'); if (!e) return null;
        const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; })(),
      kapotteBeelden: [...document.querySelectorAll('img')].filter(i => i.complete && i.getClientRects().length && !i.naturalWidth).length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
  const s = row.state; row.failures = [];
  if (row.http !== 200) row.failures.push('http-' + row.http);
  if (!s.systeem) row.failures.push('design-system-not-loaded');
  if (!s.edges && !s.toegang) row.failures.push('missing-ds-edge');
  if (s.toegang && (!s.toegangRect || s.toegangRect.w < 280 || s.toegangRect.h < 180 ||
    s.toegangRect.x < 0 || s.toegangRect.right > await page.evaluate(() => innerWidth) + 1)) row.failures.push('invalid-foundation-access-gate');
  if (s.oudeEdges) row.failures.push('legacy-shell-on-ds-screen');
  if (s.kapotteBeelden) row.failures.push('broken-image');
  if (s.overflow) row.failures.push('horizontal-overflow');
  if (errors.length) row.failures.push('page-error');
};

/* Read the real public composition, not offscreen lazy magazine leaves. The
   full-edition/browser proofs visit those leaves separately. A hidden image
   must not force the audit to scroll and thereby change the state it measures. */
function publiekeStaat() {
  const { innerWidth, innerHeight } = window;
  const root = document.querySelector('.ds-public-edge'), host = root?.querySelector('.rtg-adaptive-edge');
  const door = root?.querySelector('.ds-public-edge-toggle'), bar = root?.querySelector('.rtg-adaptive-bar');
  const shown = e => {
    if (!e || !e.getClientRects().length) return false;
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0 &&
      r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  };
  const hit = e => {
    if (!shown(e) || e.disabled || e.getAttribute('aria-disabled') === 'true') return false;
    const r = e.getBoundingClientRect();
    return r.width >= 43.9 && r.height >= 43.9 && r.left >= -.5 && r.right <= innerWidth + .5 &&
      r.top >= -.5 && r.bottom <= innerHeight + .5 && e.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2));
  };
  const transparent = e => {
    if (!e) return false;
    const s = getComputedStyle(e), canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const c = canvas.getContext('2d'); c.fillStyle = s.backgroundColor; c.fillRect(0, 0, 1, 1);
    return c.getImageData(0, 0, 1, 1).data[3] === 0 && s.backgroundImage === 'none' && s.boxShadow === 'none' &&
      [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].every(v => parseFloat(v) === 0);
  };
  const images = [...document.querySelectorAll('img')].filter(shown);
  const buttons = [...(bar?.querySelectorAll('.rtg-adaptive-item') || [])];
  return {
    world: document.body.dataset.rtgWorld, publicNative: true,
    systeem: getComputedStyle(document.documentElement).getPropertyValue('--ds-schermhoogte').trim(),
    owners: document.querySelectorAll('.ds-public-edge').length,
    hosts: document.querySelectorAll('.rtg-adaptive-edge').length,
    bars: document.querySelectorAll('.rtg-adaptive-bar').length,
    doors: document.querySelectorAll('.ds-public-edge-toggle').length,
    native: typeof window.RTGAdaptiveEdge?.setState === 'function',
    legacy: [...document.querySelectorAll('.ds-edge__balk,.rtg-edge-chrome,.wd-shell')]
      .filter(e => !e.closest('.ds-public-edge') && shown(e)).length,
    state: host?.dataset.rtgAdaptiveState, expanded: door?.getAttribute('aria-expanded'),
    controlled: !!bar?.id && door?.getAttribute('aria-controls') === bar.id,
    named: !!door?.getAttribute('aria-label'), reachable: hit(door),
    transparent: [root, host, door].every(transparent), barVisible: shown(bar),
    actions: buttons.map(e => ({ action:e.dataset.rtgAdaptiveAction, named:!!e.getAttribute('aria-label'), reachable:hit(e) })),
    pendingImages: images.filter(i => !i.complete).length,
    brokenImages: images.filter(i => i.complete && !i.naturalWidth).length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1
  };
}

async function publiekeEdge(page, row, errors) {
  await page.waitForFunction(() => document.body.dataset.rtgAdaptiveReady === 'true' &&
    document.body.classList.contains('ds-public-edge-page') && !!document.querySelector('.ds-public-edge-toggle'), null, { timeout:12000 });
  await page.evaluate(() => document.fonts.ready);
  // Evaluate the same visible-image predicate for readiness and broken images.
  const state = async () => page.evaluate(publiekeStaat);
  const until = Date.now() + 12000;
  let closed = await state();
  while (closed.pendingImages && Date.now() < until) {
    await page.waitForTimeout(50); closed = await state();
  }
  row.state = closed; row.failures = [];
  if (row.http !== 200 && !(row.route === '/site/404.html' && row.http === 404)) row.failures.push('http-' + row.http);
  if (!closed.systeem) row.failures.push('design-system-not-loaded');
  if (!closed.native || closed.owners !== 1 || closed.hosts !== 1 || closed.bars !== 1 || closed.doors !== 1 || closed.legacy)
    row.failures.push('duplicate-or-missing-public-edge-owner');
  if (closed.state !== 'dock' || closed.expanded !== 'false' || closed.barVisible) row.failures.push('public-edge-not-closed');
  if (!closed.controlled || !closed.named || !closed.reachable) row.failures.push('public-edge-door-unreachable');
  if (!closed.transparent) row.failures.push('public-edge-not-transparent');
  if (closed.pendingImages || closed.brokenImages) row.failures.push('broken-image');
  if (closed.overflow) row.failures.push('horizontal-overflow');
  if (errors.length) row.failures.push('page-error');
  if (row.failures.length) return;
  const door = page.locator('.ds-public-edge-toggle');
  const original = await page.evaluateHandle(() => ({ bar:document.querySelector('.ds-public-edge .rtg-adaptive-bar'),
    buttons:[...document.querySelectorAll('.ds-public-edge .rtg-adaptive-item')] }));
  try {
    await door.click();
    await page.waitForFunction(() => document.querySelector('.ds-public-edge .rtg-adaptive-edge')?.dataset.rtgAdaptiveState === 'deck', null, { timeout:3000 });
    const opened = await state(); row.publicOpen = opened;
    if (!opened.barVisible || opened.expanded !== 'true' || opened.actions.length !== 5 ||
      !opened.actions.some(a => a.action === 'ai') || opened.actions.some(a => !a.named || !a.reachable))
      row.failures.push('public-edge-actions-unreachable');
    if (opened.overflow) row.failures.push('horizontal-overflow');
    await door.click();
    await page.waitForFunction(() => document.querySelector('.ds-public-edge .rtg-adaptive-edge')?.dataset.rtgAdaptiveState === 'dock', null, { timeout:3000 });
    const same = await page.evaluate(previous => previous.bar === document.querySelector('.ds-public-edge .rtg-adaptive-bar') &&
      previous.buttons.every((button, i) => button === document.querySelectorAll('.ds-public-edge .rtg-adaptive-item')[i]), original);
    const restored = await state(); row.publicRestored = restored;
    if (!same) row.failures.push('public-edge-owner-replaced');
    if (restored.expanded !== 'false' || restored.barVisible || !restored.transparent || !restored.reachable)
      row.failures.push('public-edge-close-not-restored');
    if (errors.length) row.failures.push('page-error');
  } finally { await original.dispose(); }
}
