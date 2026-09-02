/* ============================================================================
   ACHT ROUTES UIT DE SAMENVOEGING DIE NOOIT OVER DE DRAAD ZIJN GEGAAN.

   De contextbrug (kern/appstore/context.js), de firewall (kern/consent-relaties.js)
   en de fondsschakel (kern/labfonds/onderzoek.js) hebben alle drie een toets op
   de KERN -- rechtstreeks op de functie, met een verzonnen opslag eronder. Wat
   die toetsen niet zien is de DEUR: wie er langs mag, welke sessiesleutel de
   route erin stopt, en of het antwoord dat een browser krijgt nog dezelfde
   grenzen draagt. Voor het routejournaal bestonden deze acht dus niet.

   Elke oproep hieronder toetst een grens die de route zegt te hebben:

     - de contextbrug hangt aan het LID en niet aan de app: een tweede lid komt
       er niet bij, een tweede app evenmin, en klaarzetten geeft de app niets
       (APPSTORE.md: het manifest vraagt, het lid geeft);
     - de firewall groepeert de toestemmingen VAN DE LEZER -- lid A hoort de
       relaties van lid B niet te zien;
     - /gevolgen TOONT wat er zou gebeuren en /sluit DOET het, en dat verschil
       is over de draad na te rekenen bij de bron zelf;
     - het observatorium is een cockpit die kan zakken (BESTUUR.md), en op de
       startdata zakt hij ook echt;
     - de fondsschakel toont van een onderzoek alleen de openbare ring, en een
       OPEN voorstel is een wens en geen financiering.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2).
   Alle vijftien zijn RAAK, en elke mutatie is daarna teruggezet:

   contextbrug (kern/appstore/context.js)
   - een onbekend veld negeren in plaats van weigeren -> toets 2 ZAKT
   - de identificatorcontrole (@, telefoon, iban) uitzetten -> toets 3 ZAKT
   - klaarzet() ook de kale `velden` laten teruggeven -> toets 4 ZAKT
   - lees() de overdracht laten verbruiken (`gelezen = true`) -> toets 5 ZAKT
   - de sleutelcontrole uit geef() halen -> toets 6 ZAKT (403 werd 200)
   - een gedeelde pot in plaats van een pot per lid -> toets 6 ZAKT op
     "lid B kon de overdracht van lid A lezen"

   firewall (kern/consent-relaties.js, routes/consent.js, kern/identiteit/commercieel.js)
   - de commerciele stand terugvallen op de EERSTE rij in de bak -> toets 8 ZAKT
     op "lid B ziet de relatie die lid A aanzette"; dit is de echte lekvorm
   - de deur (`auth`) van /relaties halen -> toets 7 ZAKT
   - gevolgenVan() ook laten intrekken -> toets 9 ZAKT op "het bekijken van de
     gevolgen zette de toestemming al uit"
   - relatieSluit() `{ ok: true }` laten melden zonder consentIntrek aan te
     roepen -> toets 11 ZAKT op "de toestemming stond na sluiten nog aan"

   observatorium (kern/livinglab/observatorium.js, routes/livinglab/werk.js)
   - de stand van het bord vast op 'in orde' zetten in plaats van de zwaarste
     van de seinen -> toets 12 ZAKT
   - officeAuth vervangen door auth -> toets 12 ZAKT op "stond open voor een lid"

   fondsschakel (kern/labfonds/onderzoek.js)
   - `openbaar` de hele studie laten spreiden -> toets 15 ZAKT op de veldenlijst
   - open voorstellen meetellen als toegezegd -> toets 15 ZAKT
   - de twee weigeringsredenen vervangen door een algemene -> toets 14 ZAKT

   Draai los: node --test test/appstore-lab-toestemming-routes.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-achtroutes-'));
let srv, base, office, lidA, lidB;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Twee ECHTE accounts, en met opzet geen /api/login met een tier: die geeft
   iedereen dezelfde sessiesleutel ('rtg'), en dan zou de isolatietoets hieronder
   alleen bewijzen dat twee tokens hetzelfde potje delen. */
