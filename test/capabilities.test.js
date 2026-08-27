/* DE CAPABILITY-METING -- en of hij werkelijk iets onderscheidt.

   scripts/capabilities.js beantwoordt de vraag uit OS.md par. 2: noemt het
   woord "capability" in dit huis EEN ding, of zijn het homoniemen? Op dat
   antwoord hangt de duurste zin uit de voorgestelde doelarchitectuur ("Everything
   is a Capability, en ze krijgen allemaal hetzelfde contract"), en dus hangt er
   ook een prijskaartje aan een verkeerd antwoord: een grammatica die over acht
   verschillende dingen heen wordt verklaard, duwt alles wat ze onderscheidt naar
   een `extra`-veld. Precies wat DEVELOPERCLOUD.md par. 2 bij `Asset` al vond.

   Een meter die daar "ja, een ding" op zegt terwijl hij eigenlijk zijn eigen
   verpakking telt, is dus erger dan geen meter. Daarom staat hier niet dat hij
   DRAAIT maar dat hij de zes dingen uit elkaar houdt die hem anders om de tuin
   leiden -- en vijf van de zes zijn fouten die deze meter tijdens het bouwen
   ECHT heeft gemaakt:

     1. een lid tegenover een VELD van een lid (`naam` stond in acht lijsten);
     2. de vier schrijfwijzen waarin dit huis zijn leden zet -- een meting die er
        maar een kent, meet opmaak in plaats van inhoud;
     3. een id in commentaar tegenover een echt id;
     4. twee LIJSTEN tegenover twee lijsten uit hetzelfde bestand;
     5. een fabrieksgebouwde lijst, waarvan het contract in de fabriek staat;
     6. en de tegenproef: als er WEL overlap is, ziet hij die dan?

   Die zesde is de belangrijkste. Zonder hem zou "nul overlap" ook groen blijven
   bij een meter die altijd nul zegt, en dan bewijst dit bestand dat een kapotte
   meter goed gebouwd is (LAT-regel 9).

   Draai los: node --test test/capabilities.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../scripts/capabilities');

const WORTEL = path.join(__dirname, '..');
const L = (bestand, naam, leden, blok) => ({ bestand, naam, leden, blok: blok || '{}', bron: '' });

test('1. een LID telt, een VELD van een lid niet', () => {
  /* De fout die deze meter zelf maakte. Platgelezen telden `naam`, `uitleg` en
     `link` mee als leden, en die staan in bijna elke catalogus -- dus vond hij
     verwantschap tussen lijsten die niets delen. */
  const blok = `{
    hotel: { naam: 'Hotel', uitleg: 'Kamers', link: '/apps/reizen.html' },
    villa: { naam: 'Villa', uitleg: 'Fincas', link: '/apps/reizen.html' }
  }`;
  const leden = C.ledenVan(blok);
  assert.deepEqual(leden.sort(), ['hotel', 'villa']);
  assert.ok(!leden.includes('naam'), 'een veld van een lid is geen lid');
  assert.ok(!leden.includes('link'), 'ook niet als het in elke lijst voorkomt');
});

test('2. alle vier de schrijfwijzen leveren hetzelfde lid op', () => {
  /* Dit huis schrijft zijn woordenlijsten op vier manieren. Een meter die er
     maar een kent, verliest juist de best gebouwde lijsten: MACHTIGINGEN is een
     fabriek en de twee CAPS-catalogi gebruiken het id-veld. */
  assert.deepEqual(C.ledenVan(`{ rooms: {} , rides: {} }`).sort(), ['rides', 'rooms']);
  assert.deepEqual(C.ledenVan(`[ { id: 'rooms', naam: 'x' }, { id: 'rides', naam: 'y' } ]`).sort(),
    ['rides', 'rooms']);
  assert.deepEqual(C.ledenVan(`[ M('rooms', 'Kamers', 'geeft'), M('rides', 'Ritten', 'geeft') ]`).sort(),
    ['rides', 'rooms']);
  assert.deepEqual(C.ledenVan(`[ 'rooms', 'rides' ]`).sort(), ['rides', 'rooms']);
});

