/* DE KANTOORKANT VAN DE CATALOGUS-WENSEN.

   De onboarding vraagt een nieuw lid of het een bedrijf heeft, en met een vinkje
   legt het de wens vast om in de RTG-catalogus te komen
   (kern/onboarding/meebouwen.js). Het lid krijgt te horen dat RTG ernaar kijkt.
   Die wens stond op de onderneming en werd door NIEMAND gelezen: er was geen
   scherm waar iemand keek. Een wens zonder lezer is een belofte die de code niet
   waarmaakt (LAT-regel 6).

   Wat deze toets vastlegt:
   1. de wens komt op het kantoor terecht, en verdwijnt uit "open" zodra een mens
      hem behandelt;
   2. op CODENAAM -- de echte naam ligt in de gescheiden kluis en hoort niet in
      een lijst, ook niet achter de kantoorpoort;
   3. het besluit maakt GEEN zaak. Een partnerplek loopt langs de bestaande weg,
      met Business Pass-bewijs en een besluit van de boardroom. Twee deuren naar
      dezelfde catalogus zou betekenen dat de ene de eis van de andere overslaat.
   Draai: npm test -- --bestanden=catalogus-wensen */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const CODE = 'RTG-CW-TEST';

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function versLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return r.body.token;
}

test('een wens uit de onboarding komt op het kantoor, op codenaam, en een mens beslist', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Pieternel');
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    assert.ok(kantoor, 'de kantoorcode werkt');

    // leeg tot er iemand iets vraagt
    const leeg = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(leeg.open, 0, 'de lijst begint leeg');

    // 1. het lid geeft zijn bedrijf op EN vraagt om de catalogus
    const gemaakt = await P('/api/onboarding/bedrijf', { naam: 'Atelier Pieternel', catalogus: true }, lid);
    assert.equal(gemaakt.status, 200, JSON.stringify(gemaakt.body).slice(0, 160));

    const na = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(na.open, 1, 'de wens staat op het kantoor: ' + JSON.stringify(na).slice(0, 200));
    const w = na.wensen[0];
    assert.equal(w.naam, 'Atelier Pieternel');
    assert.ok(w.gevraagd, 'met een tijdstip erbij');
    assert.equal(w.businessPass, false,
      'en de eerste vraag staat erbij: zonder Business Pass geen partnerplek');

    /* 2. OP CODENAAM. Klantdata draait in dit huis op codenamen; achter de
       kantoorpoort zitten is geen reden om daar een echte naam neer te zetten. */
    const alles = JSON.stringify(na);
    assert.doesNotMatch(alles, /Pieternel@|pieternel[0-9]/i, 'geen e-mailadres in de lijst');
    assert.ok(!/"eigenaar":"user-/.test(alles),
      'en niet de rauwe sleutel maar een codenaam: ' + w.eigenaar);
    assert.ok(w.eigenaar && w.eigenaar.length > 2, 'er staat wel iemand bij: ' + w.eigenaar);

    /* 3. HET BESLUIT MAAKT GEEN ZAAK. Dat blijft de partnerweg, met Business
       Pass-bewijs. Zou dit besluit het ook kunnen, dan sloeg de ene deur de eis
       van de andere over. */
    const zakenVoor = ((await P('/api/suppliers', {}, lid)).body.suppliers || []).length;
    const besluit = await P('/api/office/catalogus-wens/besluit',
      { id: w.id, besluit: 'opgepakt' }, kantoor);
    assert.equal(besluit.status, 200, JSON.stringify(besluit.body).slice(0, 160));
    const zakenNa = ((await P('/api/suppliers', {}, lid)).body.suppliers || []).length;
    assert.equal(zakenNa, zakenVoor, 'er is geen zaak bijgekomen');

    const naBesluit = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(naBesluit.open, 0, 'de wens staat niet meer open');
    assert.equal(naBesluit.wensen[0].besluit, 'opgepakt', 'maar hij is wel te zien, met het besluit erbij');
    assert.ok(naBesluit.wensen[0].door, 'en met wie het deed: ' + naBesluit.wensen[0].door);

    // twee keer beslissen kan niet
    const nogmaals = await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'opgepakt' }, kantoor);
    assert.equal(nogmaals.status, 409, 'een tweede besluit kaatst af');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

test('afwijzen vraagt een reden, en zonder kantoorinlog beslist niemand iets', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw2-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Quirijn');
    await P('/api/onboarding/bedrijf', { naam: 'Quirijn Bouw', catalogus: true }, lid);
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    const w = (await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen[0];

    // zonder kantoorinlog: dicht
    assert.equal((await P('/api/office/catalogus-wensen', {})).status, 401, 'de lijst is dicht');
    assert.equal((await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'opgepakt' })).status, 401,
      'en het besluit ook');

    // afwijzen zonder reden: een deur die dichtgaat krijgt een grond
    const zonder = await P('/api/office/catalogus-wens/besluit', { id: w.id, besluit: 'afgewezen' }, kantoor);
    assert.equal(zonder.status, 400, 'afwijzen zonder reden mag niet: ' + JSON.stringify(zonder.body));
    const met = await P('/api/office/catalogus-wens/besluit',
      { id: w.id, besluit: 'afgewezen', notitie: 'Werkt niet in een genre dat wij bedienen.' }, kantoor);
    assert.equal(met.status, 200, JSON.stringify(met.body).slice(0, 160));
    const lijst = (await P('/api/office/catalogus-wensen', {}, kantoor)).body.wensen[0];
    assert.equal(lijst.besluit, 'afgewezen');
    assert.match(lijst.notitie, /genre/, 'de reden staat erbij: ' + lijst.notitie);

    // een onbekende wens is een nette 404
    assert.equal((await P('/api/office/catalogus-wens/besluit',
      { id: 'ond_bestaatniet', besluit: 'opgepakt' }, kantoor)).status, 404);
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

/* En de tegenproef: wie GEEN vinkje zette, staat niet op de lijst. Het bedrijf
   is dan gewoon van hem en RTG heeft er niets mee te maken. */
test('zonder vinkje komt het bedrijf niet op de kantoorlijst', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cw3-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Rosalie');
    const r = await P('/api/onboarding/bedrijf', { naam: 'Rosalie Studio', catalogus: false }, lid);
    assert.equal(r.status, 200);
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    const lijst = (await P('/api/office/catalogus-wensen', {}, kantoor)).body;
    assert.equal(lijst.aantal, 0, 'zonder vinkje staat er niets op het kantoor: ' + JSON.stringify(lijst));
    // maar het bedrijf is er wel, van hem
    const mijn = (await P('/api/onderneming/mijn', {}, lid)).body.ondernemingen || [];
    assert.ok(mijn.some(o => o.naam === 'Rosalie Studio'), 'het bedrijf staat wel op zijn naam');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
