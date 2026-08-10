/* De overnamemodus (kern/command/overname.js): de administratie van een
   overgenomen bedrijf inlezen.

   WAT DEZE TOETS VOORAL BEWAAKT zijn de drie manieren waarop een migratie stil
   misgaat:

   1. JE KEURT HET ENE RAPPORT GOED EN IMPORTEERT IETS ANDERS. Daarom draagt de
      droogloop een zegel over de rijen én de afbeelding, en weigert uitvoeren
      zodra dat zegel niet meer past.
   2. DE OVERGENOMEN ADMINISTRATIE OVERSCHRIJFT STILLETJES DE ONZE. Een sleutel
      die hier al bestaat is een BOTSING en geen bijwerking; achteraf is anders
      niet meer te zien welke waarde van wie kwam.
   3. TERUGDRAAIEN NEEMT TE VEEL MEE. Elke ingevoerde rij draagt zijn partij,
      dus terug() haalt precies die rijen weg en geen enkele andere. De toets
      zet er bewust een rij naast die van ons is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de zegelcontrole in voer() weggelaten
     -> "uitvoeren kan alleen met het zegel van de bekeken droogloop" ZAKT (RAAK)
   - botsende sleutels laten overschrijven in plaats van overslaan
     -> "een bestaande sleutel is een botsing en geen bijwerking" ZAKT (RAAK)
   - terug() de hele collectie laten legen in plaats van op partij
     -> "terugdraaien raakt alleen de rijen van deze partij" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegister } = require('../server/kern/command/register');
const { maakOvername } = require('../server/kern/command/overname');

const REGISTER = maakRegister([
  { type: 'zaak', label: 'Zaak', meervoud: 'zaken', domein: 'handel',
    collectie: 'suppliers', sleutel: 'code', zoek: ['code'], titel: r => r.name }
]);

function maak() {
  const db = { data: { suppliers: [{ code: 'ONS-1', name: 'Van onszelf' }] } };
  const regels = [];
  const overname = maakOvername({ db, save: () => {}, crypto,
    journaal: { noteer: r => regels.push(r) }, register: REGISTER });
  return { db, overname, regels };
}

const RIJEN = [
  { ID: 'HUN-1', Naam: 'Hun eerste zaak' },
  { ID: 'HUN-2', Naam: 'Hun tweede zaak' },
  { ID: 'ONS-1', Naam: 'Botst met de onze' },
  { ID: 'HUN-2', Naam: 'Twee keer dezelfde' },
  { Naam: 'Zonder sleutel' }
];

function tot(overname, stap) {
  const r = overname.lees('Overgenomen keten', 'zaak', RIJEN, 'ik');
  if (stap === 'lees') return r;
  overname.beeldAf(r.partij.id, { code: 'ID', name: 'Naam' }, 'ik');
  if (stap === 'afbeelden') return r;
  const d = overname.droogloop(r.partij.id);
  return { partij: r.partij, voorstel: r.voorstel, droog: d };
}

test('het voorstel is gemeten, en juist daarom een vermoeden', () => {
  /* DIT GEVAL LAAT ZIEN WAAROM EEN MENS BEVESTIGT. De meting klopt: `Naam` is
     overal gevuld en overal uniek, `ID` niet (HUN-2 staat er twee keer en één
     rij heeft er geen). Dus stelt de meter `Naam` voor als sleutel -- keurig
     gerekend en het verkeerde antwoord. Zou deze laag zelf besluiten, dan stond
     de administratie er straks in met de naam als code. */
  const { overname } = maak();
  const r = tot(overname, 'lees');
  assert.equal(r.voorstel.onzeSleutel, 'code');
  assert.equal(r.voorstel.voorstel.code, 'Naam', 'de meting wijst Naam aan');
  const id = r.voorstel.hunVelden.find(v => v.veld === 'ID');
  assert.equal(id.uniek, false, 'en ID valt af omdat hij niet overal gevuld en uniek is');
  assert.match(r.voorstel.let, /VERMOEDEN/, 'daarom staat er met zoveel woorden dat dit geen vaststelling is');
});

test('afbeelden zonder onze sleutel kan niet', () => {
  const { overname } = maak();
  const r = tot(overname, 'lees');
  assert.equal(overname.beeldAf(r.partij.id, { name: 'Naam' }, 'ik').status, 400);
  assert.equal(overname.droogloop(r.partij.id).status, 409, 'en droogloop wil eerst een afbeelding');
});

