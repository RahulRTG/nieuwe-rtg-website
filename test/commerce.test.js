/* DE COMMERCE-METING -- en of hij werkelijk iets onderscheidt.

   scripts/commerce.js beantwoordt de vraag uit COMMERCE.md par. 1: bestaat het
   voorgestelde KOOPBAAR-protocol in de domeinen, of wordt het eroverheen
   verklaard? Op die uitslag rust een besluit over een commerce-laag boven
   dertien domeinen, dus een meter die "ja" zegt terwijl hij verpakking telt, is
   erger dan geen meter.

   Vijf van de zeven toetsen hieronder komen uit een fout die dit script
   werkelijk maakte:

     3. `serveer` in de lever-familie slikte elke RESERVEER. Daardoor haalde
        kern/mobiliteit alle acht werkwoorden, met lever en reserveer bewezen
        door dezelfde functie `pendelReserveer` -- valse volledigheid, precies
        wat deze meter hoort te ontmaskeren.
     4. de patronen ankerden op het BEGIN van de naam, en toen miste
        `maakTeruggave` het werkwoord retour terwijl dat bestand juist het
        teruggaverecht uitvoert.
     5. `if (...) {` werd als functienaam geteld.
     6. de optelling eiste de vermenigvuldiging BINNEN de reduce, en miste
        daarmee de gewone schrijfwijze: regelbedrag uitrekenen bij het bouwen,
        daarna de regels optellen.
     7. twee bestanden van hetzelfde domein golden als twee domeinen.

   Draai los: node --test test/commerce.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/commerce');

const V = (module, velden) => ({ module, velden });
const F = (module, namen) => ({ module, namen });
/* De envelopdrempel als ABSOLUUT getal: in een voorbeeld van drie domeinen is
   "in drie domeinen is verpakking, in twee niet" niet als deel uit te drukken,
   en juist dat onderscheid wordt hier getoetst. In de echte meting blijft het
   een deel; zie de kop van het script. */
const KLEIN = { envelopVanaf: 3, gelijkenis: 0.6 };
const doe = (vormen, functies, optellingen) =>
  C.analyse({ vormen, functies: functies || [], optellingen: optellingen || [] }, null, KLEIN);

test('1. een vorm met een prijs telt, een vorm zonder prijs niet', () => {
  const bron = [
    'const artikel = { id: id(), naam: naam, prijs: 12, voorraad: 3 };',   // koopbaar
    'const rij = { id: id(), naam: naam, status: "open", door: wie };',    // geen bedrag
    'const opties = { prijs: 1, stil: true };'                             // te weinig velden
  ].join('\n');
  const vormen = C.vormenVan(bron);
  assert.equal(vormen.length, 1, 'alleen de vorm met een prijs EN vier velden telt');
  assert.ok(vormen[0].includes('voorraad'));
});

test('2. een veldnaam in commentaar of in een string is geen veld', () => {
  const bron = [
    '/* hier stond ooit { id, prijs, korting, geheimVeld } in de uitleg */',
    'const t = "{ id: 1, prijs: 2, anderGeheim: 3, nog: 4 }";',
    'const echt = { id: id(), prijs: 5, aantal: 2, sku: s };'
  ].join('\n');
  const velden = C.vormenVan(bron).flat();
  assert.ok(velden.includes('sku'), 'de echte vorm wordt wel gelezen');
  assert.ok(!velden.includes('geheimVeld'), 'commentaar telt niet mee');
  assert.ok(!velden.includes('anderGeheim'), 'een string telt niet mee');
});

test('3. reserveren is niet leveren -- RESERVEER bevat SERVEER', () => {
  assert.equal(C.WERKWOORDEN.reserveer.test('pendelReserveer'), true);
  assert.equal(C.WERKWOORDEN.lever.test('pendelReserveer'), false,
    'zonder de lookbehind telt elk reserverend domein als een leverend domein');
  assert.equal(C.WERKWOORDEN.lever.test('serveerGang'), true, 'echt serveren telt wel');

  const r = doe(
    [V('server/kern/a/x.js', ['id', 'prijs', 'aantal', 'sku'])],
    [F('server/kern/a/x.js', ['pendelReserveer'])]
  );
  assert.equal(r.perWerkwoord.reserveer, 1);
  assert.equal(r.perWerkwoord.lever, 0, 'een domein dat alleen reserveert, levert niet');
});

/* De derde meterfout van dezelfde soort. `legApart` in kern/retail/klant.js
   haalt een variant uit de vrije verkoop, houdt hem vast op de sleutel van een
   klant en laat hem na drie dagen vervallen; de regel erboven zegt zelf
   "gereserveerd = uit de vrije verkoop". De meter zag dat niet, en zette
   kern/retail daardoor op 3 van 8 terwijl het domein wel degelijk reserveert.

   DE TOETS NOEMT DE ECHTE FUNCTIE. Een toets op het woord `apart` zou blijven
   staan als iemand `legApart` hernoemt, en dan meet de regel niets meer. */
test('3b. apart leggen IS reserveren (legApart in kern/retail)', () => {
  assert.equal(C.WERKWOORDEN.reserveer.test('legApart'), true);
  assert.equal(C.WERKWOORDEN.reserveer.test('mijnApart'), true);

  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server/kern/retail/klant.js'), 'utf8');
  assert.match(bron, /function legApart\b/,
    'de functie waarop deze regel rust, hoort te bestaan -- anders meet het patroon lucht');
  assert.match(bron, /gereserveerd = uit de vrije verkoop/,
    'en hij hoort nog steeds voorraad uit de vrije verkoop te halen');

  /* En hij verbreedt niets anders: `apart` hoort geen tweede werkwoord te raken. */
  for (const [naam, re] of Object.entries(C.WERKWOORDEN)) {
    if (naam === 'reserveer') continue;
    assert.equal(re.test('legApart'), false, naam + ' hoort apart leggen niet te claimen');
  }
});

