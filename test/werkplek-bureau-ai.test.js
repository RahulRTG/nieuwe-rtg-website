/* De werkplek, derde helft: de AI-kant van de ontwerptak IN HET HUIS.

   test/architect.test.js, test/studio.test.js en test/hardware.test.js
   beproeven concept, bouwstaat/specsheet/stuklijst en de kritiek van de chef
   achter de KANTOORdeur (/api/office/...). De werkplek heeft dezelfde negen
   deuren een tweede keer, op eigen data per huis (routes/werkplek-bureaus.js
   en -b.js: bedrijf 'rtg' pakt kern.architect, 'rtf' pakt kern.architectRtf),
   en die tweede ingang riep geen enkele toets aan. Een route die het huis uit
   de body haalt is precies de route waar een vergeten `kies()` het ene huis
   in de ontwerpen van het andere laat kijken.

   Drie dingen per bureau: het concept dat de AI uittekent heeft de vaste vorm
   (palet van geldige hexkleuren, verhaal), het blad eronder heeft zijn delen
   met spec en een controlelijst, en de chef geeft leesbare kritiek. En steeds
   de tegenkant: een id uit het andere huis is hier onbekend (404), een
   onbekend id ook, en een medewerker zonder sleutel komt er niet in (403).

   Draai los: node --test test/werkplek-bureau-ai.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, eigenaar, medewerker;
const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const bu = (pad, body, token) => post(pad, body, token || eigenaar);
const HEX = /^#[0-9a-fA-F]{6}$/;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wpai-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const e = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  assert.equal(e.status, 200, 'het eigenaarsaccount bestaat en logt in');
  eigenaar = e.body.token;
  const t = Date.now().toString().slice(-7);
  const m = await post('/api/auth/register', { name: 'Bureau Test', email: 'wpai' + t + '@rtg.test',
    phone: '+31612340002', password: 'Wachtwoord123', geboortedatum: '1990-05-20' });
  assert.equal(m.status, 200);
  medewerker = m.body.token;
});
test.after(() => stop(srv && srv.child));

async function ontwerp(pad, bedrijf, naam, extra) {
  const r = await bu(pad, Object.assign({ bedrijf, naam, brief: 'Een verkenning voor ' + bedrijf + '.' }, extra || {}));
  assert.equal(r.status, 200, pad + ' lukt voor ' + bedrijf + ': ' + JSON.stringify(r.body).slice(0, 160));
  assert.ok(r.body.ontwerp && r.body.ontwerp.id, 'het ontwerp heeft een id');
  return r.body.ontwerp.id;
}

/* Het concept heeft in elk bureau dezelfde ruggengraat: een palet van echte
   hexkleuren en een verhaal. Wat er verder in staat verschilt per vak. */
function conceptKlopt(c, wat) {
  assert.ok(c, wat + ': er is een concept');
  assert.ok(Array.isArray(c.kleuren) && c.kleuren.length >= 2, wat + ': een palet van minstens twee tinten');
  assert.ok(c.kleuren.every(k => HEX.test(k.hex)), wat + ': elke tint heeft een geldige hex');
  assert.ok(typeof c.verhaal === 'string' && c.verhaal.length > 30, wat + ': en een verhaal bij het concept');
}

test('1. architect in het huis: concept, bouwstaat en de kritiek van de chef, voor beide huizen', async () => {
  for (const bedrijf of ['rtg', 'rtf']) {
    const id = await ontwerp('/api/werkplek/bureau/architect/maak', bedrijf, 'Penthouse ' + bedrijf, { discipline: 'penthouse' });
    const con = await bu('/api/werkplek/bureau/architect/concept', { bedrijf, id });
    assert.equal(con.status, 200, bedrijf + ': ' + JSON.stringify(con.body).slice(0, 160));
    const c = con.body.ontwerp.concept;
    conceptKlopt(c, bedrijf + ' architect');
    assert.ok(c.typologie && c.constructie, bedrijf + ': typologie en constructie');

    const sp = await bu('/api/werkplek/bureau/architect/bouwstaat', { bedrijf, id });
    assert.equal(sp.status, 200);
    const p = sp.body.ontwerp.bouwstaat;
    assert.ok(Array.isArray(p.delen) && p.delen.length >= 4, bedrijf + ': er zijn bouwdelen');
    assert.ok(p.delen.every(m => m.naam && m.spec), bedrijf + ': elk deel heeft een spec');
    assert.ok(p.oppervlak && p.kavel, bedrijf + ': met oppervlak en kavel');
    assert.ok(Array.isArray(p.controle) && p.controle.length >= 1, bedrijf + ': en een controlelijst');

    const k = await bu('/api/werkplek/bureau/architect/kritiek', { bedrijf, id, q: 'Waar kan dit scherper?' });
    assert.equal(k.status, 200);
    assert.ok(typeof k.body.kritiek === 'string' && k.body.kritiek.length > 20, bedrijf + ': een leesbare kritiek');

    // het blad staat daarna op het ontwerp in het overzicht van DIT huis
    const lijst = (await bu('/api/werkplek/bureau/architect', { bedrijf })).body.ontwerpen;
    const o = lijst.find(x => x.id === id);
    assert.ok(o, bedrijf + ': het ontwerp staat in het eigen overzicht');
    assert.ok(o.bouwstaat && Array.isArray(o.bouwstaat.delen), bedrijf + ': met zijn bouwstaat');
  }
});

