/* ============================================================================
   HET EFFECTCONTRACT -- de poort en de twee assen.

   WAT HIER WORDT AFGEDWONGEN, en het is een ding: een contract mag MEER zeggen dan
   de meting, maar nooit iets ANDERS. Zonder die regel is dit register binnen een
   maand een lijst beweringen met een stempel dat niemand heeft gezet -- precies het
   valse groen waar de laag tegen is gebouwd.

   En daarnaast: er komt geen zesde zekerheidsladder bij. De graden zijn de vier van
   dit huis, en "bounded" is geen trede maar een VELD (`uitkomsten`).
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const ec = require('../server/kern/stuur/effectcontract');
const { CONTRACTEN } = require('../server/kern/stuur/effectcontract/register');
const envelop = require('../server/kern/envelop');
const gevolg = require('../server/kern/stuur/gevolg');

/* Een pad waarvan de meting RIJK is, zodat een gemeten claim gedekt kan zijn. */
const GEMETEN_PAD = '/api/bank/sepa';
const gemetenCollecties = gevolg.gevolgVan(GEMETEN_PAD).collecties;

const basis = (extra) => Object.assign({
  capability: GEMETEN_PAD,
  gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: gemetenCollecties[0],
      wat: 'iets verandert', reden: 'gemeten in de proefronde' },
    { soort: 'afgeleid', graad: 'vermoed', wat: 'iets volgt eruit', reden: 'volgt uit het bovenstaande' },
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider doet iets', reden: 'buiten de opslag' },
    { soort: 'mislukking', graad: 'vermoed', wat: 'er blijft iets achter', reden: 'bij een storing' }
  ]
}, extra || {});

test('de vier graden zijn de graden van dit huis, en er komt geen vijfde bij', () => {
  /* Deze lijst staat woordelijk in kern/objectlaag/pagina.js en
     kern/identiteit/sessievelden.js. Een eigen ladder hier zou de zesde van het
     huis zijn, en AFSPRAAK.md verbiedt dat met zoveel woorden. */
  assert.deepStrictEqual(ec.GRADEN, ['onbekend', 'vermoed', 'gemeten', 'bewezen']);
  assert.deepStrictEqual(ec.SOORTEN, ['direct', 'afgeleid', 'buiten', 'mislukking']);
  assert.deepStrictEqual(Object.keys(ec.STANDEN), ['VOLLEDIG', 'GEDEELTELIJK', 'ONBEKEND']);
});

test('de classificaties worden GELEEND van de envelop en niet overgeschreven', () => {
  /* Een kopie zou uiteenlopen zodra iemand daar een klasse bijzet -- en de eerste
     versie van deze laag had de vorm van dat register verkeerd geraden (een object
     met een reden per klasse, geen lijst). Juist daarom wordt hij geleend. */
  assert.deepStrictEqual(ec.klassen(), Object.keys(envelop.CLASSIFICATIES));
  const fout = ec.keur(basis({ classificatie: 'zeergeheim' }));
  assert.ok(fout.some(f => /staat niet in de woordenlijst van kern\/envelop/.test(f)), fout.join(' | '));
});

test('DE POORT: een `gemeten` claim die de meting niet dekt, wordt geweigerd', () => {
  /* Dit is de bewering die het hele register draagt. Hij mag meer zeggen dan de
     meting; hij mag nooit iets anders zeggen. */
  const fout = ec.keur(basis({ gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: 'verzonnenCollectie',
      wat: 'saldo daalt', reden: 'x' }
  ] }));
  assert.ok(fout.some(f => /maar de proef zag die daar nooit veranderen/.test(f)), fout.join(' | '));

  /* En dezelfde claim op een collectie die de proef WEL zag, komt er door. */
  const goed = ec.keur(basis());
  assert.deepStrictEqual(goed, [], goed.join(' | '));
});

test('een gemeten direct gevolg zonder collectie is geen gemeten gevolg', () => {
  const fout = ec.keur(basis({ gevolgen: [
    { soort: 'direct', graad: 'gemeten', wat: 'iets', reden: 'x' }
  ] }));
  assert.ok(fout.some(f => /noemt zijn collectie/.test(f)), fout.join(' | '));
});

test('een gevolg BUITEN de opslag kan nooit gemeten of bewezen zijn', () => {
  /* De meting kijkt alleen naar collecties -- dat staat in GRENZEN van gevolg.js
     als punt 3, en hier wordt het afgedwongen in plaats van gehoopt. */
  for (const graad of ['gemeten', 'bewezen']) {
    const fout = ec.keur(basis({ gevolgen: [
      { soort: 'buiten', graad, wat: 'de bank boekt bij', reden: 'x' }
    ] }));
    assert.ok(fout.some(f => /buiten de opslag kan niet/.test(f)), graad + ': ' + fout.join(' | '));
  }
});