async function nieuwLid(naam) {
  const email = naam + Date.now() + Math.random().toString(36).slice(2, 8) + '@voorbeeld.test';
  const r = await api('/api/auth/register', { name: 'Toets ' + naam, email,
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren mislukte: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

const dicht = (r, wat) => assert.ok(r.status === 401 || r.status === 403,
  wat + ' stond open (' + r.status + ')');

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = await kantoorAlsPersoon(base);
  assert.ok(office, 'geen kantoorsessie; het observatorium zit achter die deur');
  lidA = await nieuwLid('a');
  lidB = await nieuwLid('b');
});
test.after(() => {
  stop(srv);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ======================= DE CONTEXTBRUG ======================= */

test('de drie contextroutes hangen aan een sessie; zonder sessie is er geen overdracht', async () => {
  for (const pad of ['/api/appstore/context/klaarzet', '/api/appstore/context/lees', '/api/appstore/context/geef']) {
    dicht(await api(pad, { sleutel: 'x', id: 'x', velden: { bedrag: 1 } }), pad);
  }
});

test('klaarzetten neemt alleen velden uit de gesloten lijst, en noemt de lijst in de weigering', async () => {
  /* Een onbekend veld NEGEREN zou betekenen dat een aanroeper denkt iets mee te
     geven wat nooit aankomt. Het is dus een fout, en de fout noemt wat er wel
     bestaat -- anders moet de bouwer raden. */
  const r = await api('/api/appstore/context/klaarzet',
    { sleutel: 'rekenmachine', velden: { verzonnen: 1 } }, lidA);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /bestaat niet/);
  assert.match(r.body.error, /bedrag/, 'de gesloten lijst hoort in de weigering te staan');

  const leeg = await api('/api/appstore/context/klaarzet', { sleutel: 'rekenmachine', velden: {} }, lidA);
  assert.equal(leeg.status, 400, 'zonder waarden is er niets over te dragen');
});

test('langs deze weg komt niets waarmee een app een mens kan vinden', async () => {
  /* Regel 4 van de contextbrug: geen identificator. De bestemming is een
     plaatsnaam; wat op een e-mailadres of een rekeningnummer lijkt, komt er niet
     door -- ook niet als het lid het zelf zou bevestigen. */
  const mail = await api('/api/appstore/context/klaarzet',
    { sleutel: 'paklijst', velden: { bestemming: 'iemand@ergens.nl' } }, lidA);
  assert.equal(mail.status, 400);
  assert.match(mail.body.error, /contactgegeven|rekeningnummer/);

  const iban = await api('/api/appstore/context/klaarzet',
    { sleutel: 'paklijst', velden: { bestemming: 'NL91ABNA0417164300' } }, lidA);
  assert.equal(iban.status, 400, 'een iban is geen bestemming');
});

test('klaarzetten geeft de app NIETS: er ligt iets klaar dat het lid nog moet bevestigen', async () => {
  const r = await api('/api/appstore/context/klaarzet',
    { sleutel: 'rekenmachine', velden: { bedrag: 184.5, btwTarief: 21 } }, lidA);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.id, 'geen id om later te bevestigen');
  /* Het verschil dat de hele laag is: klaarzetten levert TOONBARE waarden voor
     het scherm van het lid, en niet de kale waarden die de app zou krijgen. */
  assert.equal(r.body.velden, undefined, 'klaarzetten leverde de kale waarden al op');
  assert.ok(Array.isArray(r.body.toont) && r.body.toont.length === 2);
  const bedrag = r.body.toont.find(t => t.veld === 'bedrag');
  assert.equal(bedrag.tekst, 'EUR 184,50', 'het lid leest het bedrag voluit en in zijn eigen notatie');
  assert.ok(bedrag.uitleg, 'elk veld draagt zijn uitleg; wie bevestigt hoort te zien waar hij ja op zegt');
  assert.match(r.body.let, /beslist zelf|krijgt de app niets/,
    'het antwoord zegt zelf dat de app nog niets heeft');
});

test('lezen verbruikt de overdracht niet, doorgeven wel -- en daarna bestaat hij niet meer', async () => {
  const klaar = await api('/api/appstore/context/klaarzet',
    { sleutel: 'paklijst', velden: { bestemming: 'Rome', duurDagen: 4 } }, lidA);
  const id = klaar.body.id;

  /* Twee keer lezen moet kunnen: het lid mag kijken voordat hij beslist. */
  const een = await api('/api/appstore/context/lees', { id }, lidA);
  assert.equal(een.status, 200, JSON.stringify(een.body));
  assert.equal(een.body.velden, undefined, 'lezen leverde de kale waarden op');
  const twee = await api('/api/appstore/context/lees', { id }, lidA);
  assert.equal(twee.status, 200, 'kijken verbruikte de overdracht');

  /* Doorgeven is de bevestiging van het lid: NU pas komen de kale waarden vrij. */
  const geef = await api('/api/appstore/context/geef', { id, sleutel: 'paklijst' }, lidA);
  assert.equal(geef.status, 200, JSON.stringify(geef.body));
  assert.deepEqual(geef.body.velden, { bestemming: 'Rome', duurDagen: 4 });

  /* En hij is eenmalig: wat met een oud webadres nog iets in gang kan zetten,
     hoort tijdelijk te zijn (LINK.md par. 3). */
  const nog = await api('/api/appstore/context/geef', { id, sleutel: 'paklijst' }, lidA);
  assert.equal(nog.status, 404, 'dezelfde overdracht kon een tweede keer worden doorgegeven');
  assert.match(nog.body.error, /verlopen of al doorgegeven/);
  assert.equal((await api('/api/appstore/context/lees', { id }, lidA)).status, 404,
    'een doorgegeven overdracht is ook niet meer te lezen');
});

test('een overdracht is voor EEN app, en van EEN lid', async () => {
  const klaar = await api('/api/appstore/context/klaarzet',
    { sleutel: 'rekenmachine', velden: { bedrag: 12 } }, lidA);
  const id = klaar.body.id;

  /* Een andere app: geweigerd MET de reden, en de overdracht blijft staan. */
  const ander = await api('/api/appstore/context/geef', { id, sleutel: 'paklijst' }, lidA);
  assert.equal(ander.status, 403);
  assert.match(ander.body.error, /andere app/);

  /* Een ander lid: hij bestaat daar niet. De sleutel komt uit de sessie en
     nooit uit de body, dus lid B kan de id van lid A wel intikken maar niet
     gebruiken -- en hij krijgt geen ander antwoord dan "hier staat niets". */
  assert.equal((await api('/api/appstore/context/lees', { id }, lidB)).status, 404,
    'lid B kon de overdracht van lid A lezen');
  assert.equal((await api('/api/appstore/context/geef', { id, sleutel: 'rekenmachine' }, lidB)).status, 404,
    'lid B kon de overdracht van lid A doorgeven');

  // en na dat alles is hij voor lid A nog gewoon bruikbaar
  assert.equal((await api('/api/appstore/context/geef', { id, sleutel: 'rekenmachine' }, lidA)).status, 200,
    'de geweigerde pogingen hebben de overdracht van lid A verbruikt');
});

/* ======================= DE PERMISSION FIREWALL ======================= */

test('de drie toestemmingsroutes staan achter de ledendeur', async () => {
  for (const pad of ['/api/toestemming/relaties', '/api/toestemming/relatie/gevolgen', '/api/toestemming/relatie/sluit']) {
    dicht(await api(pad, { partij: 'rtg' }), pad);
  }
});

test('de relaties zijn die van DE LEZER: lid A ziet de zijne, lid B niet', async () => {
  /* De commerciele toestemming is de kortste weg naar een rij met een partij:
     hij staat standaard uit, hij gaat aan met een handeling van het lid zelf,
     en hij landt in het Consent Center onder partij 'rtg'. */
  const aan = await api('/api/mijn/post/zet', { soort: 'aanbiedingen', kanalen: ['email'], bron: 'toets' }, lidA);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));

  const a = await api('/api/toestemming/relaties', {}, lidA);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const rtg = (a.body.relaties || []).find(r => r.partij === 'rtg');
  assert.ok(rtg, 'wat lid A aanzette staat niet bij zijn relaties');
  assert.ok(rtg.aantal >= 1 && rtg.teSluiten >= 1, 'de groep telt niet wat erin zit');

  /* DE INVARIANT VAN DEZE ROUTE. relatiesVan groepeert de toestemmingen van de
     sessiesleutel; er is geen partij-, lid- of codeveld in de body waarmee je
     naar iemand anders kunt wijzen. Lid B zette niets aan en hoort dus niets
     van lid A te zien. */
  const b = await api('/api/toestemming/relaties', {}, lidB);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal((b.body.relaties || []).some(r => r.partij === 'rtg'), false,
    'lid B ziet de relatie die lid A aanzette');

  /* En het overzicht zegt zelf waar het ophoudt: vier dingen staan er met opzet
     buiten, elk met een reden. Zonder die lijst leest een lege pagina als
     "niemand raakt mij aan". */
  assert.ok(Array.isArray(a.body.buiten) && a.body.buiten.length >= 4);
  for (const x of a.body.buiten) assert.ok(x.naam && x.reden, 'een uitzondering zonder reden');
});

