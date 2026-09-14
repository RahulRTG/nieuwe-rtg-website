/* ============================================================================
   DE DOCTRINECOMPILER ZELF -- kan hij zakken?

   scripts/doctrine.js telt harde uitspraken in de doctrine-documenten. Zo'n
   teller heeft een faalvorm die van buiten niet te zien is: hij vindt niets en
   staat groen, precies zoals een scanner die alles vindt. Deze toets is de
   ratel eronder (scripts/lib/metingen.js noemt hem als `eigenRatel`).

   ELKE BEWERING HIER IS EEN MUTATIE GEZIEN ZAKKEN, en die staat er per toets bij
   -- LAT.md regel 2: een toets die je niet hebt zien zakken is geen toets.

   Draai los: node --test test/doctrine.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const D = require('../scripts/doctrine.js');

/* MUTATIE GEZIEN ZAKKEN: in zelfijking() de tweede helft weggehaald (de zin
   zonder signaalwoord); toets 1 bleef groen -- daarom eist hij hieronder ook
   dat de ijking BEIDE kanten controleert, en niet alleen de vangst. */
test('1. de zelfijking van de compiler slaagt, en hij ijkt twee kanten', () => {
  const uitslag = D.zelfijking();
  assert.equal(uitslag.ok, true, 'de compiler vindt een geplante zin niet: ' + (uitslag.waarom || ''));

  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/doctrine.js'), 'utf8');
  assert.match(bron, /een zin zonder signaalwoord werd toch een kandidaat/,
    'de ijking hoort ook te controleren dat een gewone zin GEEN kandidaat wordt; ' +
    'zonder die kant is een scanner die alles vindt ook groen');
});

/* MUTATIE GEZIEN ZAKKEN: sluitAlinea() bij een lege regel weggehaald, zodat de
   alinea's aan elkaar plakken; deze toets zakte op de zinslengte. En andersom:
   de alinea-samenvoeging eruit (regel voor regel lezen) -> zakte op "eindigt op
   een leesteken", want de markdown breekt af op ongeveer 76 tekens. */
