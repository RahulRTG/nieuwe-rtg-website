/* De incheckcode van een Foundation-activiteit (rtfos.activiteit_incheckcode,
   server/kern/rtfos/activiteiten-deur.js). Hij bewijst een inschrijving aan de
   deur, ook van een kind. Elke control uit RELEASEKANDIDAAT.md B9 heeft hier
   een toets die zakt als de control weg is; de mutaties staan onderaan. De
   route met een echte server staat in test/rtfos-uitvoering.test.js.
   Draai los: node --test test/activiteitincheck.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

const OVER30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
function wereld({ crypto = nodeCrypto, wanneer = OVER30, nu } = {}) {
  const kv = { rtfos: JSON.stringify({ codelevenscycli: [], audit: [], activiteiten: [
    { id: 'A1', stad: 'S1', naam: 'Buurtdag', status: 'open', capaciteit: 50, wanneer, inschrijvingen: [] }] }) };
  const bewerk = (sleutel, werk) => {
    const waarde = JSON.parse(kv[sleutel] || '{}');
    const uit = werk(waarde);
    kv[sleutel] = JSON.stringify(waarde);
    return uit;
  };
  const klok = nu || (() => new Date().toISOString());
  const codelevenscyclus = require('../server/kern/codelevenscyclus')({ opslag: () => [], staat: null,
    nu: klok, rid: () => nodeCrypto.randomBytes(4).toString('hex'), crypto: nodeCrypto, save() {}, bewerkCollectie: bewerk });
  let n = 0;
  const ctx = { nu: klok, rid: () => 'r' + (++n), schoon: (t, m) => String(t == null ? '' : t).trim().slice(0, m || 120),
    audit() {}, crypto, codelevenscyclus,
    wieIn: req => ({ key: req.wie }),
    poortIn: (w, stad) => w.key === 'bevoegd' ? { ok: true, stad: { id: stad } } : { status: 403, error: 'geen bevoegdheid' } };
  const ingeschreven = a => a.inschrijvingen.filter(i => ['ingeschreven', 'aanwezig'].includes(i.status));
  const deur = require('../server/kern/rtfos/activiteiten-deur')(ctx, { beeld: a => ({ id: a.id }), ingeschreven,
    wachtlijst: a => a.inschrijvingen.filter(i => i.status === 'wachtlijst'), schuifOp: () => [] });
  const req = { wie: 'bevoegd' };
  const staat = () => JSON.parse(kv.rtfos);
  return { deur, req, kv, staat };
}

test('1. 128 bits, issuer/doel/scope, verval aan het eind van de activiteitsdag, en alleen de hash op schijf', () => {
  const w = wereld();
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  const code = r.inschrijving.checkinCode;
  assert.match(code, /^IN\.[0-9A-F]{32}$/);
  const t = r.inschrijving.toegang;
  assert.equal(t.doel, 'activiteit-incheck');
  assert.deepEqual(t.scope, ['rtfos.activiteit.incheck']);
  assert.equal(t.issuer, 'rtg.rtfos.stad');
  assert.equal(t.max_gebruik, 1);
  assert.ok(Math.abs(Date.parse(t.expires_at) - Date.parse(OVER30 + 'T23:59:59.999Z')) < 5000, 'eind van de activiteitsdag');
  assert.ok(!w.kv.rtfos.includes(code) && !w.kv.rtfos.includes(code.slice(3)), 'de kale code staat niet in de opslag');
});

test('2. eenmalig: een tweede check-in telt niet opnieuw', () => {
  const w = wereld();
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  assert.equal(w.deur.inchecken(w.req, 'A1', r.inschrijving.checkinCode).ok, true);
  const nog = w.deur.inchecken(w.req, 'A1', r.inschrijving.checkinCode);
  assert.equal(nog.alBinnen, true);
  const i = w.staat().activiteiten[0].inschrijvingen[0];
  assert.equal(i.checkin_toegang.gebruik, 1);
});

test('3. een nieuwe code trekt de vorige in', () => {
  const w = wereld();
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  const nieuw = w.deur.nieuweCode(w.req, 'A1', r.inschrijving.id);
  assert.equal(nieuw.ok, true);
  assert.notEqual(nieuw.inschrijving.checkinCode, r.inschrijving.checkinCode);
  assert.equal(w.deur.inchecken(w.req, 'A1', r.inschrijving.checkinCode).status, 404);
  assert.equal(w.deur.inchecken(w.req, 'A1', nieuw.inschrijving.checkinCode).ok, true);
});

test('4. afmelden trekt de code in', () => {
  const w = wereld();
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  w.deur.afmelden(w.req, 'A1', r.inschrijving.id);
  assert.ok(w.staat().activiteiten[0].inschrijvingen[0].checkin_toegang.ingetrokken_at);
});

test('5. verlopen: na de activiteitsdag laat de code niemand meer binnen', () => {
  let t = Date.parse('2099-06-01T10:00:00Z');
  const w = wereld({ wanneer: '2099-06-01', nu: () => new Date(t).toISOString() });
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  t = Date.parse('2099-06-02T00:00:01Z');
  const uit = w.deur.inchecken(w.req, 'A1', r.inschrijving.checkinCode);
  assert.equal(uit.status, 403);
  assert.match(uit.error, /verlopen/);
});

test('6. constant-time: elke inschrijving wordt vergeleken, ook na een treffer', () => {
  let vergeleken = 0;
  const crypto = Object.assign(Object.create(nodeCrypto), {
    timingSafeEqual: (a, b) => { vergeleken++; return nodeCrypto.timingSafeEqual(a, b); } });
  const w = wereld({ crypto });
  const eerste = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-A0' });
  for (let i = 1; i < 6; i++) w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-A' + i });
  vergeleken = 0;
  assert.equal(w.deur.inchecken(w.req, 'A1', eerste.inschrijving.checkinCode).ok, true);
  assert.equal(vergeleken, 6);
});

test('7. een oude kale code wordt niet gehonoreerd, en verdwijnt uit de opslag', () => {
  const w = wereld();
  const s = w.staat();
  s.activiteiten[0].inschrijvingen.push({ id: 'oud', codenaam: 'HV-OUD', status: 'ingeschreven',
    minderjarig: false, oudertoestemming: true, checkinCode: 'IN-ABCDEFG' });
  w.kv.rtfos = JSON.stringify(s);
  assert.equal(w.deur.inchecken(w.req, 'A1', 'IN-ABCDEFG').status, 404);
  assert.ok(!w.kv.rtfos.includes('IN-ABCDEFG'));
});

test('8. zonder bevoegdheid in de stad geen nieuwe code', () => {
  const w = wereld();
  const r = w.deur.inschrijven(w.req, 'A1', { codenaam: 'HV-AAAAA' });
  assert.equal(w.deur.nieuweCode({ wie: 'vreemde' }, 'A1', r.inschrijving.id).status, 403);
});

/* MUTATIES (handmatig, op een schone boom; allemaal zakten ze):
   A1 activiteiten-deur.js: bearer.maak met maxGebruik 1 -> 2 en de aanwezig-
      tak weg                                                        -> toets 2
   A2 activiteiten-deur.js: in geefCode `bearer.intrekken(vorig, ...)` weg en
      de hash van de vorige laten staan (nieuwe toegang niet toekennen) -> toets 3
   A3 activiteiten-deur.js: intrekken in afmelden weg               -> toets 4
   A4 activiteiten-deur.js: `eind` op +90 dagen in plaats van de activiteitsdag
                                                                    -> toets 1 en 5
   A5 activiteiten-deur.js: `break` na de eerste treffer in de zoeklus -> toets 6
   A6 activiteiten-deur.js: de legacy-opruiming in transactie() weg en de
      oude checkinCode laten matchen                                 -> toets 7
   A7 activiteiten-deur.js: poortIn in open() overslaan              -> toets 8 */
