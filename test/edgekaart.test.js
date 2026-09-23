/* DE EDGEKAART LOOPT NIET ACHTER, EN ZE KAN ZAKKEN (EDGE.md par. 0 en 7).

   scripts/edgekaart.js legt vast wie in de Edge-lagen schrijft, beslist en leest,
   en welke rtg-gebeurtenissen nergens aankomen. Een kaart die niet meer bij de
   code past is erger dan geen kaart: hij wordt geloofd. Deze toets houdt drie
   dingen vast:

   1. elk citaat in de verklaring staat LETTERLIJK in zijn bestand;
   2. het ingecheckte register is wat de code vandaag oplevert (behalve de
      stempel) -- anders loopt EDGEKAART.json achter;
   3. elke dubbele eigenaar draagt een verklaring, en elke verklaring hoort bij
      een dubbele eigenaar.

   DE MUTATIES, elk nagetrokken: verander een letter in een citaat van de
   verklaring (toets 1 zakt en noemt het bestand), voeg in een scherm een
   dispatchEvent van een nieuwe rtg-gebeurtenis toe zonder de kaart te draaien
   (toets 2 zakt), en haal een WAAROM-regel weg (toets 3 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const kaart = require('../scripts/edgekaart.js');

const REGISTER = path.join(__dirname, '..', 'EDGEKAART.json');

test('elk citaat van de verklaring staat letterlijk in zijn bestand', () => {
  assert.deepEqual(kaart.keur(), []);
  /* En de grendel kan zakken: een citaat dat er niet staat, wordt gemeld. */
  const rij = kaart.KAART[0], oud = rij[3][0][2];
  rij[3][0][2] = oud + ' /* bestaat niet */';
  try {
    const f = kaart.keur();
    assert.equal(f.length, 1);
    assert.match(f[0], /citaat staat er niet/);
  } finally { rij[3][0][2] = oud; }
});

test('EDGEKAART.json is wat de code vandaag oplevert', () => {
  const oud = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  delete oud.stempel;
  const vers = kaart.bouw();
  assert.equal(JSON.stringify(vers), JSON.stringify(oud), 'EDGEKAART.json loopt achter op de code. Draai: npm run edgekaart');
});

test('elke dubbele eigenaar is verklaard, en elke verklaring hoort bij een dubbele eigenaar', () => {
  const r = kaart.bouw();
  assert.ok(r.dubbeleEigenaars.length > 0, 'de kaart hoort de meting te dragen');
  assert.deepEqual(r.dubbeleEigenaars.filter((d) => !d.waarom).map((d) => d.naam), []);
  assert.deepEqual(Object.keys(kaart.WAAROM).filter((n) => !r.dubbeleEigenaars.some((d) => d.naam === n)), []);
  assert.equal(r.telling.dodeKanalen, r.dodeKanalen.luisterZonderZender.length + r.dodeKanalen.zendZonderLuisteraar.length);
});
