'use strict';
const assert = require('node:assert/strict');

async function gereed(page) {
  await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready' &&
    document.body.classList.contains('ds-wereldwerkruimte') && !!window.RTGDesktopHome?.current?.cards && !!window.RTGVol);
}

async function instellingen(page, viaRand = false) {
  if (viaRand) {
    await page.locator('.rnd-toets').focus(); await page.keyboard.press('Enter');
  } else {
    await page.locator('#osMenuBtn').click();
    await page.locator('.amn-blad').getByRole('button', { name: 'Instellingen', exact: true }).click();
  }
  const dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true }); await dialog.waitFor();
  assert.equal(await dialog.evaluate(el => el instanceof HTMLDialogElement && el.matches(':modal')), true);
  return dialog;
}

async function sluit(page, dialog, terug) {
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(sel => document.activeElement === document.querySelector(sel), terug);
}

async function wissel(page, aan, viaRand = false) {
  const dialog = await instellingen(page, viaRand), knop = dialog.getByRole('button', { name: 'Rand tot rand', exact: true });
  assert.equal(await knop.getAttribute('aria-pressed'), String(!aan));
  await knop.click(); assert.equal(await knop.getAttribute('aria-pressed'), String(aan));
  assert.deepEqual(await page.evaluate(() => ({ voorkeur: localStorage.getItem('rtg_volscherm'),
    vlag: document.documentElement.classList.contains('ds-volscherm'), native: !!document.fullscreenElement })),
  { voorkeur: aan ? '1' : '0', vlag: aan, native: false });
  await sluit(page, dialog, viaRand ? '.rnd-toets' : '#osMenuBtn');
}

async function volleWerkruimte(page, actief = '.wd-home') {
  const maten = await page.evaluate(sel => {
    const r = s => document.querySelector(s).getBoundingClientRect().toJSON();
    return { shell: r('.wd-shell'), actief: r(sel), panelen: ['.wd-people', '.wd-favorites', '.wd-library'].map(r) };
  }, actief);
  assert.ok(maten.actief.width >= maten.shell.width - 2 && Math.abs(maten.actief.left - maten.shell.left) <= 1,
    'het werkvlak vult de werkruimte: ' + JSON.stringify(maten));
  for (const [i, sel] of ['.wd-people', '.wd-favorites', '.wd-library'].entries()) {
    assert.ok(maten.panelen[i].height > 0 && maten.panelen[i].top >= maten.actief.bottom - 1,
      sel + ' blijft onder het werkvlak staan');
    const kop = page.locator(sel).locator('h2,h3').first(); await kop.scrollIntoViewIfNeeded();
    assert.equal(await kop.evaluate(el => {
      const r = el.getBoundingClientRect(), geraakt = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return geraakt === el || el.contains(geraakt);
    }), true, sel + ' blijft scrollbereikbaar');
  }
}

async function mobiel(page, width) {
  await page.setViewportSize({ width, height: 844 });
  const dialog = await instellingen(page, true);
  assert.equal(await dialog.getByRole('button', { name: 'Rand tot rand', exact: true }).count(), 0);
  await sluit(page, dialog, '.rnd-toets');
  assert.equal(await page.evaluate(() => RTGVol.mogelijk()), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('rtg_volscherm')), '1', 'mobiel wist de desktopkeuze niet');
  assert.equal(await page.locator('.wd-shell').evaluate(el => getComputedStyle(el).display), 'contents');
  for (const sel of ['.wd-people', '.wd-favorites', '.wd-library']) assert.equal(await page.locator(sel).isVisible(), false);
  const rand = await page.locator('.ds-edge__balk').boundingBox();
  assert.ok(rand && rand.width > 0 && rand.x >= 0 && rand.x + rand.width <= width + 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
}

module.exports = { gereed, instellingen, sluit, wissel, volleWerkruimte, mobiel };
