/* Ronde: de offertebouwer -- een prijs die is opgebouwd in plaats van bedacht.

   Vijf beweringen:

   1. EEN REGEL UIT HET EIGEN AANBOD HAALT ZIJN PRIJS DAARVANDAAN. Wie zijn
      tarief verhoogt, hoeft dat niet in elke offerte na te lopen.
   2. EEN DIENST DIE NIET BESTAAT WORDT NOOIT STIL OVERGESLAGEN. Dan denkt de
      ondernemer dat zijn tarief in de offerte staat terwijl er iets anders
      staat -- of niets.
   3. DE SOM IS DEZELFDE ALS DIE VAN DE FACTUUR. Eén functie (kern/regelsom.js),
      want een offerte van 1.000 euro die een factuur van 999,99 oplevert, is
      een cent waar niemand antwoord op heeft.
   4. DE OFFERTESTROOM BLIJFT DE ENIGE SCHRIJVER. De bouwer is puur: hij leest
      de zaak en rekent; het wegschrijven blijft waar het stond.
   5. ALLEEN EEN PRIJS MAG NOG STEEDS. Een klus van een uur is soms gewoon een
      bedrag; dat is geen tijdelijke tolerantie maar een echt geval.

   Draai los: node --experimental-sqlite --test test/onderneming-offertebouw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const OB = require('../server/kern/onderneming/offertebouw');
const REGELSOM = require('../server/kern/regelsom');

const zaak = (over) => Object.assign({
  code: 'GLAS', name: 'Glasheldere Ramen', type: 'zzp',
  services: [
    { id: 'uur', name: 'Uurtarief glazenwassen', price: 60 },
    { id: 'hoog', name: 'Hoogwerker per dag', price: 250 },
    { id: 'gratis', name: 'Kennismaking', price: 0 }
  ]
}, over || {});

/* ---------------- uit het eigen aanbod ---------------- */

test('een regel uit het eigen aanbod haalt zijn prijs uit het aanbod', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 4 }]);
  assert.equal(uit.ok, true);
  assert.equal(uit.regels[0].stuk, 60, 'niet wat de aanvrager meestuurt, maar wat de zaak vraagt');
  assert.equal(uit.regels[0].aantal, 4);
  assert.equal(uit.totaal, 240);
  assert.equal(uit.regels[0].omschrijving, 'Uurtarief glazenwassen');
  assert.equal(uit.regels[0].bron, 'dienst');
});

test('een meegestuurde prijs kan het eigen tarief niet overschrijven', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 1, stuk: 5 }]);
  assert.equal(uit.totaal, 60,
    'anders bepaalt de aanvrager van het verzoek wat de zaak voor haar werk vraagt');
});

test('een tariefverhoging werkt door zonder dat er een offerte wordt nagelopen', () => {
  const s = zaak();
  const voor = OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }]).totaal;
  s.services[0].price = 75;
  const na = OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }]).totaal;
  assert.equal(voor, 120);
  assert.equal(na, 150, 'de prijs komt uit het aanbod en staat niet in de regel overgetypt');
});

/* ---------------- weigeren in plaats van stil overslaan ---------------- */

test('een dienst die niet bestaat wordt geweigerd, niet overgeslagen', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 1 }, { dienstId: 'bestaat-niet' }]);
  assert.equal(uit.status, 404);
  assert.ok(uit.error.includes('staat niet in uw aanbod'));
  assert.equal(uit.ok, undefined, 'en er komt geen half resultaat uit: dat zou een te lage offerte zijn');
});

test('een dienst zonder prijs wordt geweigerd met de reden', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'gratis', aantal: 1 }]);
  assert.equal(uit.status, 409);
  assert.ok(uit.error.includes('geen prijs'));
});

test('een losse regel heeft een prijs en een omschrijving nodig', () => {
  assert.equal(OB.offerteBouw(zaak(), [{ omschrijving: 'Materiaal' }]).status, 400);
  assert.equal(OB.offerteBouw(zaak(), [{ stuk: 40 }]).status, 400,
    'een bedrag zonder reden leest de klant als willekeur');
  assert.equal(OB.offerteBouw(zaak(), [{ omschrijving: 'Materiaal', stuk: 40 }]).ok, true);
});

test('een offerte zonder regels is geen offerte', () => {
  assert.equal(OB.offerteBouw(zaak(), []).status, 400);
  assert.equal(OB.offerteBouw(zaak(), null).status, 400);
  const teveel = Array.from({ length: OB.MAX_REGELS + 1 }, () => ({ omschrijving: 'X', stuk: 1 }));
  assert.equal(OB.offerteBouw(zaak(), teveel).status, 400);
});

