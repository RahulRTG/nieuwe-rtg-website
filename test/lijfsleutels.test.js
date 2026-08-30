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
    /* Velden OF koppen -- de doosfamilie draagt haar sleutel in een kop, want
       daar hoort hij te reizen; in de body meesturen zou een weg beproeven die
       de route niet kent. Maar iets moet hij declareren: een familie die niets
       meestuurt, opent niets. */
    const draagt = (f.velden || []).length + (f.koppen || []).length + (f.rol ? 1 : 0);
    assert.ok(draagt > 0, f.naam + ': declareert geen velden, geen koppen en geen rol -- ' +
      'zo\'n familie stuurt niets mee en opent dus niets');
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

/* ============================================================================
   SOMMIGE DEUREN VRAGEN ALLEBEI: EEN SESSIE EN EEN AANWIJZING.

   `huisAuth` van de werkplek (server/routes/werkplek.js) leest de
   boardroom-sessie uit de KOP en daarnaast `bedrijf` uit het LIJF. Zonder
   allebei is het 404 (onbekend bedrijf) of 403 (geen sleutel voor dit huis).

   Een familie mag daarom een ROL declareren. Doet hij dat niet, dan gaat er
   geen Authorization-kop mee -- en dat verschil hoort expliciet te zijn: een
   `undefined` die toevallig geen kop oplevert, is niet te onderscheiden van een
   vergeten rol.

   EN ER VALT HIER NIETS TE BOUWEN, wat precies het punt is. De twee huizen (rtg
   en rtf) staan vast in server/kern/werkplek.js; ze worden niet aangemaakt, ze
   bestaan. Wat ontbrak was de wetenschap welk veld je moet meesturen. De bouwer
   controleert dat toch echt door een keer aan te kloppen -- anders zouden 71
   routes als "gedekt" tellen terwijl ze allemaal op 403 stuklopen. Dezelfde les
   als de gezinsfamilie, die op twee veldnamen strandde terwijl de trechter hem
   al meetelde.
   ========================================================================== */
test('een familie mag een rol declareren, en die reist mee naar de proef', async () => {
  const wp = FAMILIES.find(f => f.naam === 'werkplek');
  assert.ok(wp, 'de werkplekfamilie hoort te bestaan');
  assert.equal(wp.rol, 'boardroom', 'huisAuth leest een boardroom-sessie uit de kop');

  const uit = await bouwLijfsleutels({
    post: async () => ({ status: 200, data: { ok: true } }),
    tokens: { boardroom: 'nep' }
  });
  assert.equal(uit.rolVoor('/api/werkplek/bureau/architect'), 'boardroom',
    'de rol hoort per pad opvraagbaar te zijn, anders gaat de proef zonder kop aankloppen');
  assert.equal(uit.rolVoor('/api/bedrijf/besluit/maak'), null,
    'een familie zonder rol hoort expliciet null te geven en niet undefined');
});

test('zonder de sessie die de familie vraagt, bouwt hij niets', async () => {
  const wp = FAMILIES.find(f => f.naam === 'werkplek');
  assert.equal(await wp.bouw({ post: async () => ({ status: 200, data: {} }), tokens: {} }), null,
    'zonder boardroom-sleutel hoort er niets uit te komen');
});

test('een bouwer die 403 krijgt, meldt zich als mislukt', async () => {
  /* De gevaarlijkste uitkomst: 71 routes als gedekt tellen terwijl ze
     allemaal op 403 stuklopen. */
  const wp = FAMILIES.find(f => f.naam === 'werkplek');
  assert.equal(await wp.bouw({
    post: async () => ({ status: 403, data: { error: 'niet van u' } }),
    tokens: { boardroom: 'nep' }
  }), null);
});

/* ============================================================================
   GEEN TWEE FAMILIES OVER HETZELFDE PAD.

   De families worden op VOORVOEGSEL gekozen en de eerste treffer wint. Zolang
   geen voorvoegsel onder een ander valt, is dat eenduidig. Valt er wel een
   onder -- iemand zet '/api/foundation/' ergens neer -- dan krijgt een route
   stil de sleutel van de verkeerde familie, en dat is niet aan de uitslag te
   zien: hij loopt gewoon op 403 of 404 stuk en belandt in een fixture-bak.

   Dat risico is niet theoretisch. De gezinsfamilie en de lesfamilie gebruiken
   allebei de veldnamen `code` en `token`, en ze wonen allebei onder
   /api/foundation/. Ze overlappen nu niet, en deze toets houdt dat zo.
   ========================================================================== */
