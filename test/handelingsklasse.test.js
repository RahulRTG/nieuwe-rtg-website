/* WAT VOOR HANDELING IS DIT? (server/kern/handelingsklasse.js, TAKEN.md 4.71)

   WAT HIER OP HET SPEL STAAT. `risicoklasse` en `omkeerbaarheid` waren twee van
   de drie dakloze envelopvelden, en de reden dat ze dakloos bleven staat er twee
   ronden lang: een VERZONNEN risicoklasse is gevaarlijker dan geen. Deze laag
   geeft ze een drager zonder dat er iets verzonnen wordt -- hij LEEST het beleid
   dat dit huis al heeft. Deze toets bewaakt precies dat onderscheid, want zodra
   het wegvalt is de hele laag een orakel.

   VIJF DINGEN DIE HIER VASTLIGGEN:

     1. ELKE WAARDE DRAAGT EEN BRON EN EEN BEWIJSGRAAD. Een klasse zonder bron is
        een mening met een getal eromheen.
     2. `onbekend` IS EEN EERSTEKLAS UITSLAG. Geen bron gevonden geeft `onbekend`
        met een reden, en nooit stil een middenklasse. Zou een ontbrekend
        register een middenwaarde opleveren, dan spreekt dit huis over duizenden
        routes een oordeel uit dat niemand heeft geveld.
     3. `ongemarkeerd` IS GEEN `laag`. Het feit is dat geen grens deze route
        aanwijst; dat is iets anders dan de bewering dat hij ongevaarlijk is.
        Deze toets zakt zodra die naam een risico-uitspraak wordt.
     4. DE STRENGSTE BRON WINT. De bodem onder de frictie gaat voor de
        AI-allowlist: wat nooit geautomatiseerd mag worden, mag niet zachter
        uitkomen omdat een andere lijst er milder over doet.
     5. HIJ HOUDT NIETS TEGEN. Dit is een classificatie en geen poort. Zou hij
        kunnen weigeren, dan staat er een tweede poort naast bodem.js en
        kern/pay/poort.js -- en twee plekken die hetzelfde tegenhouden lopen
        uiteen (LAT.md regel 4).

   Draai los: node --test test/handelingsklasse.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../server/kern/handelingsklasse.js');

const WORTEL = path.join(__dirname, '..');
const maak = (deps) => K.maakHandelingsklasse(deps || {});

test('de vier bronnen leveren elk hun eigen klasse, met bron en graad', () => {
  const k = maak();
  const hand = k.klasseVoor('POST', '/api/aanmelding/status');
  assert.equal(hand.risicoklasse, 'hoog', 'een pasbesluit is de strengste bodem die er is');
  assert.match(hand.risicoBron, /kern\/frictie\/bodem\.js:/);
  assert.equal(hand.risicoGraad, 'bewezen');

  const assist = k.klasseVoor('POST', '/api/bank/sepa');
  assert.equal(assist.risicoklasse, 'verhoogd', 'geld dat het huis verlaat vraagt een mens');
  assert.match(assist.risicoBron, /bodem\.js:geld-het-huis-uit/);

  const onbekend = k.klasseVoor('POST', '/api/dit/pad/bestaat/niet');
  assert.equal(onbekend.risicoklasse, 'ongemarkeerd');
  assert.match(onbekend.risicoReden, /niet dat het risico laag is/,
    'de reden moet zeggen dat er NIETS is vastgesteld, niet dat het meevalt');
});

test('omkeerbaarheid komt uit de ECHTE herstelproef, en alleen daaruit', () => {
  const k = maak();
  assert.ok(k.beproefdePaden() > 20, 'er zijn te weinig beproefde paden (' + k.beproefdePaden() + ')');
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERSTELPROEF.json'), 'utf8'));
  const echt = (reg.per || []).find(p => p.uitslag === 'compensatie');
  assert.ok(echt, 'de herstelproef draagt geen enkel gemeten paar meer');

  const uit = k.klasseVoor('POST', echt.heen);
  assert.equal(uit.omkeerbaarheid, echt.uitslag, 'de uitslag hoort woordelijk uit het register te komen');
  assert.equal(uit.omkeerbaarGraad, 'gemeten');
  assert.equal(uit.omkeerbaarBron, 'HERSTELPROEF.json');

  /* En de TERUGweg draagt de uitslag NIET. Die is het gereedschap waarmee is
     gemeten; hem omkeerbaar noemen zou zeggen dat /api/agenda/verwijder
     omkeerbaar is omdat hij iets anders omkeert. */
  if (echt.terug) {
    assert.equal(k.klasseVoor('POST', echt.terug).omkeerbaarheid, K.ONBEKEND);
  }
});

