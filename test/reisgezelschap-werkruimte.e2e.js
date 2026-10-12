/* ============================================================================
   DE GEZAMENLIJKE REIS IN EEN ECHTE BROWSER -- vijf accounts, vijf werkruimten.

   Stap 3 van "Five People. Five Private Contexts. One Shared Outcome". Vijf
   deelnemers openen elk in een EIGEN browsercontext (eigen sessie, eigen
   opslag) hetzelfde reisscherm, blad Samen. Wat hier wordt bewezen:
   - de werkruimte verschijnt in het bestaande blad, zonder nieuwe ingang;
   - de reiziger ziet voortgang en de optievorm, een reisgenoot niet;
   - iedereen ziet dezelfde groepsuitkomst (dezelfde vingerafdruk), zijn eigen
     plafond in zijn eigen vorm, en nergens het plafond van een ander;
   - wie zijn wensen via het scherm verandert, ziet de groep het binnen een
     ronde terug -- de reactietijd wordt gemeten en gemeld;
   - een reisgenoot die de verborgen optievorm zelf zichtbaar maakt en verstuurt,
     verandert niets (de server weigert);
   - een scherm dat de server niet bereikt, zegt dat het beeld verouderd is;
   - de Edge krijgt de voortgang als Trust Rail.
   Overgeslagen zonder browser. Draai: node --test test/reisgezelschap-werkruimte.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reiswerk-e2e-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, REIS;
let A, B, C, D, G, E, F;
const opties = {};

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(r.status, 200, naam + ': ' + JSON.stringify(r.body));
  const lid = { naam, token: r.body.token, codenaam: r.body.state.user.codename };
  await api('/api/reis/gezelschap/kring', {}, lid.token);
  return lid;
}
async function doeMee(lid, rol) {
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: lid.codenaam, rol }, A.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: true }, lid.token)).status, 200);
  return uit.body.lid.id;
}
const beeld = async (wie) => {
  const r = await api('/api/reis/gezelschap/opties', { reis: REIS }, wie.token);
  assert.equal(r.status, 200, wie.naam + ': ' + JSON.stringify(r.body));
  return r.body;
};
const gedeeld = (b) => JSON.stringify(Object.assign({}, b.groep, { voortgang: undefined }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  A = await nieuwLid('Anna'); B = await nieuwLid('Bram'); C = await nieuwLid('Cees');
  D = await nieuwLid('Dirk'); G = await nieuwLid('Gijs'); E = await nieuwLid('Eva'); F = await nieuwLid('Frits');
  assert.equal(new Set([A, B, C, D, G, E, F].map(x => x.codenaam)).size, 7, 'twee leden delen een codenaam');
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }
  ] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code: zet.body.link.split('code=')[1] }, A.token)).status, 200);
  REIS = (await api('/api/reis/reizen', {}, A.token)).body.reizen[0].id;
  for (const x of [B, C, D, G]) x.uitnodiging = await doeMee(x, 'reisgenoot');
  E.uitnodiging = await doeMee(E, 'meekijker');
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });



/* Een plafond in elke vorm waarin het op een scherm kan staan: centen, hele euro's en euro's met een punt. */
const vormen = (c) => [String(c), String(c / 100), (c / 100).toLocaleString('de-DE')];
const PLAFOND = { Anna: 150000, Bram: 120000, Cees: 200000, Dirk: 175000, Gijs: 180000 };

