/* Ronde: het bestuur -- wie beslist, wie bezit, en wie er als UBO uit volgt.

   Vijf beweringen:

   1. DIT BESTAAT ALLEEN WAAR HET ECHT BESTAAT. Een eenmanszaak heeft geen
      bestuur. Een leeg register zou lezen als "u moet dit nog invullen", en dan
      verzint iemand een bestuur voor een bedrijf dat er geen kan hebben.
   2. HET VERBOD WINT, OOK HIER. Een stichting kent geen aandelen, en dat komt
      uit dezelfde `verboden` als de capslijst -- niet uit een tweede lijstje
      rechtsvormen dat hier apart wordt bijgehouden.
   3. DE UBO WORDT AFGELEID EN NIET INGEVULD. Boven de 25% is een regel; er is
      dan ook geen route die hem zet. Een aangevinkte UBO blijft staan als de
      aandelen verschuiven.
   4. GEEN BELANGHEBBENDE BOVEN DE DREMPEL BETEKENT DE BESTUURDERS. Dat heet een
      pseudo-UBO en is niet minder geldig.
   5. AFTREDEN IS GEEN WISSEN. Wie er ooit bestuurder was, was dat -- en juist
      die geschiedenis is waar een aansprakelijkheidsvraag over gaat.

   Draai los: node --test test/onderneming-bestuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

/* De leden in deze ronde. Reiger is volledig gekeurd, Zilverspar niet -- dat
   verschil is precies wat de UBO-grondslag hoort te laten zien. */
const GIDS = {
  Reiger: { key: 'user-1', niveau: 'A4' },
  Zilverspar: { key: 'user-2', niveau: 'A1' },
  Toezicht: { key: 'user-3', niveau: 'A3' },
  Denker: { key: 'user-4', niveau: 'A3' },
  Eik: { key: 'user-5', niveau: 'A3' },
  Beuk: { key: 'user-6', niveau: 'A3' },
  Wilg: { key: 'user-7', niveau: 'A3' },
  Els: { key: 'user-8', niveau: 'A3' },
  Marter: { key: 'user-9', niveau: 'A3' },
  Otter: { key: 'user-10', niveau: 'A3' }
};

const maakOnderneming = require('../server/kern/onderneming');
const BST = require('../server/kern/onderneming/bestuur');

function stubKern() {
  const data = { ondernemingen: [], suppliers: [], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: () => null, ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) },
    /* Sinds deze ronde wijst een bestuurder naar een MENS: de codenaam wordt in
       de ledengids opgezocht. Deze stub IS die gids -- wie erin staat is lid,
       de rest moet met zoveel woorden als extern worden opgegeven. Het niveau
       verschilt per lid, zodat de grondslag van de UBO iets te zeggen heeft. */
    keyVanCodenaam: async (c) => (GIDS[c] ? { key: GIDS[c].key, codename: c } : null),
    lidstandVan: (key) => ({ niveau: { id: (Object.values(GIDS).find(g => g.key === key) || {}).niveau || 'A1' } })
  });
}

function ond(K, rechtsvorm) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (rechtsvorm) K.ondernemingRechtsvorm(o, rechtsvorm);
  return o;
}

/* ---------------- bestaat het wel ---------------- */

test('zonder rechtsvorm komt er geen register maar de vraag', async () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K));
  assert.equal(b.stand, 'geen-rechtsvorm');
  assert.ok(b.uitleg.includes('misschien niet mag bestaan'));
  assert.equal(b.bestuurders, undefined, 'en geen lege lijsten die op invullen lijken');
});

test('een eenmanszaak heeft geen bestuur, en zegt dat', async () => {
  const K = stubKern();
  const o = ond(K, 'eenmanszaak');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.stand, 'niet-van-toepassing');
  assert.ok(b.uitleg.includes('U bent de onderneming'));
  assert.ok(b.let.includes('leeg register'));

  const poging = await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  assert.equal(poging.status, 409, 'en er valt ook niets in te zetten');
});

test('een B.V. heeft een bestuur en aandeelhouders', async () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K, 'bv'));
  assert.equal(b.stand, 'bestaat');
  assert.equal(b.magAandelen, true);
  assert.deepEqual(b.bestuurders, []);
  assert.equal(b.aandelenGeweerd, null);
});

/* ---------------- het verbod wint ---------------- */

