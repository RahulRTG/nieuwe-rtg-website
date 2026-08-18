/* DE UITROLREGIE -- de trap vanzelf op, en bij tegenwind vanzelf een tree terug.

   Deze toets draait op de motor zelf, met een nagebootste meting en een
   verzette klok. Dat is met opzet: de twee dingen die deze motor moeilijk maken
   zijn TIJD (een trede moet zich een half uur houden) en het FOUTPERCENTAGE, en
   allebei zijn ze met een echte server niet af te dwingen zonder te wachten of
   moedwillig te slopen.

   Wat hier bewust zwaar wordt aangezet: de MENSREM. Dat de regie op een groene
   meting NIET doorklimt naar `ontmoeten` en `fundament` is geen detail maar de
   reden dat deze automaat mag bestaan. GELD.md en LIFE.md staan geen automaat
   toe op geld en op het kanaal tussen twee mensen.

   Draai los: node --test test/uitrolregie.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maakUitrolregie } = require('../server/kern/command/uitrolregie');
const functies = require('../server/functies');

/* Een opstelling met een nepdatabase, een nepmeting en een klok aan een touwtje. */
function maak(opts) {
  const db = { data: {} };
  let t = Date.parse('2026-08-18T09:00:00.000Z');
  let antwoorden = 0, fouten = 0;
  const gezet = [];
  const meting = { reeksen: () => ({ verzoeken: [
    { methode: 'POST', route: '/api/x', status: '2xx', aantal: antwoorden - fouten },
    { methode: 'POST', route: '/api/x', status: '5xx', aantal: fouten }
  ] }) };
  const schakelFase = (id, door) => { gezet.push(id); return { ok: true, aan: 1, uit: 1 }; };
  const regie = maakUitrolregie({ db, save: () => {}, meting, functies, schakelFase, nu: () => t });
  return {
    regie, db, gezet,
    verkeer(n, f) { antwoorden += n; fouten += (f || 0); },
    verzet(ms) { t += ms; },
    tijd: () => t,
    ...(opts || {})
  };
}

const RUST = 30 * 60000 + 1000;

test('zonder trede klimt de regie niet -- hij opent geen dichte kast uit zichzelf', () => {
  const o = maak();
  const r = o.regie.klim('proef');
  assert.equal(r.status, 409);
  assert.match(r.error, /Zet eerst een trede/);
});

test('een trede zetten legt een nulmeting vast en boekt het', () => {
  const o = maak();
  o.verkeer(1000, 5);
  const r = o.regie.zet('start', 'proef');
  assert.equal(r.ok, true);
  assert.equal(r.trede, 'start');
  const s = o.regie.stand();
  assert.equal(s.trede, 'start');
  assert.equal(s.geschiedenis[0].naar, 'start');
  // de fouten van VOOR de trede tellen niet mee
  assert.equal(s.oordeel.fouten, 0, 'de nulmeting hoort het verleden buiten te sluiten');
});

test('hij klimt pas als er genoeg gemeten is EN de trede zich heeft gehouden', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');

  o.verkeer(50, 0);                       // te weinig
  assert.equal(o.regie.stand().oordeel.stand, 'onvoldoende gemeten');
  assert.equal(o.regie.stand().trede, 'start', 'blijft staan');

  o.verkeer(500, 0);                      // genoeg, maar nog niet uitgerust
  assert.equal(o.regie.stand().oordeel.stand, 'nog niet uitgerust');
  assert.equal(o.regie.stand().trede, 'start');

  o.verzet(RUST);                         // nu wel
  const s = o.regie.stand();
  assert.equal(s.zojuist, 'wacht-op-mens', 'de volgende trede is ontmoeten, en die heeft de mensrem');
});

/* ------------------------------- DE MENSREM ------------------------------- */

test('DE MENSREM: op groen klimt hij NIET door naar ontmoeten', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');
  o.verkeer(1000, 0);                     // smetteloos
  o.verzet(RUST);

  const s = o.regie.stand();
  assert.equal(s.trede, 'start', 'hij staat nog op start');
  assert.equal(s.stand, 'wacht-op-mens');
  assert.equal(s.volgende.id, 'ontmoeten');
  assert.equal(s.volgende.mens, true);
  assert.match(s.reden, /LIFE\.md|mens|moderatie/i, 'en hij zegt waarom');

  // ook na nog meer groen blijft hij staan
  o.verkeer(5000, 0); o.verzet(RUST);
  assert.equal(o.regie.stand().trede, 'start', 'geen enkel cijfer opent deze trede');
});

test('DE MENSREM: ook geld gaat niet vanzelf open', () => {
  const o = maak();
  o.regie.zet('bestellen', 'proef');
  o.regie.klim('proef');
  o.verkeer(2000, 0);
  o.verzet(RUST);

  const s = o.regie.stand();
  assert.equal(s.trede, 'bestellen');
  assert.equal(s.stand, 'wacht-op-mens');
  assert.equal(s.volgende.id, 'fundament');
  assert.match(s.reden, /geld/i, 'de reden noemt het geld');
});