test('/gevolgen TOONT en voert niet uit -- na afloop staat de toestemming er nog', async () => {
  const g = await api('/api/toestemming/relatie/gevolgen', { partij: 'rtg' }, lidA);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.ok(Array.isArray(g.body.sluit) && g.body.sluit.length >= 1, 'de voorbeschouwing noemt niets dat sluit');
  /* Een gevolgsimulatie die "dit is alles" suggereert zonder te zeggen waar zij
     niet keek, koopt vertrouwen dat zij niet heeft verdiend. */
  assert.ok(Array.isArray(g.body.nietGerekend) && g.body.nietGerekend.length >= 1);

  /* De bewijsvoering staat bij de BRON en niet in het antwoord: de laag die de
     toestemming beheert, laat hem nog gewoon aanstaan. */
  const stand = await api('/api/mijn/post', {}, lidA);
  const soort = (stand.body.soorten || []).find(s => s.id === 'aanbiedingen');
  assert.equal(soort && soort.aan, true, 'het bekijken van de gevolgen zette de toestemming al uit');
  const nog = await api('/api/toestemming/relaties', {}, lidA);
  assert.ok((nog.body.relaties || []).some(r => r.partij === 'rtg'), 'de relatie verdween na alleen kijken');
});

test('gevolgen van een relatie die niet bestaat, worden niet verzonnen', async () => {
  const r = await api('/api/toestemming/relatie/gevolgen', { partij: 'bestaat-niet' }, lidA);
  assert.equal(r.status, 404);
  assert.match(r.body.error, /kennen wij niet/);
  const leeg = await api('/api/toestemming/relatie/gevolgen', {}, lidA);
  assert.equal(leeg.status, 404, 'zonder partij is er ook geen relatie');
});