test('een stichting kent geen aandelen, en dat komt uit de verboden', async () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.stand, 'bestaat', 'een stichting heeft wel een bestuur');
  assert.equal(b.magAandelen, false);
  assert.ok(b.aandelenGeweerd.includes('geen aandelen'));
  assert.equal(b.verdeeld, null, 'en dus ook geen verdeling van iets dat niet bestaat');

  const poging = await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 100 });
  assert.equal(poging.status, 409);
  assert.ok(poging.uitleg.includes('eigenschap van de rechtsvorm'));

  /* En de grendel zit in de rechtsvorm-as, niet hier: geen tweede lijstje. */
  const bron = require('fs').readFileSync('server/kern/onderneming/bestuur.js', 'utf8');
  assert.ok(!/stichting|vereniging/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'nergens een lijst rechtsvormen in de code: dat zou een tweede waarheid zijn');
});

/* De grendel moet ook winnen van een ANDERE as. Dit is het geval waarvoor
   `verboden` apart van `caps` bestaat: zou een werkvorm de cap meebrengen, dan
   zette die de knop er alsnog neer. Zonder deze toets was de aftrek in
   ./bestuur.js decoratie -- een mutatie die hem weghaalde liet niets zakken. */
test('een werkvorm die aandeelhouders meebrengt, wint het niet van het verbod', async () => {
  const zaak = { code: 'STG', name: 'Stichting Proef', type: 'fonds', staff: [{ id: 1 }],
    services: [], boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {}, thuisHuizen: {},
    /* Een werkvorm die de cap wél draagt. Verzonnen voor deze toets, en dat mag:
       het gaat om de vraag of het verbod wint van welke andere as dan ook. */
    supplierTypes: { fonds: { label: 'Fonds', caps: ['aandeelhouders', 'aandelen', 'bestuur'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'STG' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingKoppel(o, 'STG', MIJN_ZAAK);
  K.ondernemingRechtsvorm(o, 'stichting');

  assert.ok(db.capsVan(zaak).includes('aandeelhouders'), 'de werkvorm brengt hem echt mee');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.magAandelen, false,
    'wat verboden is wint altijd -- anders zet de eerste as die hem meebrengt de knop er alsnog neer');
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 10 })).status, 409);
  assert.ok(K.ondernemingBeeld(o).geweerd.some(g => g.cap === 'aandelen'),
    'en het scherm kan uitleggen waarom de knop er niet staat');
});

/* ---------------- de UBO ---------------- */

test('boven de 25 procent is iemand uiteindelijk belanghebbende', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  await K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'belang');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger', 'Zilverspar']);
  assert.equal(BST.UBO_DREMPEL, 25);
});

test('precies 25 procent is niet boven de drempel', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  /* Codenamen van twee tekens of meer: eennaam-letters worden al op de lengte
     geweigerd, en dan zou deze toets slagen zonder ooit een aandeelhouder te
     hebben gehad -- precies wat een mutatie op de drempel blootlegde. */
  for (const n of ['Reiger', 'Zilverspar', 'Marter', 'Otter']) {
    assert.equal((await K.ondernemingAandeelZet(o, { codenaam: n, percentage: 25 })).ok, true);
  }
  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'pseudo',
    'meer dan 25% is de wet, niet 25% of meer -- die grens is niet onze afronding');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger']);
  assert.ok(b.ubo.let.includes('pseudo-UBO'));
});

test('zonder belang en zonder bestuurder is er geen UBO, met de reden', async () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K, 'bv'));
  assert.equal(b.ubo.soort, 'geen');
  assert.deepEqual(b.ubo.personen, []);
  assert.ok(b.ubo.let.includes('Elke rechtspersoon heeft er een'));
});

test('een commissaris en een adviseur tellen niet mee als pseudo-UBO', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Toezicht', rol: 'commissaris' });
  await K.ondernemingBestuurderZet(o, { codenaam: 'Denker', rol: 'adviseur' });
  assert.equal(K.ondernemingBestuur(o).ubo.soort, 'geen',
    'zij vertegenwoordigen de onderneming niet');

  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'pseudo');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger']);
  assert.equal(b.bestuurders.length, 3, 'ze staan wel gewoon in het register');
});

test('de UBO verschuift mee als de aandelen verschuiven', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  assert.equal(K.ondernemingBestuur(o).ubo.soort, 'pseudo');

  await K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 51 });
  const na = K.ondernemingBestuur(o);
  assert.equal(na.ubo.soort, 'belang');
  assert.deepEqual(na.ubo.personen.map(p => p.codenaam), ['Zilverspar'],
    'afgeleid en niet aangevinkt: een aangevinkte UBO was blijven staan');
});