test('2. een kandidaat is een hele zin en geen afgebroken regel', () => {
  const { stukken } = D.leesDocument('FOUNDATION.md');
  /* Alleen de WOORDas: een kop of een vette openingszin eindigt van nature niet
     op een leesteken, en die eis daarop leggen zou de structuuras slopen. */
  const kandidaten = stukken.filter(s => {
    if (s.as !== 'woord') return false;
    const sig = D.signaalVan(s.zin, s.inGrenssectie);
    return sig && sig.sterkte === 'sterk';
  });
  const structuur = stukken.filter(s => s.as === 'structuur');
  assert.ok(structuur.length >= 5, 'FOUNDATION.md heeft koppen die zelf een bewering zijn (5.2 t/m 5.7); ' +
    'vindt de structuuras er minder dan vijf, dan leest hij geen koppen meer');
  for (const s of structuur) {
    assert.doesNotMatch(s.zin, /^[\d.]+\s/, 'het paragraafnummer hoort niet in de kandidaattekst: ' + JSON.stringify(s.zin));
  }
  assert.ok(kandidaten.length >= 5, 'FOUNDATION.md draagt zeven grenzen; minder dan vijf kandidaten ' +
    'betekent dat de lezer stuk is, niet dat het document leeg is');

  for (const k of kandidaten) {
    assert.match(k.zin, /[.!?:]["'»)]?$/,
      'deze kandidaat eindigt midden in een zin, dus de alinea is niet samengevoegd: ' + JSON.stringify(k.zin.slice(-60)));
    assert.ok(k.zin.length < 700, 'deze kandidaat is zo lang dat er alinea\'s aan elkaar geplakt zijn: ' +
      JSON.stringify(k.zin.slice(0, 80)));
  }
});

/* MUTATIE GEZIEN ZAKKEN: `nooit` van STERK_IN_GRENSSECTIE naar STERK verplaatst;
   deze toets zakte op de tweede bewering, en het totaal sprong van 1088 naar
   1786 kandidaten -- de meting die de eerste versie onbruikbaar maakte. */
test('3. de context beslist mee: `nooit` is binnen een grenssectie sterk en daarbuiten niet', () => {
  const zin = 'De bijdrage-spiegel is nooit vergelijkend en toont geen enkel percentiel aan een ander lid.';
  const binnen = D.signaalVan('De eenheid van meting is de taak, nooit de persoon.', true);
  const buiten = D.signaalVan('Dat is nooit goed gegaan in de oude opzet.', false);

  assert.equal(binnen.sterkte, 'sterk', 'in een grenssectie kondigt `nooit` een grens aan');
  assert.equal(buiten.sterkte, 'zwak', 'buiten een grenssectie is `nooit` een bijwoord; telt hij daar ' +
    'als sterk, dan groeit deze lijst met gewoon schrijfwerk en leest niemand hem meer');
  assert.equal(D.signaalVan(zin, false).sterkte, 'sterk',
    '`geen enkel` is een verbodsvorm en telt overal, ook buiten een grenssectie');
});

/* MUTATIE GEZIEN ZAKKEN: in ankersPerKop() de kop-toewijzing vervangen door
   `kaart.set(0, ...)`; zakte op "LEVEN.md wijst zijn eigen wetten aan". */
test('4. een wet wordt herkend op de PLEK van zijn anker, niet op zijn woorden', () => {
  const { wetten } = require('../WETTEN.json');
  const leven = wetten.filter(w => w.bron && w.bron.bestand === 'LEVEN.md');
  assert.ok(leven.length >= 2, 'LEVEN.md hoort wetten in het register te hebben');

  const kaart = D.ankersPerKop('LEVEN.md', leven);
  const gevonden = [...kaart.values()].flat();
  assert.ok(gevonden.length >= 2,
    'geen van de LEVEN-wetten is aan een kop gekoppeld; dan heet elke kandidaat onbepaald ' +
    'en leest dat als "het register kent de doctrine niet" terwijl de koppeling stuk is');

  /* De ankers staan ALLEMAAL letterlijk in hun document (nagemeten op
     13 september 2026, 50 van 50). Valt er een weg, dan is dat een echte
     bevinding en niet een tekort van deze toets -- scripts/wetten.js --controle
     meldt hem apart. */
  for (const w of leven) {
    const tekst = fs.readFileSync(path.join(WORTEL, 'LEVEN.md'), 'utf8');
    assert.ok(tekst.includes(w.bron.anker),
      'het anker van wet ' + w.id + ' staat niet meer in LEVEN.md: ' + JSON.stringify(w.bron.anker));
  }
});

/* MUTATIE GEZIEN ZAKKEN: `graad` in de uitslag op 'gemeten' gezet; zakte hier.
   Een lexicale telling die zich gemeten noemt, is de schijnzekerheid waar
   BESTUUR.md voor is gebouwd. */
test('5. het register draagt zijn graad en zijn grens, en telt zichzelf niet als dekking', () => {
  const pad = path.join(WORTEL, 'DOCTRINE.json');
  if (!fs.existsSync(pad)) {
    assert.fail('DOCTRINE.json ontbreekt; draai `npm run doctrine`. Een ontbrekend register is ' +
      'geen groen: niet-gemeten mag nooit als in orde langskomen');
  }
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));
  assert.equal(j.graad, 'vermoed', 'deze meting leest woorden en geen betekenis; elke hardere graad is een bewering');
  assert.match(j.grens, /LEXICAAL EN STRUCTUREEL/, 'de grens van de meting hoort in het register zelf te staan');
  /* De oude eis was het woord ONDERGRENS. Die is vervangen door een strengere:
     sinds de ijking bestaat is de RECALL gemeten (48 van 50) en de PRECISIE
     niet, en juist dat verschil hoort een lezer te weten. Een register dat 96%
     recall meldt en zwijgt over precisie, laat "96%" lezen als kwaliteit. */
  assert.match(j.grens, /PRECISIE is niets gemeten/,
    'het register hoort te zeggen dat over de precisie niets is vastgesteld');
  assert.match(j.grens, /nooit worden opgeteld/,
    'dat de twee assen niet optelbaar zijn, hoort in het register zelf te staan');

  /* Een kandidaat is geen wet. Zou dit register een stand `wet` kunnen zetten,
     dan promoveert een woordenlijst een besluit -- en dan is WETTEN.json niet
     langer de plek waar een mens de wet vaststelt. */
  const standen = new Set(j.kandidaten.map(k => k.stand));
  assert.deepEqual([...standen].sort(), ['gedekt', 'onbepaald'],
    'de enige twee standen zijn gedekt en onbepaald; "ongedekt" zou beweren dat iets niet ' +
    'gehandhaafd wordt, en dat weet een lexicale scan niet (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN)');

  assert.equal(j.telling.wettenInRegister, require('../WETTEN.json').wetten.length,
    'het register loopt achter op WETTEN.json; draai `npm run doctrine` opnieuw');
});

