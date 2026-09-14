/* DE TOELATINGSPROEF -- de derde keten, en wat drie ketens werkelijk delen.

   scripts/toelatingsproef.js legt de toelatingsketen af (aanvraag, bewijs,
   aftekenen, besluit, zaak, herkeuring); scripts/ketenvorm.js telt sinds deze
   proef over DRIE registers in plaats van twee. Dit bestand bewaakt die
   instrumenten en niet de keten zelf -- die draait tegen een wegwerpserver.

   DE SCHERPSTE TOETS IS NUMMER 5. De thema-woordenlijst van ketenvorm.js is
   eenmalig uitgebreid toen zes van de zeven beloften van deze keten er buiten
   vielen. Dat is precies het moment waarop je een overlap kunt FABRICEREN door
   patronen bij te zetten tot alles matcht. De toets eist daarom dat die
   uitbreiding in de bron staat uitgelegd, en dat de ACTOREN niet zijn
   aangepast -- die staan op nul gedeeld, en dat is de uitslag die telt.

   Draai los: node --test test/toelatingsproef.test.js
   De keten zelf: npm run toelatingsproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'toelatingsproef.js'), 'utf8');
const vormBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'ketenvorm.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel, en kent dezelfde twee velden als de andere twee', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/);
  assert.match(bron, /uit\.sluitMetBevinding =/);
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
});

test('1. de proef draait op een wegwerpserver en niet op de ontwikkeldatabase', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
});

test('2. de wereld die de proef klaarzet, staat uitgelegd in de uitslag', () => {
  /* Een keurder met een naam is nodig omdat de kale kantoorcode niet mag
     aftekenen. Dat klaarzetten mag, maar het hoort in het register te staan --
     anders leest een uitslag als "de keten sluit" terwijl hij dat alleen doet
     voor iemand die via zijn eigen account binnenkomt. */
  const u = lees('TOELATINGSPROEF.json');
  assert.ok(u.wereld && u.wereld.keurder && u.wereld.keurder.length > 40,
    'de proef zet een wereld klaar zonder te zeggen welke');
  assert.match(u.wereld.keurder, /kantoorcode/i);
});

test('3. de keten sluit, en de storingen houden hun belofte', () => {
  const u = lees('TOELATINGSPROEF.json');
  assert.ok(u.telling.schakels >= 7, 'minder dan zeven schakels is geen keten maar een route');
  assert.equal(u.telling.stuk, 0);
  assert.equal(u.telling.open, 0);
  assert.equal(u.telling.gebroken, 0, 'een gebroken belofte hoort de proef te laten zakken');
  assert.ok(u.telling.storingen >= 7);
});

test('4. de proef meet ANDERE dingen dan de twee voorgangers', () => {
  /* Een derde keten die dezelfde actoren en dezelfde beloften meet, meet
     hetzelfde nog een keer. Dat was de reden om de bezorging over te slaan. */
  const u = lees('TOELATINGSPROEF.json');
  const actoren = new Set();
  for (const s of u.schakels) { actoren.add(s.van); actoren.add(s.naar); }
  const anders = ['aanvrager', 'kantoor', 'keurder'].filter(a => actoren.has(a));
  assert.equal(anders.length, 3, 'de eigen actoren van deze keten ontbreken');
  assert.ok(actoren.has('tijd'),
    'de enige schakel die door TIJD wordt getrokken en niet door een handeling, ontbreekt');
});