test('de droogloop noemt elke rij die niet meekomt, met de reden', () => {
  const { db, overname } = maak();
  const { droog } = tot(overname);
  assert.equal(droog.rapport.aangeboden, 5);
  assert.equal(droog.rapport.erin, 2, 'HUN-1 en HUN-2 gaan erin');
  assert.equal(droog.rapport.mis, 3);
  const redenen = droog.rapport.misVoorbeelden.map(m => m.waarom).join(' | ');
  assert.match(redenen, /bestaat hier al/);
  assert.match(redenen, /twee keer in deze partij/);
  assert.match(redenen, /geen sleutel/);
  assert.equal(db.data.suppliers.length, 1, 'en een droogloop raakt niets aan');
});

test('uitvoeren kan alleen met het zegel van de bekeken droogloop', () => {
  const { db, overname } = maak();
  const { partij, droog } = tot(overname);
  assert.equal(overname.voer(partij.id, 'iets-anders', 'ik').status, 409);
  assert.equal(db.data.suppliers.length, 1, 'er is niets ingevoerd');

  const v = overname.voer(partij.id, droog.rapport.zegel, 'ik', 'overname keten');
  assert.equal(v.erin, 2);
  assert.equal(db.data.suppliers.length, 3);
  assert.equal(overname.voer(partij.id, droog.rapport.zegel, 'ik').status, 409, 'twee keer kan niet');
});

test('een partij die na de droogloop verandert, gaat er niet in', () => {
  /* DE KERN. Zonder deze controle keur je een keurig rapport goed en importeer
     je iets anders. Hier veranderen de RIJEN terwijl het rapport blijft staan,
     want dat is het gemene geval: het zegel is dan het enige verschil. */
  const { db, overname } = maak();
  const { partij, droog } = tot(overname);
  db.data.overnames[partij.id].rijen.push({ ID: 'STIEKEM', Naam: 'Er later bij gezet' });

  const r = overname.voer(partij.id, droog.rapport.zegel, 'ik');
  assert.equal(r.status, 409);
  assert.match(r.error, /veranderd sinds de droogloop/);
  assert.equal(db.data.suppliers.length, 1, 'en er is niets ingevoerd');

  /* En een nieuwe afbeelding gooit het rapport weg: dat is een nieuwe proef. */
  const r2 = overname.beeldAf(partij.id, { code: 'ID' }, 'ik');
  assert.equal(r2.partij.rapport, null);
  assert.equal(overname.voer(partij.id, droog.rapport.zegel, 'ik').status, 409);
});

test('een bestaande sleutel is een botsing en geen bijwerking', () => {
  const { db, overname } = maak();
  const { partij, droog } = tot(overname);
  overname.voer(partij.id, droog.rapport.zegel, 'ik', 'overname');
  const ons = db.data.suppliers.filter(x => x.code === 'ONS-1');
  assert.equal(ons.length, 1, 'onze rij staat er nog precies één keer');
  assert.equal(ons[0].name, 'Van onszelf', 'en met onze eigen naam, niet die van hen');
  assert.equal(ons[0].overnameBatch, undefined, 'onze rij draagt geen partijmerk');
});

test('terugdraaien raakt alleen de rijen van deze partij', () => {
  const { db, overname, regels } = maak();
  const { partij, droog } = tot(overname);
  overname.voer(partij.id, droog.rapport.zegel, 'ik', 'overname');
  assert.equal(db.data.suppliers.length, 3);

  const t = overname.terug(partij.id, 'ik');
  assert.equal(t.weg, 2);
  assert.deepEqual(db.data.suppliers.map(x => x.code), ['ONS-1'],
    'onze eigen rij blijft staan');
  assert.ok(regels.some(r => r.actie === 'overname teruggedraaid'), 'en het staat in het journaal');
  assert.equal(overname.terug(partij.id, 'ik').status, 404, 'twee keer terug kan niet');
});

test('onbekende soort, lege partij en te grote partij worden geweigerd', () => {
  const { overname } = maak();
  assert.equal(overname.lees('x', 'onzin', RIJEN, 'ik').status, 404);
  assert.equal(overname.lees('x', 'zaak', [], 'ik').status, 400);
  const veel = Array.from({ length: 5001 }, (_, i) => ({ ID: 'R' + i }));
  const groot = overname.lees('x', 'zaak', veel, 'ik');
  assert.equal(groot.status, 400);
  assert.match(groot.error, /niet meer kunt nalopen/);
});
