/* DE LEVENDE GETALLEN IN DE DOCUMENTEN (scripts/getallen.js).

   Een meetgetal in proza veroudert stil. CLAUDE.md en CREATE.md noemden maanden
   lang "115 beproefd, 2959 ongemeten" terwijl IDEMPROEF.json al op 845/2247
   stond -- geen fout die iets laat zakken, wel een cijfer waarop besloten wordt.
   ARCHITECTUUR.md en BEWIJS.md lossen dat op door helemaal gegenereerd te zijn;
   dat kan niet met een document dat een redenering draagt. Vandaar merktekens om
   het getal heen, en deze toets eromheen.

   DE TOETS DOET DRIE DINGEN, en het derde is het makkelijkst te vergeten:
     1 elk getal in een document is gelijk aan zijn register;
     2 elk merkteken hangt aan een register-ingang die bestaat en leesbaar is;
     3 elke register-ingang wordt ergens GEBRUIKT -- een ingang die nergens staat,
       is een belofte dat iets bewaakt wordt terwijl er niets bewaakt wordt.

   WAT HIJ NIET KAN: een getal zonder merktekens ziet hij niet. Deze laag lost
   dus niet op dat iemand morgen een los cijfer intypt; hij lost op dat de
   cijfers die we kennen vanzelf meelopen. Daarom zakt hij ook op NUL merktekens:
   een meter die niets vindt, hoort niet groen te zijn (LAT.md regel 3). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ronde, GETALLEN, DOCUMENTEN } = require('../scripts/getallen');

const R = ronde({ schrijf: false });

test('0. de meter meet iets: er staan merktekens in de documenten', () => {
  assert.ok(R.merktekens > 0,
    'nul merktekens -- dan bewaakt deze laag niets en zou groen een leugen zijn');
  assert.ok(DOCUMENTEN.length > 0);
});

test('1. elk getal in een document is gelijk aan zijn register', () => {
  const oud = R.bevindingen.filter(b => b.soort === 'verouderd');
  assert.deepEqual(oud.map(b => b.doc + ' :: ' + b.id + ' -- ' + b.wat), [],
    'verouderd getal in de documenten. Draai: npm run getallen');
});

test('2. elk merkteken hangt aan een bruikbare bron', () => {
  const stuk = R.bevindingen.filter(b => b.soort !== 'verouderd');
  assert.deepEqual(stuk.map(b => b.doc + ' :: ' + b.id + ' -- ' + b.wat), [],
    'merkteken zonder register-ingang of met een onleesbare bron');
});

test('3. geen dode register-ingangen: elk levend getal staat ergens', () => {
  assert.deepEqual(R.ongebruikt, [],
    'register-ingang die nergens in een document staat: ' + R.ongebruikt.join(', ') +
    ' -- dat is een belofte dat iets bewaakt wordt terwijl er niets bewaakt wordt');
});

test('4. elke ingang zegt WAT hij betekent, zodat een lezer het merkteken begrijpt', () => {
  for (const [id, reg] of Object.entries(GETALLEN)) {
    assert.ok(reg.bron && reg.veld, id + ' mist bron of veld');
    assert.ok(reg.wat && reg.wat.length > 10, id + ' heeft geen uitleg van wat het getal betekent');
  }
});

test('5. de controlestand vindt een verouderd getal ook echt', () => {
  /* Zelfijking: zou de vergelijking altijd waar zijn, dan zou toets 1 nooit
     kunnen zakken en bewaakte deze suite niets (LAT.md regel 9). */
  const fs = require('node:fs');
  const path = require('node:path');
  const doc = path.join(__dirname, '..', DOCUMENTEN[0]);
  const origineel = fs.readFileSync(doc, 'utf8');
  const eerste = Object.keys(GETALLEN).find(id => origineel.includes('<!--getal:' + id + '-->'));
  assert.ok(eerste, 'geen merkteken om de zelfijking op te doen');
  const kapot = origineel.replace(new RegExp('<!--getal:' + eerste.replace(/\./g, '\\.') + '-->[^<]*<!--\\/getal-->'),
    '<!--getal:' + eerste + '-->999999<!--/getal-->');
  try {
    fs.writeFileSync(doc, kapot);
    const r = ronde({ schrijf: false });
    assert.ok(r.bevindingen.some(b => b.soort === 'verouderd' && b.id === eerste),
      'een met opzet verkeerd getal werd NIET opgemerkt -- de meter is stuk');
  } finally {
    fs.writeFileSync(doc, origineel);
  }
});
