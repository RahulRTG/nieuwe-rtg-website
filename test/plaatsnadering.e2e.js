/* ============================================================================
   DE AANKOMSTPULS ZONDER HANDWERK (PLAATS.md fase 4).

   Invisible Arrival had deze functie al, en goed: een tijdelijke pass met drie
   knoppen waarmee een gast vrijwillig deelt dat hij onderweg, in de buurt of
   gearriveerd is, zodat de zaak de tafel kan klaarzetten. Met eronder de
   belofte, letterlijk op het scherm: *een status delen is vrijwillig, bevat geen
   GPS en vervalt automatisch na uw bezoek.*

   Fase 4 zet daar geen tweede functie naast. Hij haalt het handwerk eruit: als
   de gast dat wil, meldt zijn toestel zelf dat hij in de buurt is -- dezelfde
   puls, hetzelfde gevolg. Deze toets bewaakt de drie dingen die daarbij waar
   moeten blijven:

     1. het gaat pas na een JA, en de handknoppen blijven werken;
     2. de puls komt echt aan, en de zaak zet zijn voorbereiding in gang;
     3. DE BELOFTE BLIJFT LETTERLIJK WAAR -- er gaat geen coördinaat naar de
        pass, niet naar de plaatslaag, en niet naar de zaak.

   Dat derde was tot nu toe een zin op een scherm. Hier wordt het een meting op
   de netwerklaag: elk verzoek dat de pagina doet, wordt meegelezen.

   EN DE TWEE WERELDEN BLIJVEN GESCHEIDEN. Een Arrival Pass is anoniem (een
   accessToken, geen account); de plaatslaag werkt op codenamen. Op de server
   worden die twee nergens aan elkaar geknoopt -- de enige plek waar ze
   samenkomen is de browser van de mens over wie het gaat.

   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { browserOpties, geenBrowser, letOpFouten, startServer, stop, wachtOpNetstilte, wachtOpRust } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const ZAAK = 'KIKUNOI';

const GPS = (lat, lng) => `(function () {
  const p = { coords: { latitude: ${lat}, longitude: ${lng}, accuracy: 10 } };
  const g = {
    getCurrentPosition: function (ok) { ok(p); },
    watchPosition: function (ok) { setTimeout(function () { ok(p); }, 30); return 1; },
    clearWatch: function () {}
  };
  Object.defineProperty(navigator, 'geolocation', { get: function () { return g; } });
  try { localStorage.setItem('rtg_os_gps', '1'); } catch (e) {}
})();`;

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}
function morgen() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }

test('plaats: het toestel meldt de aankomst zelf, en de pass blijft zonder GPS',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nader-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // een lid (voor de plaatslaag) en een Arrival Pass (anoniem, los daarvan)
    const u = String(process.pid) + String(Date.now()).slice(-6);
    const reg = await api(base, '/api/auth/register', { name: 'Naderend Lid', email: 'nl' + u + '@voorbeeld.test',
      password: 'nadergeheim123', geboortedatum: '1990-04-04', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    /* De aanvraagcode heeft de vorm <id>.<geheim>, allebei 20-80 tekens uit
       [A-Za-z0-9_-] (zie routes/supplier/horeca/arrival-toegang.js). De client
       maakt er twee uuid's van; hier doen we hetzelfde met de hand. */
    const deel = (p) => (p + 'abcdefghijklmnopqrstuvwxyz').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    const vraag = await api(base, '/api/arrival/request', {
      requestToken: deel('id' + u) + '.' + deel('geheim' + u), supplierCode: ZAAK,
      datum: morgen(), tijd: '20:00', personen: 2, naam: 'Gast', zone: 'zaal' });
    assert.ok(vraag.pass && vraag.pass.accessToken, 'de Arrival Pass staat er: ' + JSON.stringify(vraag).slice(0, 200));
    const pasToken = vraag.pass.accessToken;
    assert.equal(vraag.pass.pulse, 'nog-niet-onderweg', 'en er is nog niets gedeeld');

    // waar ligt de zaak? dat is het naderingshek
    const h = await api(base, '/api/plaats/hekken', { doel: 'nadering' }, reg.token);
    const hek = (h.hekken || []).find(x => x.id === 'leverancier:' + ZAAK);
    assert.ok(hek, 'de zaak staat als naderingshek in de lijst');
    assert.equal(h.straalM, 900, 'nadering is ruim: een bericht dat komt als je al binnen staat, helpt niemand');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(GPS(hek.punten[0].lat, hek.punten[0].lng));
    await ctx.addInitScript((d) => {
      try {
        localStorage.setItem('rtg_member_token', d.lid);
        localStorage.setItem('rtg_arrival_pass', d.pas);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, { lid: reg.token, pas: pasToken });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const verstuurd = [];
    page.on('request', (r) => {
      if (/\/api\/(plaats|arrival)\//.test(r.url())) verstuurd.push({ url: r.url(), body: r.postData() || '' });
    });

    await page.goto(base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });

    /* 1. HET AANBOD KOMT, EN VOOR DE TIK GEBEURT ER NIETS. De handknoppen staan
       er gewoon nog: wie nee zegt, houdt de pagina die hij had. */
    await page.waitForSelector('.rtgnader', { timeout: 20000 });
    const tekst = await page.locator('.rtgnader p').textContent();
    assert.match(tekst, /in de buurt/, 'het aanbod zegt waar het over gaat: ' + tekst);
    assert.match(tekst, /niet waar je bent/, 'en wat de zaak NIET ziet, vóórdat iemand ja zegt');
    assert.ok(await page.locator('[data-pulse="in-de-buurt"]').count(),
      'de handknop blijft bestaan; dit vervangt hem niet, het scheelt alleen het handwerk');

    await wachtOpRust(page);
    assert.equal(verstuurd.filter(r => /\/pulse|\/waarneem/.test(r.url)).length, 0,
      'voor de tik is er niets gedeeld en niets waargenomen');

    // 2. NA DE TIK: het toestel rekent, en de puls komt aan
    await page.click('.rtgnader .ja');
    /* Wachten doen we van BUITEN de pagina, op de server. Een async predicaat in
       waitForFunction is een valkuil: de belofte die eruit komt is zelf al
       waarheidsgetrouw, dus zo'n wachtlus is meteen klaar en meet niets. */
    let pas = null;
    for (let i = 0; i < 60; i++) {
      pas = await api(base, '/api/arrival/pass', { pass: pasToken });
      if (pas && pas.pass && pas.pass.pulse === 'in-de-buurt') break;
      await new Promise(r => setTimeout(r, 400));
    }
    assert.equal(pas.pass.pulse, 'in-de-buurt', 'de zaak weet dat de gast eraan komt');

    /* En de zaak zet zijn voorbereiding in gang -- precies zoals bij een puls met
       de duim. Dit is geen nieuwe keten, het is dezelfde. */
    const roster = await api(base, '/api/supplier/roster', { code: ZAAK });
    const man = roster.staff.find(x => x.role === 'manager');
    const baas = (await api(base, '/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' })).token;
    const lijst = await api(base, '/api/supplier/horeca/arrivals', {}, baas);
    const mijn = (lijst.arrivals || []).find(a => a.id === vraag.pass.id);
    assert.ok(mijn, 'de zaak ziet de pass');
    assert.equal(mijn.pulse, 'in-de-buurt');

    /* 3. DE BELOFTE, GEMETEN. "Bevat geen GPS" stond als zin op het scherm; hier
       wordt het een controle op de netwerklaag. Geen enkel verzoek van deze
       pagina -- niet naar de plaatslaag, niet naar de pass -- droeg een
       coördinaat. */
    assert.ok(verstuurd.length >= 3, 'er is met beide kanten gepraat');
    for (const req of verstuurd) {
      for (const veld of ['lat', 'lng', 'coords', 'accuracy', 'nauwkeurig', 'latitude', 'longitude']) {
        assert.ok(!req.body.includes('"' + veld + '"'),
          'verzoek naar ' + req.url + ' droeg ' + veld + ': ' + req.body);
      }
    }
    /* En wat de ZAAK te zien krijgt, draagt er ook geen. */
    const naarZaak = JSON.stringify(mijn);
    for (const veld of ['lat', 'lng', 'coord', 'afstand']) {
      assert.ok(!naarZaak.includes('"' + veld + '"'), 'de zaak krijgt geen ' + veld);
    }

    /* En de twee werelden bleven gescheiden: de pass draagt geen codenaam en de
       plaatslaag geen pass. Ze zijn alleen in de browser samengekomen. */
    assert.ok(!naarZaak.includes('codenaam'), 'de pass kent geen codenaam');
    const stand = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.ok(!JSON.stringify(stand).includes(pasToken), 'de plaatslaag kent de pass niet');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('plaats: langs een ANDERE zaak lopen geeft geen aankomstpuls',
  { skip: geenBrowser(pw) }, async () => {
  /* De regel die dit bewaakt staat in shared/plaatsnadering.js: alleen het hek
     van DEZE zaak, en alleen naar binnen. Zonder die regel zou elke zaak waar je
     toevallig langs komt jouw aankomstpuls afvuren -- en dan vertelt de puls de
     zaak iets over je route in plaats van over je bezoek.

     De naderingshekken zijn 900 meter ruim en gelden voor ALLE zaken, dus dit is
     geen theoretisch geval: op een eiland loop je er zo drie voorbij. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nader2-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = String(process.pid) + String(Date.now()).slice(-6);
    const reg = await api(base, '/api/auth/register', { name: 'Langsloper', email: 'ls' + u + '@voorbeeld.test',
      password: 'langsgeheim123', geboortedatum: '1990-04-04', tier: 'rtg', pasApp: 'rtg' });
    const deel = (p) => (p + 'abcdefghijklmnopqrstuvwxyz').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    const vraag = await api(base, '/api/arrival/request', {
      requestToken: deel('id2' + u) + '.' + deel('geheim2' + u), supplierCode: ZAAK,
      datum: morgen(), tijd: '20:00', personen: 2, naam: 'Gast', zone: 'zaal' });
    assert.ok(vraag.pass && vraag.pass.accessToken, 'de pass staat er');

    // een hek van een ANDERE zaak, ver genoeg van de zaak van de pass
    const h = await api(base, '/api/plaats/hekken', { doel: 'nadering' }, reg.token);
    const mijn = (h.hekken || []).find(x => x.id === 'leverancier:' + ZAAK);
    const m = (a, b) => {
      const R = 6371000, r = (d) => d * Math.PI / 180;
      const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
      const s2 = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s2));
    };
    const elders = (h.hekken || []).find(x => x.id !== mijn.id &&
      x.soort === 'punt' && m(mijn.punten[0], x.punten[0]) > 2500);
    assert.ok(elders, 'er is een zaak ver genoeg hiervandaan om langs te lopen');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(GPS(elders.punten[0].lat, elders.punten[0].lng));
    await ctx.addInitScript((d) => {
      try {
        localStorage.setItem('rtg_member_token', d.lid);
        localStorage.setItem('rtg_arrival_pass', d.pas);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, { lid: reg.token, pas: vraag.pass.accessToken });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtgnader', { timeout: 20000 });
    await page.click('.rtgnader .ja');

    /* De motor moet echt gedraaid hebben, anders bewijst "geen puls" niets: hij
       hoort de andere zaak wel degelijk als binnen te zien. */
    await page.waitForFunction(() => window.RTGPlaats && window.RTGPlaats.stand().binnen.length > 0,
      null, { timeout: 20000 });
    const stand = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.ok(stand.waarnemingen.some(w => w.hek === elders.id && w.wat === 'binnen'),
      'het toestel heeft de andere zaak wel degelijk als binnen gezien');

    /* Hier wordt een NEGATIEF bewezen: de zaak van de pass hoort niets te
       hebben gehoord. Dat wordt niet waar door 1200 ms te wachten -- het wordt
       toetsbaar zodra de pagina is uitgepraat, want dan is alles wat zij nog
       ging melden ook gemeld. */
    await wachtOpNetstilte(page);
    const pas = await api(base, '/api/arrival/pass', { pass: vraag.pass.accessToken });
    assert.equal(pas.pass.pulse, 'nog-niet-onderweg',
      'maar de zaak van de pass heeft niets gehoord: langslopen is geen aankomst');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