test('3. een id in commentaar is geen id', () => {
  const bron = [
    'const CAPS = {',
    '  /* hier staat verzonnen: {} in een uitleg */',
    '  echt: { naam: 4 }',
    '};'
  ].join('\n');
  const tijdelijk = path.join(WORTEL, 'server', 'kern', 'zz-capmeting-proef.js');
  assert.equal(fs.existsSync(tijdelijk), false, 'de proef overschrijft nooit een bestaand bestand');
  fs.writeFileSync(tijdelijk, bron);
  try {
    /* zz- valt bewust af (zie GEEN in het script), dus dit toetst de wringer
       rechtstreeks in plaats van via lees(). */
    const zonderCommentaar = bron.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    const blok = zonderCommentaar.slice(zonderCommentaar.indexOf('{'), zonderCommentaar.lastIndexOf('}') + 1);
    const leden = C.ledenVan(blok);
    assert.deepEqual(leden, ['echt']);
    assert.ok(!leden.includes('verzonnen'), 'een id in commentaar telt niet mee');
  } finally { fs.unlinkSync(tijdelijk); }
});

test('4. twee lijsten uit HETZELFDE bestand vormen geen paar', () => {
  /* kern/lidboard/catalogus.js draagt CAPS en PAD_FUNCTIE, en die lijken op
     elkaar (0,53) omdat de tweede een KAART van de eerste is. Wie dat als bewijs
     van gedeelde betekenis telt, meet zijn eigen bestandsindeling. */
  const zelfde = C.analyse([
    L('server/kern/x.js', 'CAPS', ['a', 'b', 'c', 'd']),
    L('server/kern/x.js', 'CAP_PAD', ['a', 'b', 'c', 'd'])
  ]);
  assert.equal(zelfde.gelijkendeParen, 0, 'zelfde bestand -> geen paar');
  assert.equal(zelfde.maxGelijkenis, 0, 'en ook niet stiekem via de hoogste gelijkenis');

  const anders = C.analyse([
    L('server/kern/x.js', 'CAPS', ['a', 'b', 'c', 'd']),
    L('server/kern/y.js', 'CAP_PAD', ['a', 'b', 'c', 'd'])
  ]);
  assert.equal(anders.gelijkendeParen, 1, 'twee bestanden -> wel een paar');
  assert.equal(anders.maxGelijkenis, 1, 'identieke lijsten uit twee bestanden zijn 1,00');
});

test('5. het contract van een FABRIEK wordt gelezen, ook in verkorte schrijfwijze', () => {
  /* De duurste blinde vlek van deze meter. MACHTIGINGEN schrijft zijn leden als
     M(...) en de velden staan in `const M = (id, label, geeft, nooit, risico,
     doelen) => ({ id, label, ... })` -- met ES6-verkorting, dus zonder dubbele
     punt. Over het blok alleen gemeten kwam de lijst met het VOLSTE contract op
     nul uit, en dan had de meter precies de lijst doodverklaard die het antwoord
     op punt 7 is. */
  const bron = "const M = (id, label, geeft, nooit, risico, doelen) => ({ id, label, geeft, nooit, risico, doelen: doelen || [] });";
  const blok = "[ M('profiel.basis', 'Wie je bent'), M('opslag.eigen', 'Eigen opslag') ]";
  const zonder = C.contractVan(blok, '');
  const met = C.contractVan(blok, bron);
  assert.ok(met.length > zonder.length, 'de fabriek meelezen levert meer op dan hem negeren');
  assert.ok(met.includes('risico'), 'risico staat in de fabriek en hoort gezien te worden');
  assert.ok(met.includes('grens'), '`nooit` is de grens, en die is het punt van deze lijst');
  assert.ok(met.includes('doel'), 'het doel is waar het lid werkelijk op beslist');
});

