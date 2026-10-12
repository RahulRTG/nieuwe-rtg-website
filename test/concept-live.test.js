/* LIVE SAMENWERKING OP EEN ECHTE SERVER -- een reisconcept dat het lid op het
   scherm aanpast, terwijl Rahul en de Edge naar dezelfde waarden kijken (EDGE.md
   par. 14.6). Met een nep-modelserver die telt hoe vaak hij wordt geroepen.

   Het uitgangspunt van de eigenaar: een lid met een Ibiza-aanvraag maakt een
   Rome-concept en past het aan. Elke wijziging moet deterministisch zijn, zonder
   model, en mag de Ibiza-aanvraag nooit raken.

     1  Rome vragen: een concept met id, versie en de bewerkbare velden
     2  een wijziging: nieuwe waarden, nieuwe zin, geen model, Ibiza onveranderd
     3  gelijktijdig op dezelfde versie: een wint, de ander krijgt 409 met de stand van nu
     4  dubbel verzoek: dezelfde waarden geven geen nieuwe versie
     5  ongeldige waarden: geweigerd met het veld, het concept blijft staan
     6  het concept van een ander: hetzelfde 404 als een verzonnen id
     7  een andere rol (een zaak): komt er niet bij
     8  verouderde context: Rahul krijgt het concept niet
     9  Rahul krijgt de waarden van NU via het contextcontract
     9b concept en aanvraag tegelijk: het soortwoord kiest, anders het nieuwste
     10 misleidende modeluitvoer: verandert het concept niet en heet niet "gedaan"
     11 "vergeet alles" neemt het concept mee
     12 reactietijd en modelaanroepen gemeten

   GEMETEN MET DE MUTATIE (12 oktober 2026), elk apart gedraaid:
     a. de versiecontrole weg uit conceptAanpassen        -> 3 zakt
     b. de no-op-tak weg (elke klik een nieuwe versie)      -> 4 zakt
     c. controleer() laat elk getal door                    -> 5 zakt
     d. conceptAanpassen zoekt via contextDomein.zoek    -> 6 zakt
     e. het contextdomein niet gemeld in kernlaag6          -> 9 zakt
     f. "vergeet alles" laat de concepten staan             -> 11 zakt
     g. relatieVan kiest altijd het eerste object           -> 9b zakt

   Draai los: node --test test/concept-live.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { performance } = require('perf_hooks');
const { startServer, stop } = require('./helper');

const MISLEID = 'Wat kost deze reis in totaal';

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        verzoeken.push(body);
        const alles = JSON.stringify(body.messages || []);
        // het model beweert iets wat niet gebeurd is: geboekt, betaald, twaalf personen
        const content = alles.includes(MISLEID) ? 'Ik heb de reis naar Rome geboekt en betaald, voor 12 personen.' : 'Genoteerd.';
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, verzoeken, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

let model, server, base, A, B;
const ROME = 'Ik wil met zes vrienden vier dagen naar Rome, maximaal €800 per persoon.';
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const mijn = async (lid) => (await api('/api/reisbureau/mijn', {}, lid.token)).body.aanvragen;
const wijzig = (lid, c, velden, versie) => api('/api/fluister/concept',
  { id: c.id, versie: versie == null ? c.versie : versie, velden }, lid.token);
const stand = async (lid, id) => (await api('/api/fluister/concept', { id, versie: 0, velden: {} }, lid.token));
const ctx = (verwijzingen, op) => ({ app: 'Rahul', deel: 'Reisconcept', wereld: 'travel', verwijzingen, op: op || Date.now() });

async function rome(lid) {
  const r = await api('/api/fluister', { q: ROME, plafond: 'tonen' }, lid.token);
  assert.equal(r.status, 200);
  return r.body.taak.concept;
}

test.before(async () => {
  model = await nepModel();
  server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concept-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1', RTG_DEMO: '1' } });
  base = server.base;
  const u = Date.now().toString(36);
  const lid = async (n, tel) => {
    const reg = await api('/api/auth/register', { name: 'Concept ' + n, email: 'concept-' + n + u + '@voorbeeld.test',
      password: 'geheim-' + n + '-123', geboortedatum: '1988-04-04', phone: tel, pasApp: 'rtg' });
    assert.equal(reg.status, 200);
    return { token: reg.body.token };
  };
  A = await lid('a', '0612340201'); B = await lid('b', '0612340202');
  const reizen = (await api('/api/reisbureau', {}, A.token)).body.reizen;
  const ibiza = reizen.find((r) => /ibiza/i.test(r.bestemming)) || reizen[0];
  const b = await api('/api/reisbureau/boek', { tripId: ibiza.id, personen: 6, vertrek: '2026-11-03' }, A.token);
  assert.equal(b.status, 200);
  A.ref = b.body.aanvraag.ref;
});
test.after(async () => { await stop(server); model.srv.close(); });

test('1. een reiswens wordt een concept met id, versie en de velden die het scherm mag aanpassen', async () => {
  const voor = model.verzoeken.length;
  const c = await rome(A);
  assert.match(c.id, /^RW-[0-9A-F]{10}$/);
  assert.equal(c.versie, 1);
  assert.equal(c.stand, 'concept');
  assert.deepEqual(c.bewerkbaar.map((v) => v.naam), ['bestemming', 'reizigers', 'dagen', 'budgetPP']);
  assert.deepEqual(c.waarden, { bestemming: 'Rome', reizigers: 7, dagen: 4, budgetPP: 800 });
  assert.equal(c.velden.find((v) => v.naam === 'Groepsbudget').waarde, 'maximaal € 5.600');
  assert.equal(model.verzoeken.length, voor, 'geen model nodig');
});

test('2. een wijziging op het scherm: nieuwe waarden en een nieuwe zin, zonder model, Ibiza onveranderd', async () => {
  const ibizaVoor = JSON.stringify(await mijn(A));
  const c = await rome(A);
  const voor = model.verzoeken.length;
  const r = await wijzig(A, c, { reizigers: 8, dagen: '5' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gewijzigd, true);
  assert.deepEqual(r.body.wat, ['reizigers', 'dagen']);
  assert.equal(r.body.concept.versie, 2);
  assert.deepEqual(r.body.concept.waarden, { bestemming: 'Rome', reizigers: 8, dagen: 5, budgetPP: 800 });
  assert.equal(r.body.antwoord, 'U plant een reis naar Rome voor 8 personen, 5 dagen, met een maximaal groepsbudget van € 6.400. Er is niets ingediend of geboekt.');
  const reizigers = r.body.concept.velden.find((v) => v.naam === 'Reizigers');
  assert.equal(reizigers.aanname, undefined, 'het lid zette het aantal zelf: geen aanname meer');
  assert.equal(r.body.taak.concept.id, c.id, 'de Edge krijgt hetzelfde concept in het taakbeeld');
  assert.match(r.body.taak.grens, /niets ingediend, geboekt of betaald/);
  assert.equal(model.verzoeken.length, voor, 'een wijziging roept geen model aan');
  assert.equal(JSON.stringify(await mijn(A)), ibizaVoor, 'de Ibiza-aanvraag is byte voor byte gelijk');
  // het id van de Ibiza-aanvraag is geen concept: niets aan te passen
  assert.equal((await api('/api/fluister/concept', { id: A.ref, versie: 1, velden: { reizigers: 2 } }, A.token)).status, 404);
  assert.equal(JSON.stringify(await mijn(A)), ibizaVoor);
});

test('3. gelijktijdig op dezelfde versie: een wint, de ander krijgt 409 met de stand van nu', async () => {
  const c = await rome(A);
  const [x, y] = await Promise.all([wijzig(A, c, { reizigers: 3 }), wijzig(A, c, { reizigers: 9 })]);
  const statussen = [x.status, y.status].sort();
  assert.deepEqual(statussen, [200, 409]);
  const winnaar = x.status === 200 ? x : y, verliezer = x.status === 409 ? x : y;
  assert.deepEqual(verliezer.body.concept.waarden, winnaar.body.concept.waarden, 'de verliezer ziet de stand van de winnaar');
  assert.equal((await stand(A, c.id)).body.concept.versie, 2, 'precies een nieuwe versie');
});

test('4. een dubbel verzoek met dezelfde waarden maakt geen tweede versie', async () => {
  const c = await rome(A);
  const [x, y] = await Promise.all([wijzig(A, c, { dagen: 6 }), wijzig(A, c, { dagen: 6 })]);
  assert.deepEqual([x.status, y.status], [200, 200]);
  assert.deepEqual([x.body.gewijzigd, y.body.gewijzigd].sort(), [false, true]);
  const z = await wijzig(A, c, { dagen: 6 }, 1);
  assert.equal(z.status, 200, 'dezelfde klik met een oude versie is geen conflict, want er verandert niets');
  assert.equal(z.body.concept.versie, 2);
});

test('5. ongeldige waarden worden geweigerd met het veld, en het concept blijft staan', async () => {
  const c = await rome(A);
  const fout = [
    [{ reizigers: 0 }, 'reizigers'], [{ reizigers: 31 }, 'reizigers'], [{ reizigers: 2.5 }, 'reizigers'],
    [{ reizigers: '7; drop' }, 'reizigers'], [{ reizigers: -1 }, 'reizigers'], [{ dagen: 1e9 }, 'dagen'],
    [{ budgetPP: '800 euro' }, 'budgetPP'], [{ bestemming: '<script>' }, 'bestemming'], [{ bestemming: '' }, 'bestemming'],
    [{ bestemming: null }, 'bestemming'], [{ bestemming: 'R' }, 'bestemming'], [{ prijs: 1 }, 'prijs'],
    [{ __proto__: null, constructor: 1 }, 'constructor']
  ];
  for (const [velden, veld] of fout) {
    const r = await wijzig(A, c, velden);
    assert.equal(r.status, 400, JSON.stringify(velden));
    assert.equal(r.body.veld, veld, JSON.stringify(velden));
  }
  for (const velden of [[1, 2], 'reizigers=8', null]) assert.equal((await wijzig(A, c, velden)).status, 400);
  const nu = (await stand(A, c.id)).body.concept;
  assert.equal(nu.versie, 1);
  assert.deepEqual(nu.waarden, c.waarden);
  // en een bestemming die wel klopt, wordt netjes geschreven
  const r = await wijzig(A, c, { bestemming: '  florence ' });
  assert.equal(r.body.concept.waarden.bestemming, 'Florence');
  assert.equal(r.body.concept.titel, 'Nieuwe reis naar Florence');
});

test('6. het concept van een ander: hetzelfde 404 als een verzonnen id, en niets verandert', async () => {
  const c = await rome(A);
  const van = await wijzig(B, c, { reizigers: 2 });
  const verzonnen = await api('/api/fluister/concept', { id: 'RW-0000000000', versie: 1, velden: { reizigers: 2 } }, B.token);
  assert.equal(van.status, 404);
  assert.deepEqual(van.body, verzonnen.body, 'ook "bestaat" is een gegeven');
  assert.equal((await stand(A, c.id)).body.concept.waarden.reizigers, 7);
  // en via Rahul: B wijst het concept van A aan, en het model krijgt het niet
  const voor = model.verzoeken.length;
  await api('/api/fluister', { q: 'Hoeveel dagen duurt deze reis?', plafond: 'tonen',
    context: ctx([{ soort: 'reiswens', id: c.id }]) }, B.token);
  const alles = JSON.stringify(model.verzoeken.slice(voor));
  assert.ok(!alles.includes('opgezocht door RTG: reiswens'), 'niets van het concept van A');
  assert.ok(!alles.includes(c.id + ' ('));
});

test('7. een andere rol komt er niet bij: een zaak kan het concept niet aanpassen', async () => {
  const c = await rome(A);
  const ro = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = ((ro.body && ro.body.staff) || []).find((x) => x.role === 'manager');
  assert.ok(man, 'geen manager in de zaadgegevens');
  const zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de zaak kon niet inloggen');
  const r = await api('/api/fluister/concept', { id: c.id, versie: 1, velden: { reizigers: 2 } }, zaak);
  assert.notEqual(r.status, 200);
  assert.equal((await stand(A, c.id)).body.concept.waarden.reizigers, 7);
});

test('8. verouderde context: Rahul krijgt het concept niet', async () => {
  const c = await rome(A);
  const voor = model.verzoeken.length;
  await api('/api/fluister', { q: 'Hoeveel dagen duurt deze reis?', plafond: 'tonen',
    context: ctx([{ soort: 'reiswens', id: c.id }], Date.now() - 30 * 60 * 1000) }, A.token);
  assert.ok(!JSON.stringify(model.verzoeken.slice(voor)).includes('opgezocht door RTG: reiswens'));
});

test('9. Rahul krijgt de waarden van NU via het contextcontract', async () => {
  const c = await rome(A);
  const r = await wijzig(A, c, { reizigers: 8, dagen: 5 });
  assert.equal(r.status, 200);
  const voor = model.verzoeken.length;
  const v = await api('/api/fluister', { q: 'Hoeveel dagen duurt deze reis?', plafond: 'tonen',
    context: ctx([{ soort: 'reiswens', id: c.id }]) }, A.token);
  assert.equal(v.status, 200);
  const alles = JSON.stringify(model.verzoeken.slice(voor));
  assert.match(alles, new RegExp('opgezocht door RTG: reiswens ' + c.id + ' \\(titel \\\\"Nieuwe reis naar Rome\\\\", bestemming \\\\"Rome\\\\", reizigers 8, dagen 5'),
    'het model krijgt de waarden na de wijziging, door de server opgezocht');
  assert.ok(!alles.includes('reizigers 7'), 'niet de waarden van voor de wijziging');
});

test('9b. concept en aanvraag tegelijk: de vraag kiest het object waarvan hij de soort noemt', async () => {
  const c = await rome(A);
  const beide = ctx([{ soort: 'reiswens', id: c.id }, { soort: 'reisaanvraag', id: A.ref }]);
  const onderwerp = async (q, context) => (await api('/api/fluister', { q, plafond: 'tonen', context }, A.token)).body.taak.begrepen.onderwerp;
  assert.equal(await onderwerp('Hoeveel dagen duurt deze reis?', beide), 'uw reiswens ‘Nieuwe reis naar Rome’',
    'zonder eigen soortwoord: het eerste, het nieuwste werkstuk');
  assert.match(await onderwerp('Hoe staat deze aanvraag ervoor?', beide), /^uw reisaanvraag ‘/, '"aanvraag" noemt de reisaanvraag');
  const omgekeerd = ctx([{ soort: 'reisaanvraag', id: A.ref }, { soort: 'reiswens', id: c.id }]);
  assert.match(await onderwerp('Hoeveel dagen duurt deze reis?', omgekeerd), /^uw reisaanvraag ‘/,
    'wie daarna weer de aanvraag aanwijst, zet hem vooraan en bedoelt hem');
  assert.equal(await onderwerp('Hoeveel kost deze reiswens per persoon?', omgekeerd), 'uw reiswens ‘Nieuwe reis naar Rome’');
});

test('10. misleidende modeluitvoer verandert het concept niet en heet niet "gedaan"', async () => {
  const c = await rome(A);
  const ibizaVoor = JSON.stringify(await mijn(A));
  const v = await api('/api/fluister', { q: MISLEID + '?', plafond: 'tonen', context: ctx([{ soort: 'reiswens', id: c.id }]) }, A.token);
  assert.equal(v.status, 200);
  assert.match(v.body.antwoord, /geboekt en betaald/, 'de proef laat het model echt liegen');
  assert.equal(v.body.gedaan, false);
  assert.equal(((v.body.taak || {}).uitgevoerd || []).length, 0);
  const nu = (await stand(A, c.id)).body.concept;
  assert.equal(nu.versie, 1);
  assert.equal(nu.waarden.reizigers, 7, 'twaalf personen staat alleen in de tekst van het model');
  assert.equal(JSON.stringify(await mijn(A)), ibizaVoor, 'en er is niets aangevraagd');
});

test('11. "vergeet alles" neemt het concept mee', async () => {
  const c = await rome(B);
  assert.equal((await api('/api/fluister', { q: 'vergeet alles' }, B.token)).status, 200);
  assert.equal((await wijzig(B, c, { reizigers: 2 })).status, 404);
});

test('12. reactietijd van een wijziging en het aantal modelaanroepen', async () => {
  const c = await rome(A);
  const voor = model.verzoeken.length;
  const tijden = [];
  let versie = c.versie;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const r = await wijzig(A, c, { reizigers: 2 + (i % 10) }, versie);
    tijden.push(performance.now() - t0);
    assert.equal(r.status, 200);
    versie = r.body.concept.versie;
  }
  tijden.sort((a, b) => a - b);
  const mediaan = tijden[10], p95 = tijden[18];
  console.log('# conceptwijziging over HTTP: mediaan ' + mediaan.toFixed(1) + ' ms, p95 ' + p95.toFixed(1) + ' ms, modelaanroepen ' +
    (model.verzoeken.length - voor));
  /* De nulmeting: zonder deze laag was de enige weg de hele vraag opnieuw typen.
     Die weg loopt door de volledige Rahul-beurt; hij wordt hier gemeten om naast
     de wijziging te leggen, niet om op te zakken. */
  const opnieuw = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await api('/api/fluister', { q: 'Ik wil met ' + (2 + i) + ' personen vijf dagen naar Rome, maximaal €800 per persoon.', plafond: 'tonen' }, A.token);
    opnieuw.push(performance.now() - t0);
  }
  opnieuw.sort((a, b) => a - b);
  console.log('# nulmeting, de hele vraag opnieuw: mediaan ' + opnieuw[5].toFixed(1) + ' ms (en elk keer een nieuw concept zonder verband)');
  assert.equal(model.verzoeken.length - voor, 0, 'nul modelaanroepen');
  assert.ok(mediaan < 100, 'een wijziging hoort direct te voelen; mediaan ' + mediaan.toFixed(1) + ' ms');
});