test('/sluit DOET het wel, en doet het bij de laag zelf', async () => {
  const s = await api('/api/toestemming/relatie/sluit', { partij: 'rtg' }, lidA);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.ok(s.body.gesloten >= 1, 'er ging niets dicht');
  assert.equal(s.body.mislukt, 0, JSON.stringify(s.body.gedaan));
  /* Ook als alles lukte, blijft de reikwijdte erbij staan. */
  assert.ok(Array.isArray(s.body.nietGeraakt) && s.body.nietGeraakt.length >= 1);

  /* Bij de BRON is het uit. Dit is de helft die telt: een intrekknop die het
     overzicht opschoont maar de laag niet raakt, is erger dan geen knop. */
  const stand = await api('/api/mijn/post', {}, lidA);
  const soort = (stand.body.soorten || []).find(s2 => s2.id === 'aanbiedingen');
  assert.equal(soort && soort.aan, false, 'de commerciele toestemming stond na sluiten nog aan');
  const na = await api('/api/toestemming/relaties', {}, lidA);
  assert.equal((na.body.relaties || []).some(r => r.partij === 'rtg'), false,
    'de gesloten relatie staat nog op het overzicht');
});

/* ======================= HET OBSERVATORIUM ======================= */

test('het observatorium is van het kantoor, en het bord KAN zakken -- op de startdata zakt hij ook', async () => {
  dicht(await api('/api/lab2/observatorium', {}), '/api/lab2/observatorium');
  dicht(await api('/api/lab2/observatorium', {}, lidA), '/api/lab2/observatorium voor een lid');

  const r = await api('/api/lab2/observatorium', {}, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.seinen.length, 6, 'zes seinen');
  for (const s of r.body.seinen) {
    assert.ok(['in orde', 'niet vast te stellen', 'storing'].includes(s.stand), s.code + ': ' + s.stand);
    assert.ok(s.graad && s.op, s.code + ' draagt geen bewijsgraad met datum');
    if (s.stand === 'niet vast te stellen') assert.equal(s.graad, 'onbekend',
      s.code + ': wat niet gepeild is, mag geen gemeten heten');
  }

  /* DE BEWERING DIE ERTOE DOET (BESTUUR.md: een cockpit die niet kan zakken is
     een dashboard). De startdata bevat met opzet een sensor die NOOIT is
     gekalibreerd, dus het ijksein staat op storing -- en het bord neemt de
     ZWAARSTE van zijn seinen over en niet een gemiddelde. */
  const ijking = r.body.seinen.find(s => s.code === 'ijking');
  assert.equal(ijking.stand, 'storing', 'de ongekalibreerde startsensor gaf geen storing');
  assert.ok((ijking.apparaten || []).some(a => /nooit gekalibreerd/.test(a.reden || '')),
    'het sein noemt niet waarom het apparaat eruit ligt');
  assert.equal(r.body.stand, 'storing', 'het bord bleef groen terwijl een sein op storing stond');

  /* En wat het bord NIET zegt, staat erbij: zonder die regels wordt groen
     gelezen als "het onderzoek deugt". */
  assert.ok(Array.isArray(r.body.zegtNiet) && r.body.zegtNiet.length >= 3);
  assert.ok(r.body.zegtNiet.some(z => /ranglijst|score/.test(z)), 'er staat niet bij dat er geen oordeel over mensen op staat');
});

