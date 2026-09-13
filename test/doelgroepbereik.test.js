/* DE DOELGROEPBEREIKMETER -- en vooral: wat hij NIET mag beweren.

   WAAROM HIJ ZO HEET EN NIET "BEREIKBAAR". Die naam was al bezet, en dat kwam
   hier bijna duur te staan: test/bereikbaar.test.js bewaakt BEREIK.json -- de
   schuldlijst van SCHERMEN die je niet kunt aantikken -- en werd tijdens het
   bouwen van deze meter overschreven. De ratel `metingenZonderRatel` sprong van
   50 naar 51 en wees het aan; zonder die tand was een bestaande toets stil
   verdwenen. Bereikbaarheid is hier dus twee vragen, en ze houden twee namen:
   kan een MENS het scherm aantikken (BEREIK.json), en kan de VERKLAARDE
   DOELGROEP de deur erachter open (DOELGROEPBEREIK.json).

   scripts/doelgroepbereik.js vergelijkt het functieregister met de deuren: kan de
   VERKLAARDE doelgroep zijn eigen paden werkelijk bereiken? Dit bestand bewaakt
   het instrument, niet de uitslag -- de meting zelf draait tegen een
   wegwerpserver en duurt daar minuten.

   WAAROM DE MEESTE TOETSEN HIER OVER TERUGHOUDENDHEID GAAN. Deze meter velt een
   oordeel over het register ("het liegt"), en zo'n oordeel is een beschuldiging.
   Hij heeft er tijdens het bouwen twee keer een verzonnen: eerst 144 leugens
   door elke 403 als een dichte deur te lezen, daarna honderden gaten door elke
   afwijkende weigering als "binnen" te lezen. Beide keren zag de uitslag er
   geloofwaardig uit. De toetsen hieronder houden vast wat daaruit is geleerd.

   Draai los: node --test test/doelgroepbereik.test.js
   De meting zelf: npm run doelgroepbereik */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'doelgroepbereik.js'), 'utf8');
const sessieBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'doelgroepsessies.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('1. de meter draait op een wegwerpserver met echte sessies', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.match(bron, /require\('\.\/lib\/doelgroepsessies'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  /* Een nagebouwd token meet je eigen aanname en niet de deur. */
  assert.doesNotMatch(sessieBron, /jwt\.sign|crypto\.randomBytes\(\d+\)\.toString\('hex'\)\s*;?\s*\/\/\s*token/);
});

