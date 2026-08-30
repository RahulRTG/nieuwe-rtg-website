/* ============================================================================
   DE LIJFSLEUTEL -- EEN SLEUTEL DIE IN HET LICHAAM REIST.

   WAAROM ER EEN TWEEDE BEGRIP NAAST `rol` STAAT. scripts/lib/bewakers.js kent
   een deursoort `lichaamssleutel` en hangt daar bewust GEEN rol aan, met de
   reden: "de sleutel staat in het lichaam en niet in de kop, dus rollen kruisen
   zegt hier niets". Dat klopt voor de ROLPROEF, die met een verkeerde rol
   aanklopt om scheiding te toetsen -- met een lijfsleutel bestaat "de verkeerde
   rol" niet.

   Maar de IDEMPROEF kruist niets: die herhaalt met de JUISTE sleutel. Voor dat
   instrument is zo'n route wel te beproeven zodra er een sleutel te maken is.
   Eén reden, twee instrumenten, tegengestelde conclusies -- en zolang er maar
   één begrip was, won de strengste en telden honderd routes als
   instrumenttekort terwijl er niets ontbrak.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. De rolproef mag deze deuren NIET gaan kruisen. Daarom staat `lijfsleutel`
      niet in de rol-woordenlijst van bewakers.js; wie dat samenvoegt, maakt een
      instrument groen op iets wat het niet heeft gemeten.
   2. Een bouwer loopt door de ECHTE deur van het product. Een verzonnen token
      bewijst niets over de applicatie.
   3. Er wordt geen omgevingsvlag omgezet om een deur open te krijgen. De
      schooldeur staat buiten NODE_ENV=test met 410 dicht; die vlag aanzetten
      zou de hele server een andere server maken.

   DE MUTATIE: haal het `/api/bedrijf/` voorvoegsel uit FAMILIES -> de tweede
   toets zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FAMILIES, dektPad, bouwLijfsleutels } = require('../scripts/lib/lijfsleutels');

test('elke familie noemt zijn velden, zijn paden en WAAROM hij bestaat', () => {
  assert.ok(FAMILIES.length > 0);
  for (const f of FAMILIES) {
    assert.ok(f.naam, 'een familie zonder naam is niet te melden');
    assert.ok(Array.isArray(f.prefixen) && f.prefixen.length, f.naam + ': geen paden');
    assert.ok(Array.isArray(f.velden) && f.velden.length, f.naam + ': geen velden');
    assert.ok(f.waarom && f.waarom.length > 40,
      f.naam + ': geen uitgeschreven reden. Zonder reden is dit een plek om een sleutel te verzinnen');
    assert.equal(typeof f.bouw, 'function', f.naam + ': geen bouwer');
    for (const p of f.prefixen) assert.ok(p.startsWith('/api/'), f.naam + ': ' + p + ' is geen API-pad');
  }
});

test('de familie dekt de routes waarvoor hij bedoeld is, en niet meer', () => {
  assert.equal(dektPad('/api/bedrijf/besluit/maak'), true, 'het Werk OS hoort gedekt te zijn');
  assert.equal(dektPad('/api/pay/overzicht'), false, 'een gewone ledenroute hoort NIET gedekt te zijn');
  assert.equal(dektPad('/api/office/anker'), false);
});

test('een bouwer die niets teruggeeft, meldt dat en verzint niets', async () => {
  /* De gevaarlijkste uitkomst is een sleutel die er wel is maar nergens vandaan
     komt: dan meet de proef met invoer die het product nooit heeft uitgegeven. */
  const uit = await bouwLijfsleutels({ post: async () => ({ status: 500, data: {} }) });
  assert.equal(uit.gebouwd.length, 0);
  assert.ok(uit.mislukt.length > 0, 'een mislukte bouw hoort gemeld te worden, niet verzwegen');
  assert.equal(uit.dekt('/api/bedrijf/besluit/maak'), false,
    'zonder gebouwde sleutel dekt de familie niets -- anders zou de proef zonder sleutel aankloppen');
});

test('een bouwer die stukloopt, laat de proef niet omvallen', async () => {
  const uit = await bouwLijfsleutels({ post: async () => { throw new Error('stuk'); } });
  assert.equal(uit.gebouwd.length, 0);
  assert.ok(uit.mislukt.length > 0);
});

test('lijfsleutel staat NIET in de rol-woordenlijst van de bewakerskaart', () => {
  const bk = require('../scripts/lib/bewakers.js');
  const rollen = new Set();
  for (const naam of bk.namenVan()) { const r = bk.rolBij(naam); if (r) rollen.add(r); }
  assert.ok(!rollen.has('lijfsleutel'),
    'de rolproef zou deze deuren dan gaan kruisen, en daar bewijst kruisen niets');
});

/* ============================================================================
   DE SCHOOLFAMILIE LOOPT DE ECHTE WEG, EN DAT IS EEN BESLUIT.

   Er bestaat een snelle deur: /api/foundation/school/school/maak maakt in een
   keer een school met een beheersleutel. Die geeft buiten NODE_ENV=test een
   410, en die vlag aanzetten zou 165 routes in een klap ontsluiten -- maar dan
   meet de proef een server die het product niet is. Dat is precies het soort
   groen waar dit huis niets aan heeft.

   Dus loopt de bouwer de productieweg: registratie aanvragen, vijf
   toelatingscontroles aftekenen met het boardroom-token, besluit nemen,
   activeren.

   EN ER IS EEN STAP DIE BUITEN HET HTTP-VLAK VALT. Het besluit geeft de
   activatielink NIET terug -- die gaat naar het gecontroleerde schooladres. Dat
   is het ontwerp: wie goedkeurt, hoort de sleutel niet in handen te krijgen. De
   bouwer leest hem uit de outbox van de wegwerpserver, langs dezelfde weg die
   test/foundationregistratie.test.js al gebruikt.

   Die afhankelijkheid hoort zichtbaar te zijn en niet weggemoffeld: zonder
   datamap is deze familie niet te bouwen, en dan meldt hij zich als mislukt in
   plaats van een sleutel te verzinnen. Dat is wat de laatste toets vastlegt.
   ========================================================================== */
test('de schoolfamilie gebruikt NIET de snelle testdeur', () => {
  const school = FAMILIES.find(f => f.naam === 'school');
  assert.ok(school, 'de schoolfamilie hoort te bestaan');
  const bron = String(school.bouw);
  assert.ok(!/school\/school\/maak/.test(bron),
    'de snelle deur werkt alleen met NODE_ENV=test; die vlag zou de hele server een andere server maken');
  assert.match(bron, /registratie\/aanvragen/, 'de echte weg begint bij de registratie');
  assert.match(bron, /registratie\/besluit/, 'en loopt langs het besluit');
});

test('zonder datamap bouwt de schoolfamilie niets, in plaats van iets te verzinnen', async () => {
  /* De activatiesleutel komt uit de outbox op schijf. Ontbreekt die map, dan is
     er geen sleutel -- en dan hoort de familie te ontbreken en niet te doen
     alsof. */
  const school = FAMILIES.find(f => f.naam === 'school');
  const uit = await school.bouw({
    post: async () => ({ status: 200, data: { ok: true, id: 'x', aanvraag: { controles: [{ id: 'brin' }] } } }),
    tokens: { boardroom: 'nep' }
  });
  assert.equal(uit, null, 'zonder datamap hoort er geen sleutel uit te komen');
});