test('vijf deelnemers, vijf werkruimten, een groepsuitkomst', { skip: geenBrowser(pw) }, async () => {
  const leden = { Anna: A, Bram: B, Cees: C, Dirk: D, Gijs: G };
  for (const [naam, wie] of Object.entries(leden)) {
    if (naam === 'Bram') continue;        // Bram vult zijn wensen in via het scherm
    const o = { plafond: PLAFOND[naam], data: [{ van: dag(55), tot: dag(70) }] };
    assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: o }, wie.token)).status, 200, naam);
  }
  const z = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Villa aan zee', prijsPP: 110000, van: dag(60), tot: dag(64), kenmerken: ['strand'] } }, A.token);
  assert.equal(z.status, 200);

  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  try {
    const pagina = {};
    for (const [naam, wie] of Object.entries(leden)) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage(); letOpFouten(page, fouten);
      await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, wie.token);
      await page.goto(base + '/apps/reizen.html#samen', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#samenBesluit[data-kenmerk]', { state: 'attached', timeout: 30000 });
      pagina[naam] = page;
    }

    // Bram vult zijn wensen in via het scherm
    const bram = pagina.Bram;
    await bram.fill('#opgavePlafond', String(PLAFOND.Bram / 100));
    await bram.fill('#opgaveVan', dag(55)); await bram.fill('#opgaveTot', dag(70));
    await bram.click('#besluitOpgaveVorm button[type="submit"]');
    await bram.waitForFunction(() => /berekend om/.test(document.querySelector('#besluitStand').textContent), null, { timeout: 15000 });

    // iedereen ververst; daarna moet de vingerafdruk overal gelijk zijn
    for (const p of Object.values(pagina)) await p.evaluate(() => window.RTGSamenBesluit.ververs());
    const beeld = {};
    for (const [naam, p] of Object.entries(pagina)) {
      beeld[naam] = await p.evaluate(() => {
        const vak = document.querySelector('#samenBesluit');
        const zicht = (s) => { const el = document.querySelector(s); return !!el && !el.hidden; };
        return { rol: vak.dataset.rol, kenmerk: vak.dataset.kenmerk, tekst: vak.innerText,
          voortgang: zicht('[data-blok="groepsvoortgang"]'), optievorm: zicht('[data-blok="optieZetten"]'),
          plafond: document.querySelector('#opgavePlafond').value,
          rail: (window.RTGAdaptief && window.RTGAdaptief.context().rail || []).map(x => x.sleutel) };
      });
    }
    assert.equal(beeld.Anna.rol, 'eigenaar');
    assert.equal(beeld.Anna.voortgang, true); assert.equal(beeld.Anna.optievorm, true);
    assert.match(beeld.Anna.tekst, /5 van 5 deelnemers/);
    for (const naam of ['Bram', 'Cees', 'Dirk', 'Gijs']) {
      assert.equal(beeld[naam].rol, 'reisgenoot', naam);
      assert.equal(beeld[naam].voortgang, false, naam + ' ziet de voortgang van de reiziger');
      assert.equal(beeld[naam].optievorm, false, naam + ' ziet de optievorm');
    }
    for (const [naam, b] of Object.entries(beeld)) {
      assert.equal(b.kenmerk, beeld.Anna.kenmerk, naam + ' ziet een ander groepsbeeld');
      assert.equal(Number(b.plafond) * 100, PLAFOND[naam], naam + ' ziet zijn eigen plafond niet terug');
      assert.ok(b.rail.includes('groep') && b.rail.includes('jij'), naam + ': de Edge kreeg de voortgang niet');
      for (const [ander, bedrag] of Object.entries(PLAFOND)) {
        if (ander === naam) continue;
        for (const v of vormen(bedrag)) assert.ok(!b.tekst.includes(v), naam + ' ziet het plafond van ' + ander + ' (' + v + ')');
        assert.ok(!b.tekst.includes(leden[ander].codenaam), naam + ' ziet de codenaam van ' + ander);
      }
    }
    assert.match(beeld.Anna.tekst, /1 van de 1 opties past voor iedereen: Villa aan zee/);

    // Bram verschuift zijn data: de villa past dan niet meer, en Anna ziet dat binnen een ronde
    const voor = beeld.Anna.kenmerk;
    await bram.fill('#opgaveVan', dag(80)); await bram.fill('#opgaveTot', dag(85));
    const t0 = Date.now();
    await bram.click('#besluitOpgaveVorm button[type="submit"]');
    await pagina.Anna.waitForFunction((k) => document.querySelector('#samenBesluit').dataset.kenmerk !== k, voor, { timeout: 15000 });
    const reactie = Date.now() - t0;
    const anna = await pagina.Anna.evaluate(() => document.querySelector('#samenBesluit').innerText);
    assert.match(anna, /Er is nog geen optie die voor iedereen past\. U kunt de reisdata of het voorstel aanpassen\./);
    assert.ok(!/Bram|buiten de periodes/.test(anna), 'Anna hoort waarom het voor een ander niet past');
    const bramTekst = await bram.evaluate(() => document.querySelector('#samenBesluit').innerText);
    assert.match(bramTekst, /De data vallen buiten de periodes die u opgaf/, 'Bram hoort zijn eigen reden');
    console.log('# reactietijd wijziging -> andere werkruimte: ' + reactie + ' ms (ronde is 6000 ms)');
    assert.ok(reactie < 12000, 'de groep zag de wijziging pas na ' + reactie + ' ms');

    // een reisgenoot maakt de verborgen optievorm zichtbaar en verstuurt hem: de server weigert
    /* Eerst verversen en dan pas de vingerafdruk lezen: anders vergelijkt de
       toets met een beeld van voor de laatste wijziging van Bram, en zakt hij op
       de VERSING in plaats van op de manipulatie (of, met een verversing die
       werd overgeslagen, staat hij om de verkeerde reden groen). */
    const cees = pagina.Cees;
    await cees.evaluate(() => window.RTGSamenBesluit.ververs());
    const kCees = await cees.evaluate(() => document.querySelector('#samenBesluit').dataset.kenmerk);
    const geweigerd = cees.waitForResponse(r => /\/api\/reis\/gezelschap\/opties\/zet$/.test(r.url()));
    await cees.evaluate(() => {
      const f = document.querySelector('#besluitOptieVorm'); f.hidden = false;
      f.querySelector('#optieTitel').value = 'Ingebroken'; f.querySelector('#optiePrijs').value = '10';
      f.querySelector('#optieVan').value = '2030-01-01'; f.querySelector('#optieTot').value = '2030-01-02';
      f.requestSubmit();
    });
    assert.equal((await geweigerd).status(), 404, 'de server weigert een optie van een reisgenoot');
    await cees.evaluate(() => window.RTGSamenBesluit.ververs());
    assert.equal(await cees.evaluate(() => document.querySelector('#samenBesluit').dataset.kenmerk), kCees, 'er veranderde iets');
    assert.ok(!(await cees.evaluate(() => document.body.innerText)).includes('Ingebroken'));

    // de server is onbereikbaar: het scherm zegt dat het beeld verouderd is
    const dirk = pagina.Dirk;
    await dirk.route('**/api/reis/gezelschap/opties', r => r.abort());
    await dirk.evaluate(() => window.RTGSamenBesluit.ververs());
    assert.match(await dirk.evaluate(() => document.querySelector('#besluitStand').textContent), /Niet bijgewerkt sinds .* verouderd/);
  } finally {
    await browser.close().catch(() => {});
  }
  const echt = fouten.filter(f => !/404|Failed to load resource|net::ERR_FAILED/.test(String(f)));
  assert.deepEqual(echt, [], 'fouten in de browser: ' + echt.join(' | '));
});
