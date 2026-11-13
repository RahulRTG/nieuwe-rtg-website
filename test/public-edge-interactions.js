'use strict';
// Shared user-level traversal for the painted public Edge. Never invokes a
// product controller to bypass a closed doorway, off-page action or hit target.
const assert = require('node:assert/strict');
const sheetSelector = '.ds-public-edge .rtg-adaptive-sheet';
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function hit(control) {
  return control.evaluate(node => {
    const b = node.getBoundingClientRect(), target = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return b.width >= 43.9 && b.height >= 43.9 && b.left >= -.5 && b.right <= innerWidth + .5 && b.top >= -.5 && b.bottom <= innerHeight + .5 && node.contains(target);
  });
}
async function action(page, name, pointer = false, destination) {
  // Opening during an actual folio scroll correctly closes the quiet Edge.
  // Wait for its original reading owner, not a synthetic controller state.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const tracks = [...document.querySelectorAll('#issueTrack,[data-reel-track]')].filter(el => el.getClientRects().length);
    const start = performance.now(); let stable = start, last = '';
    function sample(now) {
      const value = JSON.stringify([scrollX, scrollY, ...tracks.map(el => [el.scrollLeft, el.scrollTop])]);
      if (last !== value) { last = value; stable = now; }
      if (now - stable >= 220) return resolve();
      if (now - start > 4000) return reject(new Error('De oorspronkelijke leesbladen blijven bewegen'));
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  const bar = page.locator('.ds-public-edge .rtg-adaptive-bar');
  if (!await bar.isVisible()) {
    const door = page.locator('.ds-public-edge-toggle');
    assert.equal(await hit(door), true, 'de transparante lippeningang is bereikbaar');
    if (pointer) await door.click();
    else { await door.focus(); await page.keyboard.press('Enter'); }
    await bar.waitFor({ state: 'visible' }); await settle(page);
  }
  const button = bar.locator('[data-rtg-adaptive-action="' + name + '"]');
  assert.equal(await hit(button), true, name + ': de originele Edge-actie is bereikbaar');
  if (!pointer) await button.focus();
  const activate = () => pointer ? button.click() : page.keyboard.press('Enter');
  if (destination) await Promise.all([page.waitForURL(destination), activate()]);
  else await activate();
  await settle(page);
}
async function menu(page, pointer = false) {
  await action(page, 'menu', pointer);
  await page.locator('#explorePanel').waitFor({ state: 'visible' });
  return page.locator(sheetSelector);
}
async function mode(page, name) {
  const sheet = page.locator(sheetSelector), button = sheet.locator('[data-rtg-adaptive-mode="' + name + '"]');
  await button.focus(); await settle(page);
  assert.equal(await hit(button), true, name + ': de oorspronkelijke modetab is bereikbaar');
  await page.keyboard.press('Enter'); await settle(page);
  if (name === 'rahul') {
    await page.locator('#magazineDetailContent > #rahul').waitFor({ state: 'visible' });
    await sheet.waitFor({ state: 'hidden' });
  } else {
    const desktop = await page.evaluate(() => matchMedia('(min-width: 1100px)').matches);
    await sheet.locator(desktop ? '.ds-edge-reading-art[data-editorial-ready]' : '.ds-edge-gallery[data-mode="' + name + '"] img').waitFor({ state: 'visible' });
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await sheet.locator('[data-rtg-adaptive-mode][aria-pressed="true"]').count(), 1);
  }
  return sheet;
}
async function seek(page, control) {
  // Focusing an ORIGINAL action is also the supported keyboard route to its
  // physical leaf; assert the complete hit box after the native focus event.
  await control.focus(); await settle(page);
  assert.equal(await hit(control), true, 'originele bediening bereikbaar: ' + (await control.textContent()).trim());
  const within = await control.evaluate(node => {
    const view = node.closest('.ds-edge-pages'); if (!view) return true;
    const b = node.getBoundingClientRect(), v = view.getBoundingClientRect();
    return b.left >= v.left - 1 && b.right <= v.right + 1 && b.top >= v.top - 1 && b.bottom <= v.bottom + 1;
  });
  assert.equal(within, true, 'de volledige bediening past op het horizontale blad');
}
async function focusVisible(page) {
  assert.equal(await page.evaluate(() => document.activeElement !== document.body && !!document.activeElement.getClientRects().length), true, 'Focus blijft op bereikbare bediening, niet in gesloten inhoud');
}
module.exports = { sheetSelector, settle, hit, action, menu, mode, seek, focusVisible };