test('er is geen route en geen functie die de UBO zet', async () => {
  const K = stubKern();
  assert.ok(!Object.keys(K).some(k => /ubo/i.test(k)), 'de kern biedt er geen');
  const route = require('fs').readFileSync('server/routes/member/onderneming-bestuur.js', 'utf8');
  assert.ok(!/\/ubo/.test(route), 'en de routes ook niet');
});

/* ---------------- de verdeling ---------------- */

test('boven de honderd procent uitkomen kan niet', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 70 });
  const r = await K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  assert.equal(r.status, 409);
  assert.equal(r.ruimte, 30, 'met de ruimte die er nog is erbij');
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 1);
});

test('een belang van nul of meer dan honderd wordt geweigerd', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 0 })).status, 400);
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 101 })).status, 400);
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'Reiger' })).status, 400);
  /* En de codenaam zelf, zodat het bovenstaande niet slaagt op de lengte. */
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'A', percentage: 10 })).status, 400);
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 0);
});

test('een niet volledig verdeeld kapitaal is een melding en geen fout', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.verdeeld.totaal, 60);
  assert.equal(b.verdeeld.open, 40);
  assert.ok(b.verdeeld.melding.includes('Tijdens een oprichting is dat normaal'),
    'een register dat rood kleurt terwijl er niets mis is, leert iemand rood te negeren');

  await K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  assert.equal(K.ondernemingBestuur(o).verdeeld.melding, null);
});

test('een bestaand belang wijzigen telt niet dubbel', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  assert.equal((await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 90 })).ok, true,
    'zijn eigen 60 mag niet meetellen als bezet');
  assert.equal(K.ondernemingBestuur(o).verdeeld.totaal, 90);
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 1);
});

/* ---------------- het bestuur zelf ---------------- */

test('aftreden is geen wissen', async () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'voorzitter' });
  const id = K.ondernemingBestuur(o).bestuurders[0].id;

  const na = K.ondernemingBestuurderAf(o, id);
  assert.equal(na.ok, true);
  assert.equal(na.bestuurders.length, 0);
  assert.equal(na.afgetreden.length, 1, 'wie er ooit bestuurder was, was dat');
  assert.ok(na.afgetreden[0].tot, 'met de datum erbij');
});

test('dezelfde persoon staat maar een keer in het zittende bestuur', async () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'voorzitter' });
  assert.equal((await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'secretaris' })).status, 409);

  const id = K.ondernemingBestuur(o).bestuurders[0].id;
  K.ondernemingBestuurderAf(o, id);
  assert.equal((await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'secretaris' })).ok, true,
    'maar wie is afgetreden kan wel terugkomen');
});

test('een onbekende rol wordt geweigerd met de lijst erbij', async () => {
  const K = stubKern();
  const r = await K.ondernemingBestuurderZet(ond(K, 'bv'), { codenaam: 'Reiger', rol: 'baas' });
  assert.equal(r.status, 400);
  assert.ok(r.rollen.includes('bestuurder'));
});

/* ---------------- codenamen ---------------- */

test('het register draagt codenamen en zegt dat het niet de KvK-opgave is', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.bestuurders[0].codenaam, 'Reiger');
  assert.ok(b.voorbehoud.includes('niet de UBO-opgave'),
    'een register dat zich voordoet als de officiele opgave, is er een die niemand meer indient');
  assert.ok(b.voorbehoud.includes('codenaam'));
});

/* ---------------- de bron: naar wie wijst een regel ---------------- */

test('een bestuurder wijst naar een mens, niet naar zestig tekens tekst', async () => {
  /* Dit was het gat. Een codenaam was vrije tekst: je kon er iets in zetten dat
     niet bestaat, of een typefout maken in die van je medebestuurder, en niets
     merkte het. Bij een UBO-opgave is dat precies het veld dat ertoe doet. */
  const K = stubKern();
  const o = ond(K, 'bv');
  const goed = await K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  assert.equal(goed.ok, true);
  const rij = goed.bestuurders.find(x => x.codenaam === 'Reiger');
  assert.equal(rij.grond.bron, 'lid', 'de codenaam is opgezocht in de gids');
  assert.equal(rij.grond.niveau, 'A4', 'met het niveau dat er bij het inschrijven stond');

  const fout = await K.ondernemingBestuurderZet(o, { codenaam: 'Reigrr', rol: 'bestuurder' });
  assert.equal(fout.status, 404, 'een typefout wordt niet stil als buitenstaander opgeslagen');
  assert.match(fout.uitleg, /buiten RTG/i, 'en het zegt wat de twee mogelijkheden zijn');
});