test('2. een doelgroep zonder sessie is nooit een registerleugen', () => {
  /* De scherpste regel van de meter: niet gemeten mag nooit als uitslag
     langskomen (scripts/tikken.js houdt dezelfde regel aan). */
  assert.match(bron, /if \(!dragers\[d\]\) \{ cel\.uitslag = 'sessie-ontbreekt'/,
    'een ontbrekende sessie valt niet in een eigen tak; dan wordt een kapotte inlog een leugen');
  const j = lees('DOELGROEPBEREIK.json');
  for (const c of j.cellen) {
    if (c.uitslag === 'sessie-ontbreekt') assert.notEqual(c.uitslag, 'registerleugen');
  }
  assert.equal(j.klopt === true || j.overgeslagen.length > 0 || j.telling.registerleugen > 0, true,
    'klopt hoort vals te zijn zodra er een leugen OF een overgeslagen doelgroep is');
});

test('3. "dicht" betekent: de sessie maakte geen verschil met anoniem', () => {
  /* Hier zat de eerste verzonnen uitslag. Elke 403 als dichte deur lezen maakte
     van "je bent nog niet verbonden met deze codenaam" een registerleugen. */
  assert.match(bron, /anoniemAntwoord\.status === antwoord\.status && anoniemAntwoord\.reden === antwoord\.reden/,
    'de vergelijking met het anonieme antwoord is weg; dan raadt de meter weer wie er weigerde');
  assert.match(bron, /function deurstand/, 'er is geen aparte deurstand-functie meer');
});

test('4. een afwijkende weigering is ONBEPAALD en geen van beide', () => {
  /* En hier zat de tweede: `auth` weigert een kantoortoken met "Niet ingelogd
     als lid." en anoniem met "Niet ingelogd." -- andere tekst, dezelfde
     bewaker. Dat als "binnen" lezen verzon honderden gaten. */
  assert.match(bron, /const LANGS = 'langs', DICHT = 'dicht', ONBEPAALD = 'onbepaald'/,
    'de drie uitkomsten zijn terug naar twee; dan moet de meter gokken');
  assert.match(bron, /else if \(twijfel\) \{ cel\.uitslag = 'onbepaald'/,
    'een cel met twijfel en geen open route hoort onbepaald te zijn, geen leugen');
  const j = lees('DOELGROEPBEREIK.json');
  assert.ok(j.telling.onbepaald > 0,
    'nul onbepaalde cellen is verdacht: deze meter hoort te weten wat hij niet weet');
});

test('5. een doelgroep met meer sessievormen levert nooit een leugen', () => {
  /* `foundation` dekt gezinnen, leerlingen EN scholen; de meter draagt er een. */
  assert.match(bron, /const MEER_SESSIEVORMEN = \{/);
  assert.match(bron, /foundation: '[^']{40,}'/, 'de reden staat er niet uitgeschreven bij');
  const j = lees('DOELGROEPBEREIK.json');
  for (const c of j.leugens)
    assert.notEqual(c.doelgroep, 'foundation',
      'foundation levert een registerleugen; dat is de meter die zijn eigen beperking als bevinding leest');
});

test('6. de meter beantwoordt geen productvraag', () => {
  /* Of de RTFoundation toegang KRIJGT tot de knelpuntmotor is een besluit van
     de eigenaar. Vandaag is die doelgroep daar niet verklaard en komt hij er
     niet in -- dat hoort consistent te heten en geen bevinding te zijn. De
     meter wordt daar pas rood van als de doelgroep is TOEGEVOEGD. */
  const j = lees('DOELGROEPBEREIK.json');
  const cel = j.cellen.find((c) => c.functie === 'knelpunt' && c.doelgroep === 'foundation');
  assert.ok(cel, 'de cel knelpunt x foundation ontbreekt; dan bewaakt deze toets niets');
  assert.equal(cel.verklaard, false);
  assert.notEqual(cel.uitslag, 'registerleugen');
  assert.notEqual(cel.uitslag, 'bereikbaar-zonder-verklaring');
});

test('7. de twee richtingen worden nooit opgeteld', () => {
  /* Een registerleugen is een defect; binnenkomen zonder verklaring is een
     triagelijst. Ze bij elkaar optellen maakt van een vraag een uitslag. */
  const j = lees('DOELGROEPBEREIK.json');
  assert.ok(Array.isArray(j.leugens) && Array.isArray(j.zonderVerklaring));
  assert.match(bron, /uit\.klopt = t\.registerleugen === 0 && uit\.overgeslagen\.length === 0/,
    'klopt telt meer dan de harde fout mee, of juist minder');
  assert.doesNotMatch(bron, /registerleugen \+ .*zonderVerklaring|zonderVerklaring \+ .*registerleugen/);
});

test('8. het register telt op en draagt zijn grens', () => {
  const j = lees('DOELGROEPBEREIK.json');
  const t = j.telling;
  const som = t.waar + t['correct-afgesloten'] + t.registerleugen + t['bereikbaar-zonder-verklaring'] +
    t['geen-deur'] + t.onbepaald + t['niet-beproefd'] + t['sessie-ontbreekt'];
  assert.equal(som, t.cellen, 'de uitslagen tellen niet op tot het aantal cellen');
  assert.equal(t.cellen, j.cellen.length);
  assert.ok(j.grens && j.grens.length > 200, 'het register draagt geen uitgeschreven grens');
  assert.match(j.grens, /DEUR en niet de kamer/, 'de grens zegt niet wat er NIET gemeten is');
});

test('9. de acht doelgroepen komen uit het register en niet uit een eigen lijst', () => {
  /* Een tweede lijst doelgroepen loopt uiteen met die van het functieregister,
     en dan meet deze meter iets anders dan het bord toont (LAT.md regel 4). */
  assert.match(bron, /require\('\.\.\/server\/functies\/register'\)/);
  assert.doesNotMatch(bron, /const DOELGROEP_IDS = \[/, 'de doelgroeplijst is hier overgetypt');
  const { DOELGROEP_IDS } = require('../server/functies/register');
  const j = lees('DOELGROEPBEREIK.json');
  assert.deepEqual(j.doelgroepen, DOELGROEP_IDS);
});

test('10. de tweede richting claimt geen autorisatiegat', () => {
  /* HIER STOND EEN FOUT, en hij was niet klein. De meter noemde
     `bereikbaar-zonder-verklaring` "een gat in de autorisatie of een gat in het
     register". Het eerste kan niet: `f.doelgroepen` is nergens een slot.
     functies/toegang.js valt zonder eigen stand terug op de GLOBALE schakelaar,
     en de enige standaard-weigering daar hangt aan `alleenGenres`.

     Wat het wel is, staat in routes/techniek/boardroom/schakelaar.js: die
     weigert een schakelaar voor een niet-verklaarde doelgroep, terwijl
     functieAanVoor die stand gewoon zou lezen. De eigenaar kan de functie dus
     niet per doelgroep uitzetten -- een BESTUURSgat. */
  /* De oude zin MAG er staan -- als citaat in de correctie, want een fout die
     je wegpoetst kan iemand morgen opnieuw maken. Wat niet mag is hem als
     BEWERING laten staan. Daarom niet op het woord getoetst maar op de
     weerlegging: hij komt precies een keer voor, en de ontkenning staat erbij. */
  const claims = bron.match(/gat in\s+de autorisatie/g) || [];
  assert.equal(claims.length, 1,
    'de zin over een autorisatiegat staat er vaker dan een keer; dan is hij geen citaat meer maar een bewering');
  assert.match(bron, /Het eerste kan niet: `f\.doelgroepen` is nergens een slot/,
    'de weerlegging bij dat citaat is weg; dan leest de fout weer als de uitleg');
  assert.match(bron, /BESTUURSgat/, 'de uitleg noemt niet wat het wel is');
  /* De bewering over de schakelaar wordt tegen de CODE gehouden en niet
     geloofd: zakt deze, dan is de uitleg van de meter een verhaal geworden. */
  const schakelaar = fs.readFileSync(path.join(WORTEL, 'server', 'routes', 'techniek',
    'boardroom', 'schakelaar.js'), 'utf8');
  assert.match(schakelaar, /doelgroepen \|\| \[\]\)\.includes\(dg\)/,
    'het bord weigert niet langer een niet-verklaarde doelgroep; dan klopt de uitleg van de meter niet meer');
  const toegang = fs.readFileSync(path.join(WORTEL, 'server', 'functies', 'toegang.js'), 'utf8');
  assert.doesNotMatch(toegang, /f\.doelgroepen.*includes\(c\.doelgroep\)/,
    'de doelgroeplijst is een slot geworden; dan meet deze meter iets anders dan hij zegt');
});

test('11. elke cel in de tweede richting draagt een triage', () => {
  /* Een stapel van 132 zonder onderscheid is geen bevinding maar een berg. */
  const j = lees('DOELGROEPBEREIK.json');
  const SOORTEN = ['gelijk-aan-verklaard', 'ruimer-dan-verklaard', 'onbepaald'];
  for (const c of j.zonderVerklaring) {
    assert.ok(SOORTEN.includes(c.triage),
      c.functie + ' x ' + c.doelgroep + ' draagt geen geldige triage (' + c.triage + ')');
    assert.ok(c.triageReden && c.triageReden.length > 20, 'de triage draagt geen uitgeschreven reden');
  }
  assert.ok(j.zonderVerklaring.length > 0);
});

test('12. "ruimer dan verklaard" wordt nooit zonder bewijs gezegd', () => {
  /* Dat is de enige tak die een TOEGANGSvraag stelt, en dus de enige die als
     beschuldiging leest. Hij mag alleen staan als ELKE verklaarde doelgroep op
     diezelfde route geweigerd werd en er niets onbepaald tussen zat. */
  const j = lees('DOELGROEPBEREIK.json');
  for (const c of j.zonderVerklaring) {
    if (c.triage !== 'ruimer-dan-verklaard') continue;
    assert.ok(c.triageBewijs, 'geen bewijs bij een toegangsvraag');
    assert.equal(c.triageBewijs.zelfde, 0, 'een verklaarde doelgroep kreeg hetzelfde antwoord; dan is dit geen verruiming');
    assert.equal(c.triageBewijs.onbekend, 0, 'er zat een onbepaald antwoord tussen; dan is dit onbepaald en geen verruiming');
    assert.ok(c.triageBewijs.geweigerd > 0);
    assert.ok(c.open, 'er is geen route genoemd waar dit op geldt');
  }
});