test('6. DE TEGENPROEF: overlap die er WEL is, wordt gezien', () => {
  /* Zonder deze zou "nul overlap" ook groen blijven bij een meter die altijd
     nul zegt (LAT-regel 9: een toets die niet kan zakken is slechter dan geen
     toets). Twee lijsten die drie van hun vier leden delen, MOETEN opvallen. */
  const r = C.analyse([
    L('server/kern/a.js', 'CAPS', ['delen1', 'delen2', 'delen3', 'eigenA']),
    L('server/kern/b.js', 'RECHTEN', ['delen1', 'delen2', 'delen3', 'eigenB'])
  ]);
  assert.equal(r.woordenlijsten, 2);
  assert.equal(r.ledenInMeer, 3, 'drie leden staan in twee lijsten');
  assert.equal(r.ledenInEen, 2, 'en twee in precies een');
  assert.equal(r.gelijkendeParen, 1);
  assert.ok(r.maxGelijkenis >= 0.5, 'gelijkenis 3/5 = 0,6 hoort ruim boven de drempel te liggen');
  assert.equal(r.gedeeldeLeden[0].lijsten, 2);
  assert.ok(r.gedeeldeLeden[0].waar.length === 2, 'en er staat bij WAAR hij vandaan komt');
});

test('7. de zeef laat alleen vermogenslijsten door', () => {
  const r = C.analyse([
    L('server/kern/a.js', 'CAPS', ['a', 'b', 'c']),
    L('server/kern/b.js', 'KLEUREN', ['a', 'b', 'c']),
    L('server/kern/c.js', 'TARIEVEN', ['a', 'b', 'c'])
  ]);
  assert.equal(r.woordenlijsten, 1, 'KLEUREN en TARIEVEN gaan niet over mogen-en-kunnen');
  assert.equal(r.ledenInMeer, 0, 'en tellen dus ook niet mee in de overlap');
});

test('8. de echte meting draait, en klopt met wat er is vastgelegd', () => {
  /* Dezelfde afspraak als test/objectmodel.test.js: het vastgelegde bestand is
     een afdruk en geen tweede waarheid. Loopt hij uiteen, dan is er iets aan de
     code veranderd en hoort de afdruk opnieuw gezet te worden -- met de hand,
     zodat het een besluit is (LAT-regel 4). */
  const r = C.meet();
  assert.ok(r.woordenlijsten >= 10, 'er zijn vermogenslijsten gevonden (' + r.woordenlijsten + ')');
  assert.ok(r.leden >= 100, 'en die dragen leden (' + r.leden + ')');

  const pad = path.join(WORTEL, 'CAPABILITEIT.json');
  assert.ok(fs.existsSync(pad), 'CAPABILITEIT.json bestaat -- draai: npm run capabilities:vast');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  /* ALLE getallen uit de afdruk, en niet een handvol. Hier stonden er vijf, en
     daardoor kon een verouderde afdruk erdoor: het toevoegen van een enkele
     kernmodule verschoof `bekeken` en `kandidaten` zonder dat iets klaagde. Een
     afdruk die maar half wordt vergeleken, is een afdruk die half achterloopt. */
  for (const sleutel of ['woordenlijsten', 'leden', 'ledenInEen', 'ledenInEenPct',
    'maxGelijkenis', 'bekeken', 'kandidaten', 'gelijkendeParen']) {
    assert.equal(r[sleutel], vast[sleutel],
      'CAPABILITEIT.json loopt achter op "' + sleutel + '" (' + vast[sleutel] + ' vastgelegd, ' +
      r[sleutel] + ' gemeten) -- draai: npm run capabilities:vast');
  }
});

test('9. de uitkomst die OS.md par. 2 draagt, staat er ook echt', () => {
  /* LAT-regel 6: een belofte in tekst is een belofte in code. OS.md par. 2 doet
     twee harde beweringen op grond van deze meter. Als een van beide kantelt,
     hoort dit te zakken en niet het document stilletjes onwaar te worden. */
  const r = C.meet();
  assert.ok(r.ledenInEenPct >= 80,
    'OS.md par. 2 zegt dat de overgrote meerderheid van de leden in EEN lijst woont; ' +
    'gemeten: ' + r.ledenInEenPct + '%');
  assert.equal(r.gelijkendeParen, 0,
    'OS.md par. 2 zegt dat geen twee vermogenslijsten op elkaar lijken; ' +
    'gemeten: ' + r.gelijkendeParen + ' paren');
  assert.ok(r.volledigsteContract && r.volledigsteContract.draagt.length < 8,
    'OS.md par. 4 zegt dat GEEN lijst het volle contract draagt; ' +
    'de volste is ' + (r.volledigsteContract || {}).lijst);
});