test('geen enkel voorvoegsel valt onder dat van een andere familie', () => {
  for (const a of FAMILIES) {
    for (const b of FAMILIES) {
      if (a === b) continue;
      for (const pa of a.prefixen) {
        for (const pb of b.prefixen) {
          assert.ok(!pa.startsWith(pb) && !pb.startsWith(pa),
            'familie "' + a.naam + '" (' + pa + ') overlapt met "' + b.naam + '" (' + pb + '); ' +
            'de eerste treffer wint, dus een van de twee krijgt stil de verkeerde sleutel');
        }
      }
    }
  }
});

/* ============================================================================
   EEN VOORVOEGSEL MET EEN SLUITENDE STREEP MIST HET KALE PAD.

   `/api/foundation/agenda` bestaat als route NAAST
   `/api/foundation/agenda/verwijder`. Een familie met voorvoegsel
   '/api/foundation/agenda/' dekt de tweede wel en de eerste niet.

   Er komt geen foutmelding van: die routes stonden gewoon in de bak "geen
   sleutel", tussen tientallen andere, alsof er iets ontbrak. Twee stuks in
   dit geval -- weinig, en precies het soort stille misser dat groeit met elke
   familie die erbij komt.

   DE MUTATIE: haal '/api/foundation/agenda' (zonder streep) uit de prefixen
   van de lesfamilie -> deze toets zakt.
   ========================================================================== */
test('elk voorvoegsel met een streep dekt ook het kale pad, als dat bestaat', () => {
  const { alleRoutes } = require('../scripts/lib/routes');
  const paden = new Set(alleRoutes().filter(r => r.methode !== 'GET').map(r => r.pad));
  const gemist = [];
  for (const f of FAMILIES) {
    for (const p of f.prefixen) {
      if (!p.endsWith('/')) continue;
      const kaal = p.slice(0, -1);
      if (paden.has(kaal) && !f.prefixen.includes(kaal)) gemist.push(f.naam + ' -> ' + kaal);
    }
  }
  assert.deepEqual(gemist, [],
    'deze paden bestaan als route maar vallen buiten hun familie omdat het voorvoegsel ' +
    'op een streep eindigt: ' + gemist.join(', '));
});

/* ============================================================================
   EEN FAMILIE MAG EEN ROL OOK OPWAARDEREN.

   WAT ER MIS WAS. De Lifestyle-familie dekt vier takken waarvan de
   bewakerskaart terecht `member` zegt: de deur eist een ledensessie en verder
   niets, de PAS-controle zit in de handler. Die routes hebben dus AL een rol,
   en de proef nam families alleen uit de verzameling ZONDER rol. De familie
   werd netjes gebouwd en deed vervolgens niets.

   Gemeten: FIXTURE_403 bleef staan op 668 en `met bewijs` ging drie omhoog in
   plaats van tweehonderd. Dat is precies de vorm van fout die deze sessie al
   twee keer eerder maakte -- een tak die er staat en nooit afgaat -- en hij
   was aan de uitslag alleen te zien doordat het getal niet bewoog.

   DE GRENS. Een familie wint van de bewakerskaart, maar het is geen
   tegenspraak: de kaart zegt welke SESSIE er nodig is, de familie welke PAS
   die sessie moet dragen. Dat is een verfijning, en hij wordt geteld en gemeld
   zodat niemand denkt dat de kaart iets anders vond.
   ========================================================================== */
test('de Lifestyle-familie dekt routes die al een rol hebben', () => {
  const { alleRoutes, isSchakel, verdeelOpRol } = require('../scripts/lib/routes');
  const { ROLLEN } = require('../scripts/lib/proefsleutels');
  const m = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET' &&
    !isSchakel(r.pad) && !r.pad.includes(':'));
  const v = verdeelOpRol(m, ROLLEN);
  const metRolFamilies = FAMILIES.filter(f => f.rol);
  let opwaardeerbaar = 0;
  for (const r of v.metRol) {
    const f = metRolFamilies.find(x => x.prefixen.some(p => r.pad.startsWith(p)));
    if (f && f.rol !== r.rol) opwaardeerbaar++;
  }
  assert.ok(opwaardeerbaar > 50,
    'er horen tientallen routes te zijn waarvan een familie de rol opwaardeert, gevonden: ' +
    opwaardeerbaar + '. Staat dit op 0, dan zit de opwaardering er niet meer in en doet ' +
    'de Lifestyle-familie stilzwijgend niets');
});
