/* Browserkanaal van dezelfde voltooiproef. Alleen waargenomen navigatie en
   zichtbare toestanden worden vastgelegd; ontbrekende browser is een fout. */
'use strict';
const assert = require('node:assert/strict');
const { laadScherm, browserOpties, letOpFouten } = require('../../test/helper');

async function metScherm(w, sc, fn, opties = {}) {
  const pw = laadScherm();
  assert.ok(pw?.chromium, 'verplichte browser ontbreekt');
  const browser = await pw.chromium.launch(browserOpties(pw, { args: opties.args || [] }));
  const verslag = w.browser || { ingang: null, bezocht: [], toestanden: [], fouten: [], documentfouten: [] };
  w.browser = verslag;
  try {
    const omgeving = { engine: 'chromium', versie: browser.version(), node: process.version,
      platform: process.platform, architectuur: process.arch };
    if (verslag.omgeving) assert.deepEqual(verslag.omgeving, omgeving, 'de browseromgeving wisselde tijdens één scenario');
    else verslag.omgeving = omgeving;
    const nieuwToestel = async contextOpties => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...contextOpties });
      const p = await ctx.newPage();
      letOpFouten(p, verslag.fouten);
      p.on('pageerror', e => {
        if (!verslag.foutdetails) verslag.foutdetails = [];
        verslag.foutdetails.push(String(e.stack || e.message));
      });
      p.on('framenavigated', frame => {
        if (frame !== p.mainFrame()) return;
        const u = new URL(frame.url());
        if (u.origin === new URL(w.basis).origin) {
          const pad = u.pathname + u.search;
          if (!verslag.bezocht.includes(pad)) verslag.bezocht.push(pad);
        }
      });
      p.on('response', r => {
        if (r.request().resourceType() === 'document' && r.status() !== 200)
          verslag.documentfouten.push({ pad: new URL(r.url()).pathname, status: r.status() });
      });
      const observeer = async selector => {
        await p.locator(selector).waitFor({ state: 'visible' });
        const u = new URL(p.url());
        assert.equal(u.origin, new URL(w.basis).origin, 'geen bewijs buiten de eigen testserver');
        const pad = u.pathname + u.search;
        if (pad === sc.ingang) verslag.ingang = pad;
        verslag.toestanden.push({ pad, selector, zichtbaar: true });
      };
      return { ctx, p, observeer };
    };
    const eerste = await nieuwToestel(opties.context);
    await fn({ browser, ...eerste, nieuwToestel, verslag });
  } finally { await browser.close(); }
}

/* Assertions blijven echte uitgevoerde checks. De runner vangt een uitzondering
   als stuk; deze helper vult geen ontbrekende schakels of resultaten in. */
async function toets(stap, bewijs, wat, fn) {
  let fout;
  await stap(bewijs, wat, async () => {
    try {
      const ziet = await fn();
      return { klopt: true, ziet: ziet ?? wat };
    } catch (e) { fout = e; throw e; }
  });
  // De runner heeft de mislukte schakel vastgelegd. Een volgende browserstap
  // op een ongeldige paginatoestand meet dezelfde oorzaak alleen nogmaals.
  // Afbreken laat ALLE bewijsdimensies van dit scenario niet-groen worden.
  if (fout) throw fout;
}
module.exports = { metScherm, toets };