test('NIET BEPROEFD IS NIET ONOMKEERBAAR, en de reden zegt dat', () => {
  const k = maak();
  const uit = k.klasseVoor('POST', '/api/dit/pad/bestaat/niet');
  assert.equal(uit.omkeerbaarheid, K.ONBEKEND);
  assert.match(uit.omkeerbaarReden, /niet beproefd is/);
});

test('EEN ONTBREKEND REGISTER GEEFT `onbekend` MET EEN REDEN, en geen middenwaarde', () => {
  /* De gevaarlijkste faalvorm van deze laag: een register dat niet te lezen is
     en een classificatie die dan toch een klasse noemt. */
  const zonder = K.maakHandelingsklasse({ herstel: null });
  const uit = zonder.klasseVoor('POST', '/api/agenda/bewaar');
  assert.equal(uit.omkeerbaarheid, K.ONBEKEND);
  assert.match(uit.omkeerbaarReden, /niet te lezen/);

  /* Een MEEGEGEVEN null betekent "deze bron is er niet". Zou dat terugvallen op
     de echte bron -- wat het deed, met `||` -- dan meet deze bewering stil de
     registers van het huis en bewijst hij niets. */
  const leeg = K.maakHandelingsklasse({ bodem: null, beleid: null, herstel: null })
    .klasseVoor('POST', '/api/bank/sepa');
  assert.equal(leeg.risicoklasse, K.ONBEKEND);
  assert.match(leeg.risicoReden, /niets om op te classificeren/);
});

test('DE STRENGSTE BRON WINT: een bodem gaat voor de allowlist', () => {
  /* Met een nagemaakte allowlist die het pad als LEZEN opgeeft. Zou de allowlist
     voorgaan, dan komt een pasbesluit als "geen risico" uit de laag. */
  const k = K.maakHandelingsklasse({
    bodem: { bodemVoorPad: () => ({ id: 'proef', minimum: 'hand', waarom: 'nooit vanzelf' }) },
    beleid: { LEZEN: { member: ['/api/proef'] }, VOORSTEL: {} },
    herstel: new Map()
  });
  const uit = k.klasseVoor('POST', '/api/proef');
  assert.equal(uit.risicoklasse, 'hoog');
  assert.match(uit.risicoBron, /bodem/);
});

test('`geen` betekent: ergens lezen en NERGENS schrijven', () => {
  /* Zodra een rol via dat pad iets mag veranderen, is "dit verandert niets" niet
     houdbaar -- ongeacht wat de andere rollen mogen. */
  const bodem = { bodemVoorPad: () => null };
  const alleenLezen = K.maakHandelingsklasse({
    bodem, herstel: new Map(),
    beleid: { LEZEN: { member: [/^\/api\/proef$/] }, KLEIN: {}, VOORSTEL: {} }
  }).klasseVoor('GET', '/api/proef');
  assert.equal(alleenLezen.risicoklasse, 'geen');

  const ookSchrijven = K.maakHandelingsklasse({
    bodem, herstel: new Map(),
    beleid: { LEZEN: { member: [/^\/api\/proef$/] }, KLEIN: { supplier: [/^\/api\/proef$/] }, VOORSTEL: {} }
  }).klasseVoor('GET', '/api/proef');
  assert.equal(ookSchrijven.risicoklasse, 'ongemarkeerd',
    'een pad waar EEN rol via mag schrijven, verandert wel degelijk iets');
});

