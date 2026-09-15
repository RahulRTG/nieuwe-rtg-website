/* DE SOEVEREINITEITSMETER (scripts/soeverein.js, SOEVEREIN.json).

   WAT DEZE TOETS BEWAAKT. Niet of RTG soeverein MOET worden -- dat is een besluit
   van de eigenaar. Wel de vier dingen die machinaal te handhaven zijn, en de
   eerste is de enige die er echt toe doet:

     1 DE LADDER KRIMPT NIET. Het aantal dragers dat bij een lopend verzoek
       werkelijk een sleutel draagt mag alleen omhoog. Dat getal is het hart van
       de soevereiniteitsbelofte: een ladder met zes sporten op papier en vier in
       een echt verzoek belooft een isolatie die er niet is.

     2 HET BEREIK KRIMPT NIET. Het aantal toegangswegen waar de isolatielaag
       meeweegt mag alleen omhoog. Vandaag is dat er EEN (de ledenpoort), en
       juist de weg van een ZAAK -- wat een buitenlandse exploitant is -- weegt
       niet mee.

     3 GEEN SAMENGESTELD CIJFER. De vier delen mogen nooit tot een
       soevereiniteitspercentage worden opgeteld (INT-04, en dezelfde regel die
       ISOLATIEPROEF.json met `geenSamengesteldCijfer` vastlegt).

     4 ELK DEEL DRAAGT ZIJN GRAAD. Het bereik is lexicaal gemeten en dus een
       ONDERgrens; dat mag niet stilzwijgend als `gemeten` gaan lezen.

   WAT HIER NIET IN ZIT: een oordeel over de effecten per isolatiestand. Dat meet
   ISOLATIEPROEF.json, en twee meters over hetzelfde zeggen op een dag iets
   anders. Deze meet DRAGERS en WEGEN, die meet EFFECTEN. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { meet, DOEL, BOUWSTENEN } = require('../scripts/soeverein');

/* DE GRONDWAARDEN, met de datum. Ze verschuiven alleen met de hand, en dan staat
   het in de historie -- zoals NORM.json dat doet. */
const GROND = {
  gezet: '2026-09-15',
  dragersMetSleutel: 4,   // mag alleen OMHOOG
  poortenMetIsolatie: 1   // mag alleen OMHOOG
};

const vers = meet();

test('0. het ingecheckte register klopt met een verse meting', () => {
  assert.ok(fs.existsSync(DOEL), 'SOEVEREIN.json ontbreekt -- draai npm run soeverein:vast');
  const vast = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  assert.equal(vast.ladder.telling.metSleutelBijVerzoek, vers.ladder.telling.metSleutelBijVerzoek,
    'SOEVEREIN.json loopt achter op de code -- draai npm run soeverein:vast');
  assert.deepEqual(vast.bereik.poortenZonderIsolatie, vers.bereik.poortenZonderIsolatie);
});

test('1. RATEL: het aantal dragers met een sleutel mag alleen omhoog', () => {
  const nu = vers.ladder.telling.metSleutelBijVerzoek;
  assert.ok(nu >= GROND.dragersMetSleutel,
    'dragersMetSleutel zakte van ' + GROND.dragersMetSleutel + ' naar ' + nu +
    ' -- een drager draagt bij een lopend verzoek geen sleutel meer, dus de join weegt hem niet ' +
    'meer mee en de isolatie is stil zwakker geworden. Dat is precies wat SEC-LOCK-003 verbiedt.');
});

test('2. RATEL: het aantal poorten waar isolatie meeweegt mag alleen omhoog', () => {
  const nu = vers.bereik.poorten.filter(p => p.zetSessie).length;
  assert.ok(nu >= GROND.poortenMetIsolatie,
    'poortenMetIsolatie zakte van ' + GROND.poortenMetIsolatie + ' naar ' + nu +
    ' -- een toegangsweg die eerst een drager droeg, draagt er nu geen. Elke weg die req.session ' +
    'niet zet, weegt GEEN ENKELE drager mee, ook `huis` niet.');
});

test('3. er wordt nergens een samengesteld soevereiniteitscijfer geschreven', () => {
  assert.ok(typeof vers.geenSamengesteldCijfer === 'string' && vers.geenSamengesteldCijfer.length > 40,
    'de uitslag draagt geen uitgeschreven weigering om op te tellen');
  const platte = JSON.stringify(vers);
  for (const verboden of ['soevereiniteitsscore', 'sovereigntyScore', 'readinessPct', 'totaalCijfer']) {
    assert.ok(!platte.includes(verboden),
      'de uitslag draagt "' + verboden + '" -- vier verschillende soorten probleem tot een getal ' +
      'optellen stuurt niemand ergens heen (INT-04)');
  }
});

test('4. elk deel draagt zijn eigen bewijsgraad, en het bereik is geen `gemeten`', () => {
  const g = vers.graadPerDeel;
  assert.ok(g && typeof g === 'object', 'graadPerDeel ontbreekt');
  for (const deel of ['ladder', 'bereik', 'naamruimte', 'bouwstenen']) {
    assert.ok(typeof g[deel] === 'string' && g[deel].length > 10, 'deel ' + deel + ' draagt geen graad');
  }
  assert.ok(/vermoed/.test(g.bereik),
    'het bereik wordt lexicaal herkend en is dus een ONDERgrens; hem als `gemeten` opschrijven ' +
    'maakt van een woordtelling een bewijs');
});

test('5. de bouwstenen beweren nooit dat zij het voorstel DEKKEN', () => {
  assert.equal(vers.bouwstenen.stenen.length, BOUWSTENEN.length);
  for (const s of vers.bouwstenen.stenen) {
    assert.equal(s.dektVoorstel, 'onbepaald',
      'steen "' + s.steen + '" beweert dekking. Dat een bestand bestaat, zegt niet dat het doet wat ' +
      'het voorstel vraagt -- de digitale tweeling bestaat en gaat over het HUIS, niet over een ' +
      'onderneming. Een stilzwijgend ja maakt van deze meter een geruststelling.');
    assert.ok(s.waarom && s.waarom.length > 20, 'steen "' + s.steen + '" zegt niet waarom hij onbepaald is');
  }
});

test('6. de meter leest de dragers uit de code en houdt geen eigen lijst', () => {
  const bron = fs.readFileSync(require.resolve('../scripts/soeverein'), 'utf8');
  assert.ok(/require\(path\.join\(WORTEL, 'server\/kern\/isolatie\/dragers'\)\)/.test(bron),
    'de meter leest de dragers niet meer uit kern/isolatie/dragers.js');
  assert.ok(!/const\s+DRAGERS\s*=\s*\[/.test(bron),
    'scripts/soeverein.js draagt een eigen dragerlijst -- dan meet hij zichzelf');
});
