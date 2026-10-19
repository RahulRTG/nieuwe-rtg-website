/* Een scherm op het RTG Design System (ONTWERPSYSTEEM.md) heeft een andere
   schil dan de oude: geen .rtg-adaptive-bar, geen editorial-v4, geen
   wd-shell, maar /ds/rtg-ds.css en de Edge uit /ds/edge.js. De algemene
   schermronde meet hier dus DIE schil en niet de afwezigheid van de oude:
   de Edge staat (met Rahul), er is geen tweede, oude Edge, het systeem is
   geladen, niets loopt horizontaal over, beelden laden echt, en er is geen
   paginafout. De voorbeeldpagina (/ds/voorbeeld.html) tekent zijn Edges zelf
   in telefoonkaders; daar telt het kader. Wat een ds-scherm verder belooft,
   bewijst zijn eigen browsertoets (public/ds/contract.json "bewijs"). */
'use strict';
module.exports = async function dsScherm(page, row, errors) {
  const voorbeeld = await page.evaluate(() => location.pathname.startsWith('/ds/'));
  await page.waitForSelector(voorbeeld ? '.ds-toestel .ds-edge__balk' : '.ds-edge__balk [data-ds-edge="rahul"]', { timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('img')].filter(i => i.loading !== 'lazy' || i.getClientRects().length)
    .every(i => i.complete), null, { timeout: 12000 });
  row.state = await page.evaluate(() => {
    const zichtbaar = s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length;
    return {
      world: document.body.dataset.rtgWorld,
      systeem: getComputedStyle(document.documentElement).getPropertyValue('--ds-schermhoogte').trim(),
      edges: zichtbaar('.ds-edge__balk'), oudeEdges: zichtbaar('.rtg-adaptive-bar,.wd-shell'),
      kapotteBeelden: [...document.querySelectorAll('img')].filter(i => i.complete && i.getClientRects().length && !i.naturalWidth).length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
  const s = row.state; row.failures = [];
  if (row.http !== 200) row.failures.push('http-' + row.http);
  if (!s.systeem) row.failures.push('design-system-not-loaded');
  if (!s.edges) row.failures.push('missing-ds-edge');
  if (s.oudeEdges) row.failures.push('legacy-shell-on-ds-screen');
  if (s.kapotteBeelden) row.failures.push('broken-image');
  if (s.overflow) row.failures.push('horizontal-overflow');
  if (errors.length) row.failures.push('page-error');
};