test('DE LIJSTEN ZIJN PATRONEN, en die worden TEGEN het pad gehouden', () => {
  /* De duurste fout van deze ronde, en hij is gemeten. De eerste versie deed
     `.includes(pad)` op LEZEN, KLEIN en VOORSTEL -- daar staan reguliere
     expressies in, dus die vergelijking matchte NOOIT. Over 4729 paden gaf hij
     0 keer `geen`, en dat las als een strenge regel terwijl het een dode
     vergelijking was. Na de reparatie: 58 keer `geen` en 110 `verhoogd`, en het
     aantal gemarkeerde routes ging van 82 naar 246.

     Exact dezelfde fout stond in scripts/gezagshandelingen.js. Dat is twee keer,
     en daarom staat hij hier met een toets eronder. */
  const k = K.maakHandelingsklasse({
    bodem: { bodemVoorPad: () => null }, herstel: new Map(),
    beleid: { LEZEN: { member: [/^\/api\/lees\/(een|twee)$/] }, KLEIN: {}, VOORSTEL: {} }
  });
  assert.equal(k.klasseVoor('GET', '/api/lees/een').risicoklasse, 'geen');
  assert.equal(k.klasseVoor('GET', '/api/lees/twee').risicoklasse, 'geen');
  assert.equal(k.klasseVoor('GET', '/api/lees/drie').risicoklasse, 'ongemarkeerd',
    'het patroon dekt dit pad niet, en dan hoort er niets uit te komen');

  /* En een echte route uit de echte lijst, zodat deze bewering ook zakt als de
     patronen in beleid.js van vorm veranderen. */
  const echt = K.maakHandelingsklasse({}).klasseVoor('GET', '/api/kantoorpakket/mijn');
  assert.equal(echt.risicoklasse, 'geen', 'een pad uit de echte lees-lijst wordt niet meer geraakt');
});

test('`onbekend` staat NIET op de risicoladder', () => {
  /* Wie hem erbij zet, kan hem sorteren en optellen -- en dan is "ik weet het
     niet" ineens een trede tussen twee andere. */
  assert.ok(!K.RISICO.includes(K.ONBEKEND));
  assert.deepEqual(K.RISICO, ['geen', 'ongemarkeerd', 'verhoogd', 'hoog']);
  assert.deepEqual(K.HERSTEL, ['exact', 'compensatie', 'geen-herstel'],
    'de uitslagen horen woordelijk die van HERSTELPROEF.json te zijn');
});

test('HIJ HOUDT NIETS TEGEN: geen enkele uitgang weigert of gooit', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'handelingsklasse.js'), 'utf8');
  assert.doesNotMatch(bron, /\bres\.status\b|\bthrow new Error\b/,
    'deze laag classificeert; weigeren hoort in bodem.js en kern/pay/poort.js');
  /* En hij valt niet om op rommel. Een classificatie die een verzoek kan laten
     omvallen is erger dan geen classificatie. */
  const k = maak();
  for (const raar of [null, undefined, '', 12, {}, '/api/' + 'x'.repeat(5000)]) {
    const uit = k.klasseVoor('POST', raar);
    assert.ok(uit.risicoklasse, 'geen klasse voor ' + JSON.stringify(raar));
    assert.ok(uit.omkeerbaarheid);
  }
});

test('DE HANDELING DRAAGT HEM, en de envelop met opzet niet', () => {
  /* De kop van server/opzet/envelop.js zegt dat een poortwachter deze twee niet
     kent. Deze toets houdt vast dat de laag daar niet alsnog binnenkruipt. */
  const envelop = fs.readFileSync(path.join(WORTEL, 'server', 'opzet', 'envelop.js'), 'utf8');
  assert.doesNotMatch(envelop, /handelingsklasse/,
    'de envelop haalt de classificatie binnen; dan belooft hij iets wat hij op dat moment niet weet');

  const handeling = require('../server/opzet/handeling.js');
  const req = { id: 'corr-k', path: '/api/aanmelding/status', method: 'POST' };
  const luisteraars = {};
  const res = { on: (n, fn) => { (luisteraars[n] = luisteraars[n] || []).push(fn); } };
  const mw = handeling.middleware({ data: () => ({}), log: () => {}, klasse: maak().klasseVoor });
  mw(req, res, () => {});
  for (const fn of luisteraars.finish || []) fn();
  assert.equal(req.handeling.risicoklasse, 'hoog');
  assert.match(req.handeling.risicoBron, /bodem\.js/);
  assert.equal(req.handeling.omkeerbaarheid, K.ONBEKEND);
});