test('een mens bevestigt, en dan klimt hij weer vanzelf verder', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');
  o.verkeer(1000, 0); o.verzet(RUST);
  assert.equal(o.regie.stand().stand, 'wacht-op-mens');

  const na = o.regie.bevestig('roel');
  assert.equal(na.trede, 'ontmoeten', 'de bevestigde trede is gezet');
  assert.equal(na.stand, 'klimt', 'en de automaat loopt weer');

  // van ontmoeten naar partners mag wel vanzelf
  o.verkeer(1000, 0); o.verzet(RUST);
  assert.equal(o.regie.stand().trede, 'partners', 'partners heeft geen mensrem');
});

test('bevestigen kan niet als er niets te bevestigen valt', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  assert.equal(o.regie.bevestig('roel').status, 409);
});

/* -------------------------------- ZAKKEN --------------------------------- */

test('over de drempel: hij zakt een tree en stopt met klimmen', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');
  o.verkeer(1000, 0); o.verzet(RUST);
  o.regie.bevestig('roel');                       // nu op ontmoeten
  assert.equal(o.regie.stand().trede, 'ontmoeten');

  o.verkeer(1000, 80);                            // 8% serverfouten
  const s = o.regie.stand();
  assert.equal(s.trede, 'start', 'teruggezakt naar de vorige trede');
  assert.equal(s.stand, 'gestopt', 'en hij klimt niet uit zichzelf verder');
  assert.match(s.reden, /teruggezakt/);
});

test('zakken mag OOK als de regie niet klimt -- een rem die alleen omhoog werkt is een klem', () => {
  const o = maak();
  o.regie.zet('partners', 'proef');
  // let op: geen klim(); de regie staat stil
  assert.equal(o.regie.stand().stand, 'stil');
  o.verkeer(1000, 100);
  const s = o.regie.stand();
  assert.equal(s.trede, 'ontmoeten', 'toch een tree omlaag');
  assert.equal(s.stand, 'gestopt');
});

test('op de smalste trede valt niet verder te zakken, en dat zegt hij', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.verkeer(1000, 100);
  const s = o.regie.stand();
  assert.equal(s.trede, 'start');
  assert.equal(s.stand, 'gestopt');
  assert.match(s.reden, /smalste trede/);
});

/* ---------------------------- DE NULMETING ------------------------------- */

test('een herstart wist de nulmeting, en dan klimt hij NIET', () => {
  const o = maak();
  o.verkeer(5000, 0);
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');
  o.verzet(RUST);

  // de tellers beginnen opnieuw: minder verkeer dan de nulmeting
  o.db.data.techniek.uitrol.basis = { antwoorden: 999999, fouten: 0 };

  const s = o.regie.stand();
  assert.equal(s.oordeel.stand, 'nulmeting kwijt');
  assert.equal(s.trede, 'start', 'een onbekende is geen groen');
  assert.equal(s.oordeel.klimbaar, false);
  assert.equal(s.oordeel.zakbaar, false, 'en ook geen reden om te zakken');
});

test('pauzeren houdt hem stil, ook op groen', () => {
  const o = maak();
  o.regie.zet('start', 'proef');
  o.regie.klim('proef');
  o.regie.pauze('roel', 'even niet');
  o.verkeer(1000, 0); o.verzet(RUST);
  const s = o.regie.stand();
  assert.equal(s.trede, 'start');
  assert.equal(s.stand, 'stil');
  assert.equal(s.reden, 'even niet');
});

test('de trap is uit: boven aangekomen stopt hij vanzelf', () => {
  const o = maak();
  o.regie.zet('alles', 'proef');
  o.regie.klim('proef');
  o.verkeer(1000, 0); o.verzet(RUST);
  const s = o.regie.stand();
  assert.equal(s.trede, 'alles');
  assert.equal(s.stand, 'stil');
  assert.match(s.reden, /trap is uit/);
});

test('de trap in de stand toont waar je bent en wat er nog komt', () => {
  const o = maak();
  o.regie.zet('partners', 'proef');
  const s = o.regie.stand();
  const hier = s.trap.find(t => t.hier);
  assert.equal(hier.id, 'partners');
  assert.equal(s.trap.filter(t => t.gehad).length, 3, 'start, ontmoeten en partners zijn gehad');
  assert.deepEqual(s.trap.filter(t => t.mens).map(t => t.id), ['ontmoeten', 'fundament'],
    'precies twee treden dragen de mensrem');
});

test('een onbekende trede weigert netjes', () => {
  const o = maak();
  assert.equal(o.regie.zet('bestaatniet', 'proef').status, 404);
});