test('iemand van buiten RTG mag wel, maar moet met zoveel woorden worden opgegeven', async () => {
  /* Een medeoprichter of investeerder zonder lidmaatschap bestaat echt. Die
     weigeren zou het register onbruikbaar maken; hem stil accepteren zou een
     typefout ononderscheidbaar maken van een bewuste opgave. */
  const K = stubKern();
  const o = ond(K, 'bv');
  const r = await K.ondernemingBestuurderZet(o, { codenaam: 'Van Dam Beheer', rol: 'commissaris', extern: true });
  assert.equal(r.ok, true);
  const rij = r.bestuurders.find(x => x.codenaam === 'Van Dam Beheer');
  assert.equal(rij.grond.bron, 'extern');
  assert.equal(rij.grond.niveau, null);
  assert.match(rij.grond.tekst, /niet gezien/i, 'het register zegt dat het een opgave is');
});

test('het niveau wordt bevroren en beweegt niet mee', async () => {
  /* Een register hoort te zeggen wat er bekend was toen de beslissing viel. Zou
     het meebewegen met de ledengids, dan verandert de geschiedenis met
     terugwerkende kracht -- het enige wat een register nooit mag doen. */
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingBestuurderZet(o, { codenaam: 'Zilverspar', rol: 'bestuurder' });
  assert.equal(K.ondernemingBestuur(o).bestuurders[0].grond.niveau, 'A1');
  GIDS.Zilverspar.niveau = 'A4';                       // het lid laat zich alsnog keuren
  assert.equal(K.ondernemingBestuur(o).bestuurders[0].grond.niveau, 'A1',
    'het register houdt vast wat er stond; de gids weet hoe het er nu voor staat');
  GIDS.Zilverspar.niveau = 'A1';
});

test('de UBO-opgave zegt waar hij op rust', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });          // A4
  await K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });      // A1
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'belang');
  /* Beiden zitten boven de 25%, dus zijn er twee belanghebbenden -- en juist
     dat maakt het punt: de een is gecontroleerd, de ander niet, en dat verschil
     hoort zichtbaar te zijn op het scherm waarmee je de opgave voorbereidt. */
  const g = b.ubo.grondslag;
  assert.deepEqual(g.personen.map(p => p.codenaam).sort(), ['Reiger', 'Zilverspar']);
  assert.equal(g.personen.find(p => p.codenaam === 'Reiger').niveau, 'A4');
  assert.equal(g.personen.find(p => p.codenaam === 'Zilverspar').niveau, 'A1');
  assert.match(g.let, /1 van de 2/, 'een van de twee is niet gecontroleerd');
  assert.match(g.let, /vervangt dat niet/i, 'en het doet niet alsof het de opgave zelf is');
  /* Hoe die zin per geval wordt gebouwd, staat in de toets onderaan; hier telt
     alleen dat de melding er is en waar hij over gaat. */

  // is iedereen gecontroleerd, dan valt er niets te melden
  const K2 = stubKern();
  const o2 = ond(K2, 'bv');
  await K2.ondernemingAandeelZet(o2, { codenaam: 'Reiger', percentage: 100 });       // A4
  assert.equal(K2.ondernemingBestuur(o2).ubo.grondslag.let, null);
});

/* ---------------- de geschiedenis van een belang ---------------- */

test('een belang wordt afgesloten en niet overschreven', async () => {
  /* Aftreden was al geen wissen -- "juist die geschiedenis is waar een
     aansprakelijkheidsvraag over gaat" -- maar voor de aandelen gold dat niet:
     een nieuw percentage overschreef het oude. Terwijl de UBO juist UIT de
     aandelen volgt, en de vraag bij een geschil is wie er WANNEER boven de
     drempel zat. */
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 20 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.aandelen.length, 1, 'er is een huidig belang');
  assert.equal(b.aandelen[0].percentage, 20);
  assert.equal(b.aandelenHistorie.length, 1, 'en het oude staat er nog, afgesloten');
  assert.equal(b.aandelenHistorie[0].percentage, 60);
  assert.ok(b.aandelenHistorie[0].tot, 'met een einddatum');
  assert.equal(b.verdeeld.totaal, 20, 'de verdeling telt alleen de huidige belangen');
});