test('het observatorium van een lab dat niet bestaat, verzint geen leeg bord', async () => {
  const r = await api('/api/lab2/observatorium', { id: 'bestaat-niet' }, office);
  assert.equal(r.status, 404);
  assert.match(r.body.error, /bestaat niet/);
});

/* ======================= DE FONDSSCHAKEL ======================= */

test('de financieringskaart staat achter de ledendeur en wijst nooit naar niets', async () => {
  dicht(await api('/api/labfonds/financiering', { onderzoek: 'seedstudiewater' }), '/api/labfonds/financiering');

  /* Twee weigeringen met verschillende reden, en dat verschil is de bedoeling:
     wie een geldig onderzoeksNUMMER intikt dat niet bestaat, hoort iets anders
     te lezen dan wie iets intikt dat geen nummer is. */
  const nummer = await api('/api/labfonds/financiering', { onderzoek: 'RTF-AMS-2026-0009' }, lidA);
  assert.equal(nummer.status, 404);
  assert.match(nummer.body.error, /staat niet in het Living Lab/);

  const onzin = await api('/api/labfonds/financiering', { onderzoek: 'zomaar-iets' }, lidA);
  assert.equal(onzin.status, 404);
  assert.match(onzin.body.error, /RTF-/, 'de weigering laat niet zien hoe een onderzoeksnummer eruitziet');

  const leeg = await api('/api/labfonds/financiering', {}, lidA);
  assert.equal(leeg.status, 404);
  assert.match(leeg.body.error, /geen onderzoek genoemd/);
});