test('herstel wordt niet verklaard maar gemeten -- vier woorden worden geweigerd', () => {
  /* scripts/herstelproef.js heeft VIJF uitslagen; een boolean eroverheen slaat
     het verschil tussen een creditnota en een gewiste factuur plat. */
  for (const woord of ['reversible', 'omkeerbaar', 'herstelbaar', 'compensation']) {
    const fout = ec.keur(basis({ [woord]: true }));
    assert.ok(fout.some(f => f.includes('"' + woord + '"') && /GEMETEN/.test(f)),
      woord + ': ' + fout.join(' | '));
  }
});

test('de drie bezette namen worden geweigerd in plaats van stil omgezet', () => {
  for (const [naam, ipv] of [['doel', 'streefstand'], ['doelen', 'streefstand'],
    ['privacyImpact', 'classificatie'], ['goals', 'streefstand']]) {
    const fout = ec.keur(basis({ [naam]: 'x' }));
    assert.ok(fout.some(f => f.includes('"' + naam + '"') && f.includes(ipv)),
      naam + ': ' + fout.join(' | '));
  }
});

test('BOUNDED is geen trede maar een veld, en dat veld is een GESLOTEN set', () => {
  /* De bedoeling van "bounded" blijft overeind zonder een nieuw woord: staat er
     een uitkomstruimte, dan is hij benoemd en gesloten. Een lijst van een is geen
     ruimte maar een bewering. */
  const half = ec.keur(basis({ gevolgen: [
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider antwoordt',
      uitkomsten: ['bevestigd'], reden: 'x' }
  ] }));
  assert.ok(half.some(f => /GESLOTEN set van minstens twee/.test(f)), half.join(' | '));

  const heel = ec.keur(basis({ gevolgen: [
    { soort: 'buiten', graad: 'vermoed', wat: 'de provider antwoordt',
      uitkomsten: ['bevestigd', 'geweigerd', 'teruggeboekt'], reden: 'x' }
  ] }));
  assert.deepStrictEqual(heel, [], heel.join(' | '));
});

test('DE TWEE ASSEN WORDEN NOOIT OPGETELD: een onbekende meting blokkeert geen verklaring', () => {
  /* Een pad waar de proef niet bij kwam, kan wel een VOLLEDIGE verklaring hebben --
     die twee assen meten verschillende dingen. Wat zo'n contract NIET mag, is
     ergens `gemeten` claimen; dat vangt de poort hierboven. Zonder dit onderscheid
     zou het werk aan de verklaring wachten op een proef die er niet komt. */
  const blind = '/api/agenda/bewaar';
  assert.strictEqual(gevolg.gevolgVan(blind).graad, 'onbekend', 'dit pad hoort ongemeten te zijn');
  const c = {
    capability: blind,
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', wat: 'de agenda krijgt een item', reden: 'gelezen in de route' },
      { soort: 'afgeleid', graad: 'vermoed', wat: 'de dag raakt voller', reden: 'volgt eruit' },
      { soort: 'buiten', graad: 'vermoed', wat: 'geen enkel gevolg buiten de opslag', reden: 'geen bericht' },
      { soort: 'mislukking', graad: 'vermoed', wat: 'er blijft niets half staan', reden: 'een schrijfactie' }
    ]
  };
  assert.deepStrictEqual(ec.keur(c), [], 'een verklaring zonder meting hoort te mogen bestaan');
  assert.strictEqual(ec.stand(c, blind).stand, 'VOLLEDIG');
});

test('VOLLEDIG eist alle vier de soorten EN dekking van elke gemeten collectie', () => {
  /* Twee manieren om onvolledig te zijn, en ze staan apart in de uitslag: een
     soort die ontbreekt (`open`) en een gemeten collectie die niemand verklaarde
     (`nietVerklaard`). Een van de twee verzwijgen zou een half contract volledig
     laten lijken. */
  const zonderSoort = ec.stand({ capability: GEMETEN_PAD, gevolgen: [
    { soort: 'direct', graad: 'gemeten', collectie: gemetenCollecties[0], wat: 'x', reden: 'y' }
  ] }, GEMETEN_PAD);
  assert.strictEqual(zonderSoort.stand, 'GEDEELTELIJK');
  assert.ok(zonderSoort.open.includes('afgeleid') && zonderSoort.open.includes('buiten'));
  assert.ok(zonderSoort.nietVerklaard.length >= 1,
    'de gemeten collecties die niemand verklaarde horen met naam in de uitslag');
});

test('elk contract in het register haalt de keuring, en is VOLLEDIG of zegt wat er open staat', () => {
  const namen = Object.keys(CONTRACTEN);
  assert.ok(namen.length >= 1, 'het register hoort minstens een contract te dragen');
  for (const pad of namen) {
    const c = CONTRACTEN[pad];
    assert.strictEqual(c.capability, pad, pad + ': de sleutel en het veld `capability` horen gelijk te zijn');
    const fout = ec.keur(c);
    assert.deepStrictEqual(fout, [], pad + ': ' + fout.join('\n    '));
    const s = ec.stand(c, pad);
    if (s.stand !== 'VOLLEDIG')
      assert.ok(s.open.length || s.nietVerklaard.length,
        pad + ': niet volledig, maar zegt niet wat er open staat');
    assert.ok(c.nagekeken, pad + ': elk contract draagt wie het heeft nagekeken');
  }
});