test('een verkocht belang verdwijnt uit de verdeling maar niet uit de geschiedenis', async () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  const b1 = K.ondernemingBestuur(o);
  assert.equal(b1.ubo.soort, 'belang', 'Reiger zit boven de drempel');
  const weg = K.ondernemingAandeelWeg(o, b1.aandelen[0].id);
  assert.equal(weg.ok, true);
  const b2 = K.ondernemingBestuur(o);
  assert.equal(b2.aandelen.length, 0);
  assert.equal(b2.aandelenHistorie.length, 1, 'hij HIELD het, en dat blijft waar');
  assert.equal(b2.verdeeld.totaal, 0);
  assert.notEqual(b2.ubo.soort, 'belang', 'en de UBO verschuift mee');
});

test('hetzelfde belang nog eens zetten maakt geen lege regel in de geschiedenis', async () => {
  /* Een register dat bij elke opslag een regel bijschrijft, ook als er niets
     verandert, is na een maand niet meer te lezen. */
  const K = stubKern();
  const o = ond(K, 'bv');
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  await K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.aandelen.length, 1);
  assert.equal(b.aandelenHistorie.length, 0, 'niets veranderd, dus niets vastgelegd');
});

/* ---------------- en tegen een echte server ----------------
   De toetsen hierboven draaien op een gids-stub. Die bewijst de REGEL maar niet
   de BEDRADING: of de echte ledengids ook echt wordt geraadpleegd, staat of
   valt met een lezing tegen een draaiende server. Precies daar zat het gat --
   test/onderneming-routes.test.js komt niet zo ver, want daar heeft de
   onderneming nog geen rechtsvorm en valt de route al eerder af. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

test('de echte ledengids wordt geraadpleegd, niet alleen een stub', async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestuur-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  t.after(() => { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
  const api = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Oprichter', email: 'obe' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1985-02-02', tier: 'rtg', pasApp: 'rtg' });
  const tok = reg.body.token;
  const mijnCode = (await api('/api/state', {}, tok)).body.state.user.codename;
  assert.ok(mijnCode, 'het lid heeft een codenaam in de gids');

  const nieuw = await api('/api/onderneming/nieuw', { naam: 'Heldere Ramen' }, tok);
  const id = nieuw.body.onderneming.id;
  assert.equal((await api('/api/onderneming/rechtsvorm', { id, rechtsvorm: 'bv' }, tok)).status, 200);

  // de eigen codenaam wordt gevonden en levert een grond
  const goed = await api('/api/onderneming/bestuur/zet', { id, codenaam: mijnCode, rol: 'bestuurder' }, tok);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  const rij = goed.body.bestuurders.find(x => x.codenaam === mijnCode);
  assert.equal(rij.grond.bron, 'lid', 'de echte gids kent deze codenaam');
  assert.equal(rij.grond.niveau, 'A1', 'en levert het niveau uit de echte kluis');

  // een codenaam die niemand is, wordt geweigerd
  const fout = await api('/api/onderneming/bestuur/zet',
    { id, codenaam: 'Bestaat Niet 12345', rol: 'commissaris' }, tok);
  assert.equal(fout.status, 404);

  // tenzij hij als extern wordt opgegeven
  const extern = await api('/api/onderneming/bestuur/zet',
    { id, codenaam: 'Van Dam Beheer', rol: 'commissaris', extern: true }, tok);
  assert.equal(extern.status, 200);
  assert.equal(extern.body.bestuurders.find(x => x.codenaam === 'Van Dam Beheer').grond.bron, 'extern');
});

test('de grondslag zegt het in gewoon Nederlands, in alle drie de standen', async () => {
  const { grondslag } = require('../server/kern/onderneming/bestuur-persoon')({ scho: (v) => v });
  const r = (c, bron, niveauBij) => ({ codenaam: c, bron, niveauBij });
  const zin = (p, rij) => (grondslag(p, rij).let || '').split('.')[0];

  assert.equal(zin([{ codenaam: 'A' }], [r('A', 'lid', 'A1')]),
    'RTG heeft de identiteit van de belanghebbende niet gecontroleerd');
  assert.equal(zin([{ codenaam: 'A' }, { codenaam: 'B' }], [r('A', 'lid', 'A1'), r('B', 'lid', 'A4')]),
    'RTG heeft de identiteit van 1 van de 2 belanghebbenden niet gecontroleerd');
  assert.equal(zin([{ codenaam: 'A' }, { codenaam: 'B' }], [r('A', 'lid', 'A1'), r('B', 'extern', null)]),
    'RTG heeft van geen van de 2 belanghebbenden de identiteit gecontroleerd');
  assert.equal(grondslag([{ codenaam: 'A' }], [r('A', 'lid', 'A3')]).let, null,
    'is iedereen gecontroleerd, dan staat er niets -- geen groen vinkje dat niemand iets leert');
});