test('4. een werkwoord telt ook met een voorvoegsel ervoor (maakTeruggave)', () => {
  const r = doe(
    [V('server/kern/appstore/x.js', ['id', 'prijs', 'bruto', 'afdracht'])],
    [F('server/kern/appstore/x.js', ['maakTeruggave', 'rechtDoe'])]
  );
  assert.equal(r.perWerkwoord.retour, 1,
    'dit huis schrijft maakX/zetX/doeX; een anker vooraan meet de schrijfgewoonte');
});

test('5. sleutelwoorden zijn geen functienamen', () => {
  const namen = C.functiesVan('const o = { if (x) { doe(); }, echt(a) { return a; } };');
  assert.ok(!namen.includes('if'), 'if is geen functie');
  assert.ok(namen.includes('echt'), 'een echte methode wordt wel gevonden');
});

test('6. een regelbedrag buiten de reduce telt ook als optelling', () => {
  const { isOptelling } = require('../scripts/commerce');
  // de gewone schrijfwijze: bedrag bij het bouwen, som daarna
  assert.equal(isOptelling('const r = { totaalCenten: centen * aantal };'), true);
  assert.equal(isOptelling('const t = regels.reduce((a, r) => a + r.totaalCenten, 0);'), true);
  // geen bedrag in zicht: een plattegrond is geen afrekening
  assert.equal(isOptelling('const breed = vakken * aantal;'), false);
  // wel een bedrag, maar niets dat op regels rekent
  assert.equal(isOptelling('const prijs = 12;'), false);
});

test('7. twee bestanden van EEN domein zijn geen twee domeinen', () => {
  const gedeeld = ['id', 'prijs', 'sku', 'maat', 'kleur', 'voorraad'];
  const zelfde = doe([
    V('server/kern/retail/assortiment.js', gedeeld),
    V('server/kern/retail/vloer.js', gedeeld)
  ]);
  assert.equal(zelfde.gemeten.koopbareDomeinen, 1);
  assert.equal(zelfde.gemeten.gelijkendeVormparen, 0,
    'bestanden die ooit zijn gesplitst omdat ze over de 10 kB gingen, delen geen type');

  const anders = doe([
    V('server/kern/retail/assortiment.js', gedeeld),
    V('server/kern/mall/catalogus.js', gedeeld)
  ]);
  assert.equal(anders.gemeten.koopbareDomeinen, 2);
  assert.equal(anders.gemeten.gelijkendeVormparen, 1, 'twee echte domeinen wel');
});

test('8. gedeelde VERPAKKING is geen gedeeld type', () => {
  /* Vier domeinen die alleen id/naam/prijs/at delen. Met envelopVanaf 3 valt
     dat alle vier weg als verpakking, en dan houdt geen enkel paar iets over. */
  const envelop = ['id', 'naam', 'prijs', 'at'];
  const r = doe([
    V('server/kern/a/x.js', envelop), V('server/kern/b/x.js', envelop),
    V('server/kern/c/x.js', envelop), V('server/kern/d/x.js', envelop)
  ]);
  assert.equal(r.gemeten.envelop, 4, 'alle vier de velden staan in 3+ domeinen');
  assert.equal(r.gemeten.gelijkendeVormparen, 0,
    'vier rijen in een database zijn geen vier exemplaren van een type');
});

test('9. de uitslag die ertoe doet: geen werkwoord dat ALLE domeinen hebben', () => {
  /* Drie domeinen die elk iets anders kunnen -- de vorm van de echte uitslag.
     `overalAanwezig` hoort dan leeg te zijn, en dat is het getal waarop het
     besluit in COMMERCE.md par. 2 rust. */
  const r = doe(
    [V('server/kern/a/x.js', ['id', 'prijs', 'sku', 'maat']),
      V('server/kern/b/x.js', ['id', 'prijs', 'gang', 'station']),
      V('server/kern/c/x.js', ['id', 'prijs', 'kamer', 'nachten'])],
    [F('server/kern/a/x.js', ['toonAlles', 'bezorgOrder']),
      F('server/kern/b/x.js', ['toonKaart', 'reserveerTafel']),
      F('server/kern/c/x.js', ['annuleerBoeking'])]
  );
  assert.equal(r.gemeten.koopbareDomeinen, 3);
  assert.deepEqual(r.overalAanwezig, [], 'geen enkel werkwoord staat in alle drie');
  assert.equal(r.gemeten.werkwoordenVolledig, 0);
  assert.equal(r.gemeten.werkwoordCombinaties, 3, 'drie domeinen, drie verschillende combinaties');

  /* En de tegenproef: zetten we er WEL een gedeeld werkwoord in, dan ziet de
     meter dat ook. Anders zou toets 9 slagen op een meter die nooit iets vindt. */
  const wel = doe(
    [V('server/kern/a/x.js', ['id', 'prijs', 'sku', 'maat']),
      V('server/kern/b/x.js', ['id', 'prijs', 'gang', 'station'])],
    [F('server/kern/a/x.js', ['toonAlles']), F('server/kern/b/x.js', ['toonKaart'])]
  );
  assert.deepEqual(wel.overalAanwezig, ['toon']);
});