test('EEN KLASSE DIE OMVALT LAAT HET VERZOEK STAAN', () => {
  /* De laag hangt in het antwoordpad van elk verzoek. Zou een fout in de
     classificatie doorslaan, dan valt een verzoek om op zijn eigen boekhouding
     -- dezelfde regel als in de kop van server/opzet/envelop.js. */
  const handeling = require('../server/opzet/handeling.js');
  const req = { id: 'corr-stuk', path: '/api/x', method: 'POST' };
  const luisteraars = {};
  const res = { on: (n, fn) => { (luisteraars[n] = luisteraars[n] || []).push(fn); } };
  const mw = handeling.middleware({ data: () => ({}), log: () => {},
    klasse: () => { throw new Error('stuk'); } });
  mw(req, res, () => {});
  for (const fn of luisteraars.finish || []) fn();
  assert.equal(req.handeling.klassefout, true, 'de fout hoort zichtbaar te zijn en niet stil');
  assert.equal(req.handeling.geraakt, 0, 'en de rest van de meting hoort gewoon af te zijn');
});

test('HANDELINGSKLASSE.json loopt niet achter, en zegt over hoeveel routes dit gaat', () => {
  /* HET GETAL IS DE HELFT VAN HET ANTWOORD. Een laag die elke handeling een
     klasse geeft klinkt gedekt; wat een lezer moet weten is over hoeveel routes
     er werkelijk iets is vastgesteld. Gemeten op 3 september 2026: van de 4729
     paden zijn er 246 door een grens gemarkeerd (58 `geen`, 110 `verhoogd`,
     78 `hoog`) en 4483 `ongemarkeerd`, en van de terugwegen zijn er 44 echt
     uitgevoerd.

     Deze bewering houdt vast dat het register die meting draagt en niet
     achterloopt -- en dat `ongemarkeerd` en `onbekend` er APART staan in plaats
     van bij het gemarkeerde opgeteld. */
  const meter = require('../scripts/handelingsklasse.js');
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HANDELINGSKLASSE.json'), 'utf8'));
  const nu = meter.meet();
  assert.equal(reg.gemeten.paden, nu.paden);
  assert.equal(reg.gemeten.risicoGemarkeerd, nu.risicoGemarkeerd);
  assert.equal(reg.gemeten.omkeerbaarGemeten, nu.omkeerbaarGemeten);

  assert.equal(nu.risicoGemarkeerd, nu.risico.geen + nu.risico.verhoogd + nu.risico.hoog,
    'het gemarkeerde telt `ongemarkeerd` mee; dan meet de ratel dekking die er niet is');
  assert.ok(nu.risico.ongemarkeerd > 0, 'geen enkele ongemarkeerde route -- klopt de meter nog?');
  assert.match(reg.grens, /geen laag risico/,
    'het register hoort zelf te zeggen dat `ongemarkeerd` geen laag risico is');
});

test('de ratel van de classificatie kan maar EEN kant op', () => {
  /* Een grens die verdwijnt of een gemeten terugweg die wegvalt, hoort een
     besluit te zijn en geen stille daling. */
  const meter = require('../scripts/handelingsklasse.js');
  const nu = meter.meet();
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HANDELINGSKLASSE.json'), 'utf8'));
  assert.ok(nu.risicoGemarkeerd >= reg.gemeten.risicoGemarkeerd);
  assert.ok(nu.omkeerbaarGemeten >= reg.gemeten.omkeerbaarGemeten);
});
