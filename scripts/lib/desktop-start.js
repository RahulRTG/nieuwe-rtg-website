/* De openbare RTG-start is een filmische verkenning en geen app-werkruimte.
   Zij bezit haar eigen kop, scènes en beeldlaag; de algemene desktopmeter mag
   daarom geen wd-shell of ingelogde app-Edge verzinnen. */
'use strict';
module.exports = async function startpagina(page, row, errors) {
  await page.waitForSelector('.experience-header', { state: 'visible', timeout: 12000 });
  await page.waitForSelector('main#inhoud .experience-arrival', { state: 'visible', timeout: 12000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.hero-media img[src]')]
    .some(img => img.complete && img.naturalWidth > 0), null, { timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  row.state = await page.evaluate(() => {
    const rect = selector => { const e = document.querySelector(selector); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; };
    const zichtbaar = selector => [...document.querySelectorAll(selector)].filter(e =>
      e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length;
    return {
      header: rect('.experience-header'), inhoud: rect('main#inhoud'), opening: rect('.experience-arrival'),
      heading: zichtbaar('#hoofdtitel'), bediening: zichtbaar('.command-open,.opening-actions a,.opening-actions button'),
      edge: zichtbaar('.rtg-adaptive-bar'), kapotteBeelden: [...document.querySelectorAll('.hero-media img[src]')]
        .filter(img => img.complete && !img.naturalWidth).length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, viewport: innerWidth
    };
  });
  const s = row.state;
  row.failures = [];
  if (row.http !== 200) row.failures.push('http-' + row.http);
  if (!s.header || !s.inhoud || !s.opening || !s.heading || s.bediening < 2) row.failures.push('missing-public-experience');
  if (s.opening && (s.opening.x < -1 || s.opening.right > s.viewport + 1 || s.opening.h < 500)) row.failures.push('invalid-public-experience-geometry');
  if (s.kapotteBeelden) row.failures.push('broken-image');
  if (s.overflow) row.failures.push('horizontal-overflow');
  if (errors.length) row.failures.push('page-error');
};
