/* DE WEKKERMETER -- en of hij werkelijk iets onderscheidt.

   scripts/wekkers.js telt wat werk kan beginnen zonder dat iemand een pad
   opvraagt: een klok, een busabonnee, een webhook. De tredeproef bewijst de
   HTTP-kant; dit is wat daarnaast staat, en het is de gevaarlijkste vorm van
   "uit" -- het ziet er dicht uit en het draait.

   Zo'n meter kan op twee manieren liegen, en ze wijzen tegengesteld:

     TE HOOG   door een gat te melden dat er niet is. Dat deed hij ook: de
               koppeling keek alleen naar de DOMEINEN van een envelop, en een
               routebestand is een `ingang:`-knoop die daar per definitie niet
               in staat. Zeven route-bestanden met een timer heetten daardoor
               ongeschakeld terwijl ze de functie dragen waar hun routes bij
               horen. Toets 1.
     TE LAAG   door de restpost weg te verklaren. De bus en de database horen
               niet aan een functieschakelaar; een wekker die wel bij een
               functie hoort, verklaar je niet weg maar geef je een functie.
               Toets 3.

   Draai los: node --test test/wekkers.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../scripts/wekkers');

const env = (id, domeinen, ophangbestanden = []) => ({ id, domeinen, ophangbestanden });

test('1. een routebestand wordt gevonden via zijn OPHANGBESTAND', () => {
  /* De fout die deze meter maakte. Een ingang staat nooit in de domeinenlijst
     van een envelop, dus alleen daarop matchen meldt zeven gaten die er niet
     zijn. */
  const envelopen = [env('supplier', ['domein:horeca'], ['server/routes/supplier.js'])];
  assert.deepEqual(W.functiesVoorBestand('server/routes/supplier.js', envelopen), ['supplier']);
});

test('2. een kernbestand wordt gevonden via zijn DOMEIN', () => {
  const envelopen = [env('member', ['domein:gewoonten'], ['server/routes/member.js'])];
  assert.deepEqual(W.functiesVoorBestand('server/kern/gewoonten/index.js', envelopen), ['member']);
  assert.deepEqual(W.functiesVoorBestand('server/kern/vonk/index.js', envelopen), [],
    'en een bestand dat in geen enkele envelop zit, hoort leeg terug te komen');
});

test('3. de patronen zijn smal en dragen alle drie een naam', () => {
  /* Een patroon dat alles vangt, meldt honderden wekkers die er geen zijn, en
     dan wordt de lijst weggekeken. Deze toets houdt vast dat elk patroon een
     soort en een uitleg draagt, en dat ze op de echte vorm passen. */
  assert.ok(W.PATRONEN.length >= 2);
  for (const p of W.PATRONEN) {
    assert.ok(p.soort && p.wat, 'elk patroon draagt een soort en een uitleg');
    assert.ok(p.rx instanceof RegExp);
  }
  const klok = W.PATRONEN.find(p => p.soort === 'KLOK');
  assert.ok('  timer = setInterval(veeg, 30000);'.match(klok.rx), 'de klok herkent een echte setInterval');
  assert.ok(!'const setIntervalNaam = 1;'.match(new RegExp(klok.rx.source)),
    'en niet een naam die er alleen op lijkt');
});

test('4. de verklaringen dragen allemaal een reden', () => {
  /* Een verklaringenlijst zonder redenen is een skiplijst, en die groeit tot de
     meter niets meer meet. */
  const lijst = require('../scripts/lib/wekker-verklaringen');
  assert.ok(lijst.length, 'de lijst bestaat');
  for (const v of lijst) {
    assert.match(v.bestand, /^server\//, 'een verklaring wijst een echt bestand aan: ' + v.bestand);
    assert.ok(v.reden && v.reden.length > 25, 'en legt uit waarom: ' + v.bestand);
  }
});