test('2. studio in het huis: concept, specsheet en kritiek', async () => {
  const id = await ontwerp('/api/werkplek/bureau/studio/maak', 'rtf', 'Meridiaan Roadster', { discipline: 'automotive' });
  const con = await bu('/api/werkplek/bureau/studio/concept', { bedrijf: 'rtf', id });
  assert.equal(con.status, 200, JSON.stringify(con.body).slice(0, 160));
  conceptKlopt(con.body.ontwerp.concept, 'studio');

  const sp = await bu('/api/werkplek/bureau/studio/specsheet', { bedrijf: 'rtf', id });
  assert.equal(sp.status, 200);
  const p = sp.body.ontwerp.specsheet;
  assert.ok(Array.isArray(p.modules) && p.modules.length >= 4, 'er zijn modules');
  assert.ok(p.modules.every(m => m.naam && m.spec), 'elke module heeft een spec');
  assert.ok(p.prestaties && p.afmetingen, 'met prestaties en afmetingen');
  assert.ok(Array.isArray(p.controle) && p.controle.length >= 1, 'en een controlelijst');

  const k = await bu('/api/werkplek/bureau/studio/kritiek', { bedrijf: 'rtf', id, q: 'Wat mist er?' });
  assert.equal(k.status, 200);
  assert.ok(typeof k.body.kritiek === 'string' && k.body.kritiek.length > 20, 'een leesbare kritiek');
});

test('3. hardware in het huis: concept, stuklijst en kritiek', async () => {
  const id = await ontwerp('/api/werkplek/bureau/hardware/maak', 'rtg', 'Zaakdoos Pro', { discipline: 'edge' });
  const con = await bu('/api/werkplek/bureau/hardware/concept', { bedrijf: 'rtg', id });
  assert.equal(con.status, 200, JSON.stringify(con.body).slice(0, 160));
  conceptKlopt(con.body.ontwerp.concept, 'hardware');

  const sp = await bu('/api/werkplek/bureau/hardware/stuklijst', { bedrijf: 'rtg', id });
  assert.equal(sp.status, 200);
  const p = sp.body.ontwerp.stuklijst;
  assert.ok(Array.isArray(p.onderdelen) && p.onderdelen.length >= 4, 'er zijn onderdelen');
  assert.ok(p.onderdelen.every(m => m.naam && m.spec), 'elk onderdeel heeft een spec');
  assert.ok(p.verbruik && p.afmetingen, 'met verbruik en afmetingen');
  assert.ok(Array.isArray(p.controle) && p.controle.length >= 1, 'en een controlelijst');

  const k = await bu('/api/werkplek/bureau/hardware/kritiek', { bedrijf: 'rtg', id, q: 'Is dit te bouwen?' });
  assert.equal(k.status, 200);
  assert.ok(typeof k.body.kritiek === 'string' && k.body.kritiek.length > 20, 'een leesbare kritiek');
});

test('4. de grens: andermans huis, een onbekend id en een medewerker zonder sleutel', async () => {
  const rtgId = await ontwerp('/api/werkplek/bureau/architect/maak', 'rtg', 'Villa Duin', { discipline: 'villa' });
  const rtfId = await ontwerp('/api/werkplek/bureau/studio/maak', 'rtf', 'Stichtingsbusje');
  const hwId = await ontwerp('/api/werkplek/bureau/hardware/maak', 'rtf', 'Clubhuis-bel');

  // het id van het ene huis is in het andere huis onbekend -- ook voor de AI-deuren
  for (const [pad, bedrijf, id] of [
    ['/api/werkplek/bureau/architect/concept', 'rtf', rtgId],
    ['/api/werkplek/bureau/architect/bouwstaat', 'rtf', rtgId],
    ['/api/werkplek/bureau/architect/kritiek', 'rtf', rtgId],
    ['/api/werkplek/bureau/studio/concept', 'rtg', rtfId],
    ['/api/werkplek/bureau/studio/specsheet', 'rtg', rtfId],
    ['/api/werkplek/bureau/studio/kritiek', 'rtg', rtfId],
    ['/api/werkplek/bureau/hardware/concept', 'rtg', hwId],
    ['/api/werkplek/bureau/hardware/stuklijst', 'rtg', hwId],
    ['/api/werkplek/bureau/hardware/kritiek', 'rtg', hwId]
  ]) {
    const kruis = await bu(pad, { bedrijf, id, q: 'x' });
    assert.equal(kruis.status, 404, pad + ' met een id uit het andere huis hoort 404 te zijn (' + kruis.status + ')');
    const onbekend = await bu(pad, { bedrijf, id: 'bestaat-niet', q: 'x' });
    assert.equal(onbekend.status, 404, pad + ' met een onbekend id hoort 404 te zijn (' + onbekend.status + ')');
  }
  // en het ontwerp heeft er in zijn eigen huis niets van gemerkt: nog geen concept
  const eigen = (await bu('/api/werkplek/bureau/architect', { bedrijf: 'rtg' })).body.ontwerpen.find(o => o.id === rtgId);
  assert.ok(eigen, 'het RTG-ontwerp staat nog in zijn eigen huis');
  assert.ok(!eigen.concept, 'en de poging vanuit RTF heeft er geen concept op gezet');

  // zonder sleutel van het huis komt een gewoon lid er niet in
  for (const pad of ['/api/werkplek/bureau/architect/concept', '/api/werkplek/bureau/studio/specsheet',
    '/api/werkplek/bureau/hardware/stuklijst', '/api/werkplek/bureau/architect/kritiek']) {
    const m = await bu(pad, { bedrijf: 'rtf', id: rtfId, q: 'x' }, medewerker);
    assert.equal(m.status, 403, pad + ' hoort dicht te zitten voor een medewerker zonder sleutel (' + m.status + ')');
  }
  assert.equal((await post('/api/werkplek/bureau/architect/concept', { bedrijf: 'rtg', id: rtgId })).status, 403, 'en zonder inlog helemaal niet (de huisdeur geeft 403, geen 401)');
});