/* ---------------- de som ---------------- */

test('de btw wordt teruggerekend uit een stukprijs inclusief btw', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'hoog', aantal: 1 }]);
  assert.equal(uit.totaal, 250);
  assert.equal(uit.btwStandaard, 21);
  assert.equal(uit.subtotaal, 206.61, '250 / 1,21');
  assert.equal(Math.round((uit.subtotaal + uit.btwBedrag) * 100) / 100, 250,
    'subtotaal plus btw is precies het totaal');
});

test('een horecazaak rekent met het lage tarief', () => {
  const uit = OB.offerteBouw(zaak({ type: 'restaurant' }), [{ omschrijving: 'Buffet', stuk: 109 }]);
  assert.equal(uit.btwStandaard, 9);
  assert.equal(uit.subtotaal, 100);
  assert.equal(uit.btwBedrag, 9);
});

test('twee tarieven in een offerte blijven twee tarieven', () => {
  const uit = OB.offerteBouw(zaak({ type: 'restaurant' }), [
    { omschrijving: 'Buffet', stuk: 109 },
    { omschrijving: 'Zaalhuur', stuk: 121, btw: 21 }
  ]);
  assert.equal(uit.regels[0].btw, 9);
  assert.equal(uit.regels[1].btw, 21);
  assert.equal(uit.subtotaal, 200, '100 plus 100');
  assert.equal(uit.totaal, 230);
});

test('de bouwer rekent met dezelfde som als de factuurmotor', () => {
  const regels = [{ omschrijving: 'A', aantal: 3, stuk: 33.33, btw: 21 },
    { omschrijving: 'B', aantal: 1, stuk: 19.99, btw: 9 }];
  const viaBouwer = OB.offerteBouw(zaak(), regels);
  const viaSom = REGELSOM.verwerkRegels(regels, 21);
  assert.equal(viaBouwer.totaal, viaSom.totaal);
  assert.equal(viaBouwer.subtotaal, viaSom.subtotaal);
  assert.equal(viaBouwer.btwBedrag, viaSom.btwBedrag);

  const motor = require('fs').readFileSync('server/kern/facturatie/motor.js', 'utf8');
  assert.ok(motor.includes("require('../regelsom')"),
    'en de factuurmotor rekent hem ook daar: een offerte die anders afrondt dan de factuur is onuitlegbaar');
});

test('het lage-btw-lijstje is hetzelfde als dat van de facturatie', () => {
  const F = require('fs').readFileSync('server/kern/facturatie.js', 'utf8');
  const m = F.match(/const LAAG_BTW_TYPES = \[([^\]]*)\]/);
  const daar = m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean).sort();
  assert.deepEqual(OB.LAAG_BTW_TYPES.slice().sort(), daar,
    'twee lijsten die uiteenlopen geven een offerte met een ander tarief dan de factuur');
});

/* ---------------- de offertestroom blijft de schrijver ---------------- */

test('de bouwer schrijft niets: hij leest de zaak en rekent', () => {
  const s = zaak();
  const voor = JSON.stringify(s);
  OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }, { omschrijving: 'Materiaal', stuk: 30 }]);
  assert.equal(JSON.stringify(s), voor, 'de zaak is onaangeroerd');

  const bron = require('fs').readFileSync('server/kern/onderneming/offertebouw.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron), 'en er wordt nergens bewaard');
  assert.ok(!/vakOffertes/.test(bron), 'de offertestroom blijft de enige die offertes bijwerkt');
});

test('de offertestroom bouwt de prijs op en laat de opbouw meereizen', () => {
  const bron = require('fs').readFileSync('server/kern/vakwerk/pro.js', 'utf8');
  assert.ok(bron.includes('OFFERTEBOUW.offerteBouw'), 'antwoorden loopt langs de bouwer');
  assert.ok(bron.includes('regels: o.regels'), 'en de klant ziet de regels, niet alleen het bedrag');
  assert.ok(bron.includes("if (!opbouw.ok) return opbouw;"),
    'een fout uit de bouwer stopt het antwoord in plaats van een half bedrag neer te zetten');
});

test('alleen een prijs opgeven mag nog steeds', () => {
  const bron = require('fs').readFileSync('server/kern/vakwerk/pro.js', 'utf8');
  assert.ok(bron.includes('bouw hem op uit regels'),
    'en de melding noemt allebei de wegen');
  assert.ok(/o\.regels = opbouw \? opbouw\.regels : null;/.test(bron),
    'zonder regels blijft het veld leeg in plaats van een verzonnen enkele regel te dragen');
});