test('5. de woordenlijst is uitgebreid, en dat staat er eerlijk bij', () => {
  /* Het aantal keer dat de lijst is uitgebreid staat in de kop van
     scripts/ketenvorm.js, en het mag groeien -- wat vastligt is dat het ER
     STAAT. Een vast "EEN KEER" zou bij de vierde keten zakken op de eerlijkheid
     in plaats van op het gebrek eraan. */
  assert.match(vormBron, /DE LIJST IS \w+ KEER UITGEBREID/,
    'de themalijst is aangepast zonder dat ergens staat waarom -- dan is de overlap gefabriceerd');
  assert.match(vormBron, /HETZELFDE zegt/, 'de regel waaronder een patroon erbij mag, staat er niet');
  /* Wat NIET is aangepast: de actoren. Dat is de uitslag die telt. */
  const v = lees('KETENVORM.json');
  assert.equal(v.telling.actorenGedeeld, 0,
    'er is nu een actor die alle drie de ketens delen -- dat is een vondst, en die hoort in MAATSTAF.md');
  assert.ok(v.telling.actorenTotaal >= 13);
  /* Er is wel een WOORD dat meerdere ketens delen: `zaak`. Sinds de bundel van
     13 september staat hij in VIER, en in elke keten met een andere rol:

       tafel     -- de horecazaak die BEDIENT        (ontvanger)
       toelating -- de zaak die ONTSTAAT             (uitkomst)
       zaaklive  -- de zaak die AANGAAT              (onderwerp)
       omzet     -- de zaak wier omzet wordt GEBOEKT (subject van de boeken)

     Dat is precies de vorm die SEMANTIEK.json meet: dezelfde naam, meer
     betekenissen. Hij telt daarom niet als gedeelde actor, en het negatief is er
     sterker van geworden in plaats van zwakker -- vier ketens die het woord delen
     en geen van vieren hetzelfde bedoelen, is een beter bewijs dan twee.

     DEZE BEWERING IS EEN WACHTER EN GEEN TELLING. Zij zakt zodra `zaak` in een
     keten opduikt die hier niet staat, want dan moet iemand opnieuw kijken of het
     daar hetzelfde betekent. Een `>= 2` zou dat nooit vragen. */
  const perKeten = v.actoren.perKeten;
  const metZaak = Object.keys(perKeten).filter(k => perKeten[k].includes('zaak'));
  assert.deepEqual(metZaak.sort(), ['omzet', 'tafel', 'toelating', 'zaaklive'],
    'het woord `zaak` staat nu in andere ketens; kijk of het daar hetzelfde betekent');
});

test('6. de ketenvorm telt over ALLE ketens en niet over de eerste twee', () => {
  const v = lees('KETENVORM.json');
  /* AFGELEID EN NIET OVERGETYPT. Hier stond `3`, en bij de vierde keten
     (scripts/adamproef.js) zakte deze toets op het feit dat er een keten BIJ
     was gekomen -- precies andersom dan de bedoeling. De eis is dat het
     register gelijk loopt met de ketenlijst, niet dat het er drie zijn. */
  const { KETENS } = require('../scripts/ketenvorm');
  assert.equal(v.telling.ketens, KETENS.length);
  assert.equal(v.ketens.length, KETENS.length);
  const { zonderCommentaar } = require('../scripts/lib/bron');
  assert.doesNotMatch(zonderCommentaar(vormBron), /gelezen\[1\]/,
    'de meter indexeert nog op de tweede keten; dan telt een derde stil niet mee');
});

test('7. gedeeld is in ALLE ketens, en dat verschilt van "in meer dan een"', () => {
  const v = lees('KETENVORM.json');
  const t = v.beloften.telling;
  const n = require('../scripts/ketenvorm').KETENS.length;
  for (const thema of v.beloften.gedeeld) assert.equal(t[thema], n, thema + ' heet gedeeld maar zit niet in alle ketens');
  for (const thema of v.beloften.bijna) assert.ok(t[thema] > 1 && t[thema] < n, thema + ' staat verkeerd in "bijna"');
  for (const [k, lijst] of Object.entries(v.beloften.eigen))
    for (const thema of lijst) assert.equal(t[thema], 1, thema + ' heet "alleen ' + k + '" en zit in meer ketens');
});

test('8. wat de drie ketens delen, gaat over de machine en niet over het domein', () => {
  /* Dit is het antwoord op MAATSTAF.md U40/U41, en het is een MEETUITSLAG en
     geen wens: zodra er een domeinbegrip in de gedeelde lijst verschijnt, is
     dat een echte vondst en hoort deze toets te zakken zodat iemand kijkt. */
  const v = lees('KETENVORM.json');
  const machine = ['herhaling', 'volgorde', 'onbekendObject', 'weigeringMetReden',
    'nietsKlaarZonderGrond', 'geslotenLijst', 'handelingMetNaam'];
  for (const thema of v.beloften.gedeeld)
    assert.ok(machine.includes(thema),
      'thema "' + thema + '" wordt door alle ketens gedeeld en is geen machine-thema -- kijk of hier een ' +
      'domeincontract onder zit, en werk MAATSTAF.md par. 7.8 bij');
});

test('9. de niet-ingedeelde beloften verdwijnen niet', () => {
  const v = lees('KETENVORM.json');
  assert.ok(Array.isArray(v.beloften.nietIngedeeld), 'de restpost ontbreekt');
  for (const r of v.beloften.nietIngedeeld)
    assert.ok(r.keten && r.storing && r.belofte, 'een niet-ingedeelde belofte zonder herkomst is niet na te lopen');
});