test('van het onderzoek komt alleen de openbare ring mee, en een OPEN voorstel is geen financiering', async () => {
  /* Een eigen locatie en een eigen pot, zodat deze toets niets van een andere
     toets leent en niets aan een gedeelde pot verandert. */
  const locNaam = 'Toetsplaats ' + Date.now();
  const loc = await api('/api/labfonds/locatie/maak', { naam: locNaam, land: 'NL' }, lidA);
  assert.equal(loc.status, 200, JSON.stringify(loc.body));
  const locId = loc.body.locatie.id;
  assert.equal((await api('/api/labfonds/doneer', { locId, bedrag: 10 }, lidA)).status, 200);

  const voorstel = await api('/api/labfonds/voorstel/maak', {
    locId, titel: 'Regenmeters voor de Kerkstraat',
    doel: 'Twee extra regenmeters plaatsen zodat de buurt weet hoe vaak het water blijft staan.',
    bedrag: 1, onderzoek: 'seedstudiewater' }, lidA);
  assert.equal(voorstel.status, 200, JSON.stringify(voorstel.body));
  const vId = voorstel.body.voorstel.id;

  const open = await api('/api/labfonds/financiering', { onderzoek: 'seedstudiewater' }, lidA);
  assert.equal(open.status, 200, JSON.stringify(open.body));

  /* REGEL 4 VAN DE SCHAKEL: het fonds is een openbare ledenpagina, dus er komt
     geen dossierinhoud langs deze weg naar buiten. Alleen de velden die het lab
     zelf aan een voorbijganger toont. */
  assert.deepEqual(Object.keys(open.body.onderzoek).sort(),
    ['id', 'labId', 'nummer', 'soort', 'stap', 'titel'],
    'er komt een ander veld van het onderzoek mee dan de openbare ring');
  assert.equal(open.body.onderzoek.dossier, undefined);
  assert.equal(open.body.onderzoek.vraagstuk, undefined, 'de vraagstelling uit het dossier lekte mee');

  /* EN DE SCHEIDING DIE HET GETAL EERLIJK HOUDT: toegezegd is wat is TOEGEKEND.
     Een openstaand voorstel is een wens, en samengeteld zou het financiering
     lijken. */
  assert.equal(open.body.financiering.toegezegd.bedrag, 0, 'een open voorstel telde als toegezegd');
  assert.ok(open.body.financiering.openVoorstellen.some(v => v.id === vId),
    'het open voorstel staat nergens');
  assert.ok(open.body.financiering.zegtNiet.some(z => /verwerkte betaling/.test(z)),
    'er staat niet bij dat dit een toezegging is en geen betaling');

  /* Pas het BESLUIT maakt er financiering van, en dan verhuist het voorstel van
     de ene lijst naar de andere. */
  const beslis = await api('/api/labfonds/beslis', { id: vId }, lidA);
  assert.equal(beslis.status, 200, JSON.stringify(beslis.body));
  assert.equal(beslis.body.voorstel.status, 'toegekend', JSON.stringify(beslis.body.voorstel.besluit));

  const na = await api('/api/labfonds/financiering', { onderzoek: 'seedstudiewater' }, lidA);
  assert.equal(na.body.financiering.toegezegd.bedrag, 1, 'het toegekende bedrag komt niet bij het onderzoek terecht');
  assert.equal(na.body.financiering.toegezegd.graad, 'gemeten');
  assert.ok(na.body.financiering.toegezegd.herkomst, 'een getal zonder herkomst');
  assert.ok(na.body.financiering.toegezegd.voorstellen.some(v => v.id === vId && v.locatie === locNaam),
    'het toegekende voorstel staat niet bij het onderzoek, of zonder zijn locatie');
  assert.equal(na.body.financiering.openVoorstellen.some(v => v.id === vId), false,
    'het voorstel staat in beide lijsten tegelijk');
});
