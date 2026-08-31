/* DE EERSTE APPS VAN RTG ZELF -- komen ze door hun eigen poort?

   Deze bundels staan in storeapps/ en zijn bedoeld om de App Store te vullen.
   Ze krijgen geen streepje voor: grens 1 kent geen vertrouwde uitgever, dus ze
   gaan langs dezelfde machinepoort als de app van een derde.

   Wat deze toets vastlegt: het manifest is geldig, de bundel komt door de poort
   ZONDER bevindingen, en hij past ruim binnen het budget. Een bundel die dat
   niet haalt, hoort niet als "onze eerste app" in de repo te staan -- dan is de
   inzending een verrassing voor de mens die hem moet aftekenen.

   Draai los: node --test test/appstore-eersteapps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { keur, BUDGET } = require('../server/kern/appstore/keuring');
const { lees } = require('../server/kern/appstore/manifest');
const { bereik } = require('../server/kern/appstore/bereik');

const WORTEL = path.join(__dirname, '..', 'storeapps');
const APPS = fs.existsSync(WORTEL)
  ? fs.readdirSync(WORTEL).filter(d => fs.statSync(path.join(WORTEL, d)).isDirectory()) : [];

test('er staat ten minste een eigen app klaar', () => {
  assert.ok(APPS.length > 0, 'storeapps/ is leeg');
});

for (const naam of APPS) {
  test('storeapps/' + naam + ' komt door zijn eigen poort', () => {
    const dir = path.join(WORTEL, naam);
    const m = lees(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')));
    assert.deepEqual(m.fouten, [], 'het manifest wordt geweigerd');

    const bestanden = fs.readdirSync(dir).filter(f => f !== 'manifest.json')
      .map(f => ({ pad: f, buf: fs.readFileSync(path.join(dir, f)) }));
    /* De ECHTE scanner, en niet een die altijd schoon zegt: zonder scanner gaat
       de poort dicht, en een toets die dat omzeilt toetst de poort niet. */
    const antivirus = require('../server/kern/antivirus')({});
    const k = keur({ bestanden, manifest: m.manifest, antivirus });
    assert.equal(k.scan, 'uitgevoerd');
    assert.deepEqual(k.bevindingen, [], 'de poort vond iets');
    assert.equal(k.door, true);

    assert.ok(k.maten.totaal < BUDGET.totaal, 'de bundel is te groot');
    assert.ok(k.maten.script < BUDGET.script, 'te veel scriptcode');

    /* En het startbestand bestaat werkelijk. Een manifest dat naar een bestand
       wijst dat er niet is, komt door de vormcontrole en valt pas om in de
       browser van een lid. */
    assert.ok(fs.existsSync(path.join(dir, m.manifest.start)), 'het startbestand ontbreekt');

    /* De bereikklasse hoort te kloppen met wat hij vraagt -- hij wordt gerekend,
       dus dit is een controle op de bundel en niet op de rekensom. */
    const b = bereik(m.manifest.machtigingen);
    assert.equal(b.bruggen, m.manifest.machtigingen.length);
  });
}