/* MUTATIE GEZIEN ZAKKEN: de teller `overgeslagen` uit de uitslag gehaald; zakte
   hier. Een scanner die stil overslaat meldt een laag getal, en dat leest als
   goed nieuws in plaats van als een blinde vlek. */
test('6. wat is overgeslagen staat er met een reden bij', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'DOCTRINE.json'), 'utf8'));
  assert.ok(j.overgeslagen, 'de uitslag hoort te zeggen wat er niet is gelezen');
  assert.ok(String(j.overgeslagen.waarom || '').length > 20, 'zonder reden is een overslag een gat');
  assert.ok(j.overgeslagen.codeblokregels > 0 && j.overgeslagen.tabelregels > 0,
    'deze documenten bevatten aantoonbaar code en tabellen; nul overgeslagen regels betekent ' +
    'dat de filters niet draaien en dat er code als doctrine wordt geteld');
});

/* MUTATIE GEZIEN ZAKKEN: in leesDocument() de kop-tak (`verklaring(kop)`)
   weggehaald; de recall viel van 48 naar 34 en deze toets zakte met de namen van
   de gemiste wetten erbij. */
test('7. de extractor vindt de wetten terug die dit huis al kent (recall)', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'DOCTRINE.json'), 'utf8'));
  const ij = j.ijking;
  assert.ok(ij, 'zonder ijking rapporteert dit register duizenden kandidaten zonder te zeggen ' +
    'hoeveel het bewijsbare het al mist -- en dat is gevaarlijker dan geen register');

  assert.equal(ij.wettenBekend, require('../WETTEN.json').wetten.length,
    'de ijking hoort tegen ALLE wetten te lopen; loopt hij tegen minder, dan is de recall opgepoetst ' +
    'door de grondwaarheid te verkleinen');

  /* DE VLOER STAAT OP 45 EN NIET OP 48. Een toets die exact het huidige getal
     eist, zakt zodra iemand een wet TOEVOEGT die nog geen kandidaat heeft -- en
     dat is gewoon werk. Wat niet mag is stil wegzakken. */
  assert.ok(ij.gevonden >= 45,
    'de recall is gezakt naar ' + ij.gevonden + ' van ' + ij.wettenBekend + '; de extractor is blind ' +
    'geworden voor wetten die dit huis al heeft vastgesteld. Gemist: ' +
    ij.gemist.map(g => g.id).join(', '));

  /* Elke gemiste wet draagt zijn naam. Een aantal zonder namen is niet na te
     lopen, en dan wordt het een getal dat iemand ooit accepteert. */
  for (const g of ij.gemist) {
    assert.ok(g.id && g.doc, 'een gemiste wet zonder naam of document is niet na te lopen');
  }
});

/* MUTATIE GEZIEN ZAKKEN: `kandidatenStructuur` en `kandidatenWoord` opgeteld tot
   een enkel getal; zakte hier. */
test('8. de twee assen staan apart en worden niet opgeteld tot een oordeel', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'DOCTRINE.json'), 'utf8'));
  const t = j.telling;
  assert.ok(t.kandidatenStructuur > 0, 'de structuuras draagt de recall; staat hij op nul, dan leest ' +
    'de extractor geen koppen meer en is de ijking hierboven toevallig groen');
  assert.ok(t.kandidatenWoord > 0, 'de woordas hoort te bestaan naast de structuuras');
  assert.equal(t.kandidatenStructuur + t.kandidatenWoord, t.kandidatenSterk,
    'de twee assen horen samen de kandidaten te dekken; klopt dat niet, dan valt er een soort buiten beeld');

  /* De structuuras hoort de recall te DRAGEN. Zou de woordas dat in zijn eentje
     doen, dan is de hele redenering in de kop van scripts/doctrine.js achterhaald
     en hoort die tekst mee te veranderen. */
  assert.match(j.grens, /nooit worden opgeteld/,
    'dat de assen niet optelbaar zijn, hoort in het register zelf te staan en niet alleen in een commentaar');
});
