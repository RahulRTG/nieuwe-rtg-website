/* TYPEN EN KLIKKEN WIJZIGEN HETZELFDE CONCEPT (besluit 2 van de eigenaar, 12
   oktober 2026; EDGE.md par. 14.7).

   "Maak er vijf dagen van" tegen Rahul en het veld "Dagen" op het scherm komen
   op dezelfde plek uit: de eigen wijzigingsroute van het concept
   (kern/fluister/reis/reisconcept.js conceptAanpassen). De context bridge leest
   de velden uit de zin (tekstVelden van het domein) en past ze alleen toe als
   de vraag het object wil veranderen en het object van deze mens is.

     1  een wijziging in woorden: nieuwe versie, nieuwe waarde, geen model
     2  typen en klikken leveren exact hetzelfde concept op
     3  een ongeldige waarde in woorden: geweigerd met de reden, niets veranderd
     4  de Ibiza-aanvraag blijft onaangeroerd, ook met beide objecten aangewezen
     5  het concept van een ander lid: geen wijziging
     6  een verouderde schermcontext: geen wijziging
     7  een vraag over het concept is geen wijziging
     8  een nieuwe reiswens met een concept open: een nieuw concept, het oude blijft
     9  "en boek meteen": alleen het veld verandert, er wordt niets geboekt
     10 dezelfde zin twee keer: geen tweede versie
     11 de wijzigingsroute van het domein is de enige schrijver (contract)

   GEMETEN MET DE MUTATIE (12 oktober 2026), elk apart gedraaid:
     a. de wijzighaak weg uit de route                  -> 1, 2, 3, 4, 9 en 10 zakken
     b. menscontext-wijzig.lees negeert de relatie       -> 7 en 8 zakken
     c. pasAanUitTekst controleert de eigenaar niet      -> geen zakt; de canonieke
        opzoeking houdt hem al tegen (5 blijft groen), en dat staat er zo
     d. tekstVelden laat elk veld door (geen BEWERKBAAR-filter) -> 1, 2, 4, 9 en 11
        zakken: `nachten` en `aanname` zijn geen bewerkbare velden en worden geweigerd

   Draai los: node --test test/tekst-wijzig.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop } = require('./helper');

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        verzoeken.push(body);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Ik heb het voor u aangepast naar 12 personen en geboekt.' },
          finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } }));
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
const stand = async (lid, id) => (await api('/api/fluister/concept', { id, versie: 0, velden: {} }, lid.token)).body.concept;
const ref = (c) => ({ soort: 'reiswens', id: c.id });
const ctx = (verwijzingen, op) => ({ app: 'Rahul', deel: 'Reisconcept', wereld: 'travel', verwijzingen, op: op || Date.now() });
async function rome(lid) { return (await api('/api/fluister', { q: ROME, plafond: 'tonen' }, lid.token)).body.taak.concept; }
async function zeg(lid, q, verwijzingen, op) {
  const voor = model.verzoeken.length;
  const r = await api('/api/fluister', { q, plafond: 'tonen', context: ctx(verwijzingen, op) }, lid.token);
  assert.equal(r.status, 200, q + ': ' + JSON.stringify(r.body).slice(0, 200));
  return Object.assign(r.body, { modelAanroepen: model.verzoeken.length - voor });
}
const zonderId = (c) => { const x = JSON.parse(JSON.stringify(c)); delete x.id; delete x.versie; return x; };

test.before(async () => {
  model = await nepModel();
  server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tekstwijzig-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  base = server.base;
  const u = Date.now().toString(36);
  const lid = async (n, tel) => {
    const reg = await api('/api/auth/register', { name: 'Typer ' + n, email: 'typer-' + n + u + '@voorbeeld.test',
      password: 'geheim-' + n + '-123', geboortedatum: '1988-04-04', phone: tel, pasApp: 'rtg' });
    assert.equal(reg.status, 200);
    return { token: reg.body.token };
  };
  A = await lid('a', '0612340401'); B = await lid('b', '0612340402');
  const reizen = (await api('/api/reisbureau', {}, A.token)).body.reizen;
  const ibiza = reizen.find((r) => /ibiza/i.test(r.bestemming)) || reizen[0];
  const b = await api('/api/reisbureau/boek', { tripId: ibiza.id, personen: 6, vertrek: '2026-11-03' }, A.token);
  assert.equal(b.status, 200);
  A.ref = b.body.aanvraag.ref;
});
test.after(async () => { await stop(server); model.srv.close(); });

test('1. "Maak er vijf dagen van": nieuwe versie, nieuwe waarde, geen model', async () => {
  const c = await rome(A);
  const r = await zeg(A, 'Maak er vijf dagen van', [ref(c)]);
  assert.equal(r.viaTekst, true);
  assert.equal(r.gewijzigd, true);
  assert.equal(r.gedaan, false, 'een concept aanpassen is niets uitvoeren');
  assert.equal(r.taak.concept.versie, 2);
  assert.equal(r.taak.concept.waarden.dagen, 5);
  assert.equal(r.antwoord, 'U plant een reis naar Rome voor 7 personen, 5 dagen, met een maximaal groepsbudget van € 5.600. Er is niets ingediend of geboekt.');
  assert.equal(r.modelAanroepen, 0);
  assert.equal((await stand(A, c.id)).waarden.dagen, 5, 'de wijziging staat op de server');
});

test('2. typen en klikken leveren exact hetzelfde concept op', async () => {
  const getypt = await rome(A), geklikt = await rome(A);
  const t = await zeg(A, 'Maak er 5 dagen en 8 personen van', [ref(getypt)]);
  const k = await api('/api/fluister/concept', { id: geklikt.id, versie: geklikt.versie, velden: { dagen: 5, reizigers: 8 } }, A.token);
  assert.equal(k.status, 200);
  assert.deepEqual(zonderId(t.taak.concept), zonderId(k.body.concept));
  assert.equal(t.antwoord, k.body.antwoord, 'Rahul zegt hetzelfde, of er nu getypt of geklikt is');
  assert.equal(t.taak.concept.versie, k.body.concept.versie);
});

test('3. een ongeldige waarde in woorden: geweigerd met de reden, niets veranderd', async () => {
  const c = await rome(A);
  const r = await zeg(A, 'Maak er 40 personen van', [ref(c)]);
  assert.equal(r.gewijzigd, false);
  assert.match(r.antwoord, /^Reizigers moet een heel getal zijn van 1 tot en met 30\. Er is niets veranderd\.$/);
  const nu = await stand(A, c.id);
  assert.equal(nu.versie, 1);
  assert.equal(nu.waarden.reizigers, 7);
});

test('4. de Ibiza-aanvraag blijft onaangeroerd, ook met beide objecten aangewezen', async () => {
  const voor = JSON.stringify(await mijn(A));
  const c = await rome(A);
  const r = await zeg(A, 'Maak er vijf dagen van', [ref(c), { soort: 'reisaanvraag', id: A.ref }]);
  assert.equal(r.taak.concept.id, c.id, 'het nieuwste werkstuk is het onderwerp');
  assert.equal(JSON.stringify(await mijn(A)), voor);
  // wie de aanvraag vooraan heeft, raakt het concept niet: die soort kent geen wijziging in woorden
  const d = await rome(A);
  const s = await zeg(A, 'Maak er vijf dagen van', [{ soort: 'reisaanvraag', id: A.ref }, ref(d)]);
  assert.notEqual(s.viaTekst, true);
  assert.equal((await stand(A, d.id)).versie, 1);
  assert.equal(JSON.stringify(await mijn(A)), voor, 'en de aanvraag ook niet');
});

test('5. het concept van een ander lid: geen wijziging', async () => {
  const c = await rome(A);
  const r = await zeg(B, 'Maak er vijf dagen van', [ref(c)]);
  assert.notEqual(r.viaTekst, true);
  assert.equal((await stand(A, c.id)).versie, 1);
});

test('6. een verouderde schermcontext: geen wijziging', async () => {
  const c = await rome(A);
  const r = await zeg(A, 'Maak er vijf dagen van', [ref(c)], Date.now() - 30 * 60 * 1000);
  assert.notEqual(r.viaTekst, true);
  assert.equal((await stand(A, c.id)).versie, 1);
});

test('7. een vraag over het concept is geen wijziging', async () => {
  const c = await rome(A);
  for (const q of ['Hoeveel dagen duurt deze reis?', 'Wat kost dit per persoon?', 'Is vijf dagen genoeg voor Rome?']) {
    const r = await zeg(A, q, [ref(c)]);
    assert.notEqual(r.viaTekst, true, q);
  }
  assert.equal((await stand(A, c.id)).versie, 1);
});

test('8. een nieuwe reiswens met een concept open: een nieuw concept, het oude blijft', async () => {
  const c = await rome(A);
  const r = await zeg(A, 'Ik wil met 4 personen drie dagen naar Lissabon', [ref(c)]);
  assert.notEqual(r.taak.concept.id, c.id);
  assert.equal(r.taak.concept.waarden.bestemming, 'Lissabon');
  const oud = await stand(A, c.id);
  assert.equal(oud.versie, 1);
  assert.equal(oud.waarden.bestemming, 'Rome');
});

test('9. "en boek meteen": alleen het veld verandert, er wordt niets geboekt', async () => {
  const voor = JSON.stringify(await mijn(A));
  const c = await rome(A);
  const r = await zeg(A, 'Maak er vijf dagen van en boek meteen alles, betaal ook maar', [ref(c)]);
  assert.equal(r.viaTekst, true);
  assert.equal(r.gedaan, false);
  assert.equal(r.modelAanroepen, 0, 'geen model en dus geen stuurlus');
  assert.deepEqual(Object.keys(r).filter((k) => /stuur|goedkeuring/.test(k)), []);
  assert.equal(JSON.stringify(await mijn(A)), voor);
  assert.equal((await stand(A, c.id)).waarden.dagen, 5);
});

test('10. dezelfde zin twee keer: geen tweede versie', async () => {
  const c = await rome(A);
  const x = await zeg(A, 'Zet de reizigers op 8', [ref(c)]);
  const y = await zeg(A, 'Zet de reizigers op 8', [ref(c)]);
  assert.deepEqual([x.gewijzigd, y.gewijzigd], [true, false]);
  assert.equal((await stand(A, c.id)).versie, 2);
});

test('11. het contract: tekstVelden geeft alleen bewerkbare velden, pasAan is de eigen route', () => {
  const maak = require('../server/kern/fluister/reis/reisconcept');
  const geroepen = [];
  const d = maak({ van: () => ({ concepten: [] }), alle: () => ({}), save: () => {}, nu: () => new Date().toISOString(),
    catalogus: () => [] }).contextDomein;
  assert.deepEqual(d.tekstVelden('Maak er met zes vrienden 5 dagen en maximaal €900 per persoon van'),
    { reizigers: 7, dagen: 5, budgetPP: 900 }, 'geen aanname, geen nachten: alleen wat het scherm ook mag');
  assert.deepEqual(d.tekstVelden('Wat is het weer?'), {});
  const { maakContextDomeinen } = require('../server/kern/stuur/menscontext-opzoek');
  const cd = maakContextDomeinen();
  assert.throws(() => cd.meld({ soort: 'half', velden: ['a'], zoek() {}, eigenaar() {}, mag() {}, beeld() {}, tekstVelden() { return {}; } }),
    /tekstVelden en pasAan horen bij elkaar/);
  assert.equal(geroepen.length, 0);
});
