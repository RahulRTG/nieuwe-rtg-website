/* DE DRAGER VAN EEN GENOOTSCHAP (B1, GEMEENSCHAP-FASE0.md par. 4.1) -- de
   module zonder server: kern/genootschap/drager.js en ./drager-regels.js,
   op het echte genootschap (kern/genootschap/index.js) met een db in het
   geheugen. De serverkant staat in test/genootschap-drager-server.test.js.

   Wat hier wordt vastgelegd:
   - de drager is een VERWIJZING: de bron schrijft nooit naar `leden`, en
     `draagOrg` draagt na de hele keten geen enkele ledensleutel;
   - erkennen gebeurt aan de kant van de organisatie en alleen voor een vraag die
     op HAAR staat; een andere stichting ziet hem niet (404);
   - een niet-erkende stichting wordt geweigerd met de reden van het register;
   - geloof en zorg krijgen geen drager (besluit 6), minderjarigen en
     gezinsprofielen komen er niet door een ander in (G5);
   - losmaken laat de groep staan, en een herhaling verandert niets.

   Bij elke toets staat de MUTATIE die hem moet laten zakken; elk daarvan is een
   keer gedraaid en zakte.
   Draai los: node --test test/genootschap-drager.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../server/kern/genootschap/drager-regels');

const VOLWASSEN = new Set(['lid:beh', 'lid:a', 'lid:b']);
const volwassen = (k) => VOLWASSEN.has(k);
const PARTNERS = {
  P1: { id: 'P1', code: 'RTFP-EEN', naam: 'Stichting Een', status: 'actief' },
  P2: { id: 'P2', code: 'RTFP-TWEE', naam: 'Stichting Twee', status: 'goedgekeurd' },
  P3: { id: 'P3', code: 'RTFP-DRIE', naam: 'Stichting Drie', status: 'aangemeld' }
};
// dezelfde regel als partners-portaal.js erkend(): goedgekeurd of actief
function erkendePartner(a) {
  const p = a.code !== undefined ? Object.values(PARTNERS).find(x => x.code === a.code) : PARTNERS[a.id];
  if (!p) return { status: 404, error: 'Deze stichting staat niet in het partnerregister.' };
  if (!['goedgekeurd', 'actief'].includes(p.status)) return { status: 403, error: 'Deze stichting is (nog) niet door de RTFoundation erkend.' };
  return { ok: true, id: p.id, naam: p.naam };
}

function wereld() {
  const db = { data: {} };
  const meldingen = [];
  const notify = (k, m) => meldingen.push({ k, m });
  const genootschap = require('../server/kern/genootschap')({ db, save() {}, codenaamVan: (k) => 'cn-' + k,
    keyVanCodenaam: async (c) => ({ key: String(c).replace(/^cn-/, '') }), notify,
    toelating: R.maakToelating(volwassen) });
  const drager = require('../server/kern/genootschap/drager')({ save() {}, notify, genootschap, volwassen, erkendePartner });
  const sess = (key) => ({ key });
  return { db, genootschap, drager, sess, meldingen };
}

// Zakt bij de mutatie: in drager.js `gr.draagOrg = { soort, ref: p.id, ... }` -> `{ ..., leden: gr.leden }` (de toets op de sleutels zakt).
// Zakt bij de mutatie: een regel `gr.leden.push(...)` of `gr.leden = ...` in drager.js -> de broncontrole zakt.
test('1. de drager is een verwijzing: de bron schrijft nooit naar leden, en draagOrg draagt geen ledensleutel', async () => {
  for (const f of ['drager.js', 'drager-regels.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '../server/kern/genootschap', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(bron, /leden\s*(=[^=]|\.push|\.splice|\.unshift|\.pop|\.shift)/, f + ' schrijft naar leden');
    assert.doesNotMatch(bron, /uitnodigingen\s*(=[^=]|\.push)/, f + ' schrijft naar uitnodigingen');
  }
  const w = wereld();
  const gr = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Leesclub', soort: 'besloten' }).groep;
  await w.genootschap.nodigUit(w.sess('lid:beh'), gr.id, 'cn-lid:a');
  w.genootschap.tredBinnen(w.sess('lid:a'), gr.id);
  const voor = JSON.stringify(w.genootschap.groepMet(gr.id).leden);
  assert.equal(w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P1' }).ok, true);
  assert.equal(w.drager.erken('RTFP-EEN', gr.id).ok, true);
  const g = w.genootschap.groepMet(gr.id);
  assert.equal(JSON.stringify(g.leden), voor, 'de ledenlijst is door de drager veranderd');
  assert.deepEqual(Object.keys(g.draagOrg).sort(), ['at', 'erkendAt', 'erkendDoor', 'gevraagdDoor', 'ref', 'soort', 'stand']);
  assert.doesNotMatch(JSON.stringify({ ...g.draagOrg, gevraagdDoor: null }), /lid:/, 'draagOrg draagt een ledensleutel');
  // de partner ziet naam en stand, geen leden en geen aantal
  const zicht = w.drager.voorPartner('RTFP-EEN');
  assert.deepEqual(Object.keys(zicht.groepen[0]).sort(), ['at', 'groep', 'naam', 'stand']);
  assert.doesNotMatch(JSON.stringify(zicht), /lid:|cn-/);
});

// Zakt bij de mutatie: in drager.js erken() de voorwaarde `d.ref !== p.id` weghalen -> P2 erkent de vraag aan P1.
// Zakt bij de mutatie: in drager.js vraag() de weigering van partner() negeren (`if (!p.ok)` -> `if (false)`) -> P3 komt door.
test('2. alleen de gevraagde, erkende stichting erkent; een niet-erkende wordt geweigerd met de reden', () => {
  const w = wereld();
  const gr = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Wandelclub' }).groep;
  const niet = w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P3' });
  assert.equal(niet.status, 403);
  assert.match(niet.error, /niet door de RTFoundation erkend/);
  assert.equal(w.genootschap.groepMet(gr.id).draagOrg, undefined, 'een weigering liet toch een drager achter');
  assert.equal(w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P9' }).status, 404);
  assert.equal(w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P1' }).ok, true);
  assert.equal(w.drager.erken('RTFP-TWEE', gr.id).status, 404, 'een andere stichting erkent andermans vraag');
  assert.deepEqual(w.drager.voorPartner('RTFP-TWEE').groepen, []);
  assert.equal(w.drager.erken('RTFP-DRIE', gr.id).status, 403, 'een niet-erkende stichting kan erkennen');
  assert.equal(w.drager.erken('RTFP-EEN', gr.id).stand, 'erkend');
  assert.equal(w.drager.erken('RTFP-EEN', gr.id).al, true, 'een tweede erkenning is geen herhaling');
  // de melding gaat naar de beheerder, en een keer
  assert.equal(w.meldingen.filter(m => m.k === 'lid:beh' && /drager/.test(m.m.body)).length, 1);
});

// Zakt bij de mutatie: in drager.js vraag() de toets `isBeheer` weghalen -> een gewoon lid vraagt een drager.
// Zakt bij de mutatie: een soort uit NOG_NIET halen (`zaak`) -> de weigering verliest haar reden.
test('3. vragen is beheerdersschap, en van de vier soorten is alleen de RTF-partner gebouwd', async () => {
  const w = wereld();
  const gr = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Fietsclub', soort: 'openbaar' }).groep;
  w.genootschap.tredBinnen(w.sess('lid:a'), gr.id);
  assert.equal(w.drager.vraag(w.sess('lid:a'), gr.id, { ref: 'P1' }).status, 403);
  assert.equal(w.drager.vraag(w.sess('lid:b'), gr.id, { ref: 'P1' }).status, 404, 'een niet-lid hoort niet te weten dat de groep bestaat');
  for (const soort of ['werkruimte', 'zaak', 'rtfclub']) {
    const r = w.drager.vraag(w.sess('lid:beh'), gr.id, { soort, ref: 'P1' });
    assert.equal(r.status, 400);
    assert.match(r.error, /nog niet gebouwd/);
  }
});

// Zakt bij de mutatie: in drager-regels.js `GEVOELIG.includes(...)` -> `false` -> het gemelde onderwerp zorg komt door.
// Zakt bij de mutatie: GEVOELIGE_WOORDEN leeg maken -> 'Gebedskring' komt door.
test('4. een genootschap over geloof of zorg krijgt geen drager, met de reden van besluit 6', () => {
  const w = wereld();
  const a = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'Gebedskring Noord', over: 'Elke week samen.' }).groep;
  const b = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Dinsdaggroep' }).groep;
  const ra = w.drager.vraag(w.sess('lid:beh'), a.id, { ref: 'P1' });
  assert.equal(ra.status, 409);
  assert.equal(ra.wacht, 'besluit-6');
  assert.match(ra.error, /geloof of zorg/);
  const rb = w.drager.vraag(w.sess('lid:beh'), b.id, { ref: 'P1', onderwerp: 'zorg' });
  assert.equal(rb.status, 409);
  assert.match(rb.error, /besluit 6/);
  // het onderwerp wordt niet opgeslagen: dat zou het art. 9-gegeven zelf zijn
  assert.equal(w.genootschap.groepMet(b.id).onderwerp, undefined);
  assert.equal(w.genootschap.groepMet(b.id).draagOrg, undefined);
  // samenstellingen worden herkend; een gewone groep niet
  assert.equal(R.gevoeligeReden({ naam: 'Het Mantelzorgcafe' }), R.REDEN_GEVOELIG);
  assert.equal(R.gevoeligeReden({ naam: 'De Wandelclub', over: 'Elke zondag een rondje.' }), null);
});

// Zakt bij de mutatie: in drager-regels.js beschermdeReden `volwassen(k) === true ? null` -> `null` -> de minderjarige komt erin.
// Zakt bij de mutatie: in index.js de regel `const w = weiger(gr, doel)` in nodigUit weghalen -> de uitnodiging gaat door.
test('5. in een gedragen genootschap zet niemand een minderjarige of een gezinsprofiel', async () => {
  const w = wereld();
  const gr = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Schaakclub', soort: 'openbaar' }).groep;
  // een minderjarige in een ongedragen groep: de vraag om een drager wacht op G5
  w.genootschap.tredBinnen(w.sess('lid:jong'), gr.id);
  const r = w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P1' });
  assert.equal(r.status, 409);
  assert.equal(r.wacht, 'G5');
  w.genootschap.vertrek(w.sess('lid:jong'), gr.id);
  assert.equal(w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P1' }).ok, true);
  // nu gedragen: uitnodigen en zelf binnenlopen weigeren met de reden
  const nu = await w.genootschap.nodigUit(w.sess('lid:beh'), gr.id, 'cn-lid:jong');
  assert.match(String(nu.error), /18 jaar of ouder/);
  assert.match(String(w.genootschap.tredBinnen(w.sess('lid:jong'), gr.id).error), /18 jaar of ouder/);
  assert.match(String(w.genootschap.tredBinnen(w.sess('rtf:ABC:p1'), gr.id).error), /gezinsprofielen/);
  assert.equal(w.genootschap.tredBinnen(w.sess('lid:a'), gr.id).ok, true, 'een volwassene kan gewoon binnen');
  // zonder poort is het antwoord nee, en een poort die gooit ook
  assert.equal(R.beschermdeReden('lid:a', undefined), R.REDEN_BESCHERMD);
  assert.equal(R.beschermdeReden('lid:a', () => { throw new Error('stuk'); }), R.REDEN_BESCHERMD);
  // in een ONgedragen groep blijft alles zoals het was
  assert.equal(R.maakToelating(volwassen)({ draagOrg: { stand: 'ingetrokken' } }, 'lid:jong'), null);
});

// Zakt bij de mutatie: in drager.js los() `gr.draagOrg.stand = 'ingetrokken'` -> `delete gr.draagOrg` (de geschiedenis is weg).
// Zakt bij de mutatie: in drager.js los() de vroege terugkeer `if (!gedragen(gr))` weghalen -> losAt van de eerste wordt overschreven.
test('6. losmaken laat de groep en haar leden staan; een herhaling overschrijft het eerste niet', async () => {
  const w = wereld();
  const gr = w.genootschap.richtOp(w.sess('lid:beh'), { naam: 'De Tuinclub', soort: 'openbaar' }).groep;
  w.genootschap.tredBinnen(w.sess('lid:a'), gr.id);
  w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P1' });
  w.drager.erken('RTFP-EEN', gr.id);
  assert.equal(w.drager.los(w.sess('lid:a'), gr.id).status, 403, 'een gewoon lid maakt de drager los');
  const eerste = w.drager.los(w.sess('lid:beh'), gr.id);
  assert.equal(eerste.drager.stand, 'ingetrokken');
  const losAt = w.genootschap.groepMet(gr.id).draagOrg.losAt;
  assert.ok(losAt);
  const tweede = w.drager.los(w.sess('lid:beh'), gr.id);
  assert.equal(tweede.al, true);
  assert.equal(w.genootschap.groepMet(gr.id).draagOrg.losAt, losAt);
  assert.equal(w.genootschap.groepMet(gr.id).leden.length, 2, 'de groep verloor leden bij het losmaken');
  assert.equal(w.drager.erken('RTFP-EEN', gr.id).status, 404, 'een ingetrokken vraag is nog te erkennen');
  assert.deepEqual(w.drager.voorPartner('RTFP-EEN').groepen, []);
  // en daarna mag een andere stichting gevraagd worden
  assert.equal(w.drager.vraag(w.sess('lid:beh'), gr.id, { ref: 'P2' }).ok, true);
});
