/* ============================================================================
   NEGENTIEN KANTOORDEUREN DIE NOOIT WERDEN GEOPEND.

   De dekkingsmeter telt welke endpoints de suite tijdens een run echt aanroept.
   Deze negentien -- de ledenbalie (klachten en zetels), het journaalbeeld en de
   hele kantoorkant van Payroll OS (dekking, bronnen, componenten, contracten,
   runs, aangiftes) -- stonden er allemaal buiten. Ze werkten misschien, ze
   werkten misschien niet; niemand kwam er ooit langs, dus het antwoord op die
   vraag was "dat weten we niet".

   WAT DEZE TOETS NADRUKKELIJK NIET DOET: de teller oppoetsen. Elke deur een keer
   aantikken en op 200 kijken zou de meter groen zetten en verder niets bewaken,
   en dat is precies wat LAT.md regel 9 een toets noemt die niet kan zakken --
   erger dan geen toets, want hij wekt vertrouwen dat hij niet waarmaakt.

   Elke aanroep hieronder draagt daarom een bewering die kan sneuvelen:

   1. DE POORT. Geen van de negentien staat open zonder inlog, en de drie soorten
      deuren verschillen echt: de gedeelde kantoorcode opent de payroll-kant maar
      niet de boardroom en niet de balie, want die twee vragen een mens.
   2. HET GEVOLG. Wat er geschreven wordt, wordt daarna TERUGGELEZEN langs een
      andere weg: een zetel verschijnt in de zetellijst, een klacht in het
      dossier van het lid (en verdwijnt er weer uit zodra hij opgelost is), een
      aangemerkt regelpakket verandert het wereldbeeld van de dekking, een
      contract komt terug in de personeelslijst, een correctierun wijst naar de
      run die hij rechtzet.
   3. DE FOUT. Een verkeerde invoer levert een uitleg en geen stilte: geen http
      als bron, geen looncomponent die belast is zonder grondslagen, geen
      contract zonder uurloon, geen correctie op een concept-run.

   Mutaties die deze toets horen te laten zakken (dit is niet uitputtend):
   - haal balieAuth van /api/office/balie/klacht: dan komt de gedeelde code
     binnen bij het account van een lid;
   - laat regelpakket.merkAan de stand niet zetten: dan blijft NL "wacht_op_mens"
     en klopt het wereldbeeld van de dekking niet meer;
   - laat noteerBron de fout niet wegschrijven: dan zwijgt een kapotte bron;
   - laat componenten.zet geldigTot negeren: dan blijft een vervallen component
     in nieuwe runs meetellen.

   Draai los: node --experimental-sqlite --test test/office-payroll-dekking.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, vrijePoort, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-officepayroll-'));
const OFFICE_CODE = 'KANTOOR-DEKKING-1';
const ZAAK = 'MERIDIAAN';          // Meridiaan Toren: de NL-zaak uit de demo
const ANDERE_ZAAK = 'SAROCA';      // een zaak in Spanje, om te scheiden
const MANAGER = 99;                // Evi van Dalen, gebouwmanager bij MERIDIAAN
const PERIODE = '2026-03';

let srv, base, gedeeld, eigenaar;
// wat de ene toets vastlegt en de volgende terugleest
const spoor = {};

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const uitleg = (r) => JSON.stringify(r.body).slice(0, 240);

/* De negentien paden op een rij. Deze lijst is geen versiering: de eerste toets
   loopt hem af om te bewijzen dat er geen enkele zonder inlog opengaat, en dat
   is meteen de plek waar een nieuw endpoint erbij hoort. */
const DEUREN = [
  '/api/office/balie/klacht', '/api/office/balie/klacht/status',
  '/api/office/balie/zetel', '/api/office/balie/zetels',
  '/api/office/journaal/beeld',
  '/api/office/payroll/aangifte/lijst', '/api/office/payroll/bron',
  '/api/office/payroll/bron/weg', '/api/office/payroll/component',
  '/api/office/payroll/componenten', '/api/office/payroll/contract',
  '/api/office/payroll/dekking', '/api/office/payroll/dekking/land',
  '/api/office/payroll/personeel', '/api/office/payroll/regels/haal',
  '/api/office/payroll/run/corrigeer', '/api/office/payroll/run/lijst',
  '/api/office/payroll/run/verklaar', '/api/office/payroll/verval'
];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  gedeeld = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode geeft een backoffice-sessie');
  eigenaar = await kantoorAlsPersoon(base);
  assert.ok(eigenaar, 'de eigenaar staat in de backoffice op zijn eigen RTG-account');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* al weg */ }
});

/* ---------------------------------------------------------------- de poorten */

test('geen van de negentien kantoordeuren gaat open zonder inlog', async () => {
  for (const pad of DEUREN) {
    const r = await api(pad, {});
    assert.equal(r.status, 401, pad + ' hoort dicht te zitten zonder sessie: ' + uitleg(r));
    assert.match(String(r.body.error || ''), /backoffice/i,
      pad + ' hoort te zeggen dat er een backoffice-sessie ontbreekt: ' + uitleg(r));
  }
});

/* --------------------------------------------------------------- de balie */

test('de baliezetel hangt aan een persoon, en de lijst leest terug wat er is gezet', async () => {
  const dicht = await api('/api/office/balie/zetels', {}, gedeeld);
  assert.equal(dicht.status, 403,
    'de zetels uitdelen is bestuurswerk; de gedeelde code wijst niemand aan: ' + uitleg(dicht));

  const leeg = await api('/api/office/balie/zetels', {}, eigenaar);
  assert.equal(leeg.status, 200, uitleg(leeg));
  assert.equal(leeg.body.baas, true, 'de eigenaar is de baas van deze kamer');
  assert.deepEqual(leeg.body.zetels, [], 'er zit nog niemand aan de balie');

  // een lid om een zetel aan te geven; de balie werkt op zijn key, niet op zijn naam
  const reg = await api('/api/auth/register', { name: 'Zetel Lid', email: 'zetellid@x.nl',
    phone: '0612340101', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  spoor.codenaam = st.body.state.user.codename;
  const gevonden = await api('/api/office/balie/zoek', { codenaam: spoor.codenaam }, eigenaar);
  const treffer = (gevonden.body.treffers || [])[0] || {};
  spoor.lidId = treffer.id;
  spoor.lidKey = treffer.key;
  assert.ok(spoor.lidKey, 'zoeken op codenaam levert de key van het lid: ' + uitleg(gevonden));

  const zonder = await api('/api/office/balie/zetel', {}, eigenaar);
  assert.equal(zonder.status, 400, 'zonder sleutel weet niemand wie de zetel krijgt: ' + uitleg(zonder));

  const gedeeldeCode = await api('/api/office/balie/zetel', { key: 'kantoor' }, eigenaar);
  assert.equal(gedeeldeCode.status, 400, uitleg(gedeeldeCode));
  assert.match(gedeeldeCode.body.error, /persoonlijke RTG-inlog/,
    'een zetel aan een gedeelde code zou het hele ontwerp omzeilen');

  const spook = await api('/api/office/balie/zetel', { key: 'user-999999' }, eigenaar);
  assert.equal(spook.status, 404, 'een zetel voor een account dat niet bestaat: ' + uitleg(spook));

  const gezet = await api('/api/office/balie/zetel', { key: spoor.lidKey }, eigenaar);
  assert.equal(gezet.status, 200, uitleg(gezet));
  assert.deepEqual(gezet.body.zetels.map(z => z.key), [spoor.lidKey],
    'de verse lijst komt mee terug, zodat het scherm niet uit de pas loopt');

  const nogmaals = await api('/api/office/balie/zetel', { key: spoor.lidKey }, eigenaar);
  assert.equal(nogmaals.body.zetels.length, 1,
    'twee keer geven levert geen tweede rij -- anders zou intrekken half werken');

  const lijst = await api('/api/office/balie/zetels', {}, eigenaar);
  assert.equal(lijst.body.zetels.length, 1, 'en hij staat er ook los teruggelezen: ' + uitleg(lijst));
  assert.ok(lijst.body.zetels[0].sinds, 'met sinds wanneer hij er zit');
  assert.ok(!JSON.stringify(lijst.body).includes('Zetel Lid'),
    'de lijst draagt sleutels, geen namen: ' + uitleg(lijst));

  const weg = await api('/api/office/balie/zetel', { key: spoor.lidKey, weg: true }, eigenaar);
  assert.deepEqual(weg.body.zetels, [], 'intrekken haalt hem er echt uit: ' + uitleg(weg));
  assert.deepEqual((await api('/api/office/balie/zetels', {}, eigenaar)).body.zetels, [],
    'en dat is ook zo als je het opnieuw opvraagt');
});

test('een klacht vraagt een zetel, en verdwijnt uit het dossier zodra hij is opgelost', async () => {
  const dicht = await api('/api/office/balie/klacht',
    { id: spoor.lidId, tekst: 'lid belt over een dubbele afschrijving' }, gedeeld);
  assert.equal(dicht.status, 403, 'werk aan het account van een lid draagt een naam: ' + uitleg(dicht));
  assert.match(dicht.body.error, /zetel op naam/, uitleg(dicht));

  const leeg = await api('/api/office/balie/klacht', { id: spoor.lidId, tekst: 'kort' }, eigenaar);
  assert.equal(leeg.status, 400, 'een regel van niks helpt het lid niet: ' + uitleg(leeg));

  const onbekend = await api('/api/office/balie/klacht',
    { id: 'user-999999', tekst: 'een klacht over iemand die niet bestaat' }, eigenaar);
  assert.equal(onbekend.status, 404, uitleg(onbekend));

  const kl = await api('/api/office/balie/klacht',
    { id: spoor.lidId, soort: 'betaling', tekst: 'dubbel afgeschreven bij de laatste rit' }, eigenaar);
  assert.equal(kl.status, 200, uitleg(kl));
  assert.equal(kl.body.klacht.status, 'open');
  assert.equal(kl.body.klacht.soort, 'betaling');
  assert.equal(kl.body.klacht.codenaam, spoor.codenaam, 'de klacht draagt de codenaam');
  assert.ok(!JSON.stringify(kl.body).includes('zetellid@x.nl'),
    'en nooit het adres van het lid: ' + uitleg(kl));
  spoor.klachtId = kl.body.klacht.id;

  const raar = await api('/api/office/balie/klacht',
    { id: spoor.lidId, soort: 'zwembad', tekst: 'de app doet raar bij het inloggen' }, eigenaar);
  assert.equal(raar.body.klacht.soort, 'anders',
    'een soort die niet bestaat wordt "anders" en niet stil overgenomen: ' + uitleg(raar));

  const dossier = await api('/api/office/balie/dossier',
    { id: spoor.lidId, reden: 'lid belde over de dubbele afschrijving' }, eigenaar);
  assert.equal(dossier.status, 200, uitleg(dossier));
  assert.deepEqual((dossier.body.lid.klachten || []).map(k => k.id).sort(),
    [spoor.klachtId, raar.body.klacht.id].sort(),
    'beide klachten staan open in het dossier van het lid: ' + uitleg(dossier));

  const rare = await api('/api/office/balie/klacht/status',
    { klachtId: spoor.klachtId, status: 'gedaan' }, eigenaar);
  assert.equal(rare.status, 400, uitleg(rare));
  assert.match(rare.body.error, /in behandeling/, 'de weigering noemt de standen die wel mogen');

  const spook = await api('/api/office/balie/klacht/status',
    { klachtId: 'bestaatniet', status: 'opgelost' }, eigenaar);
  assert.equal(spook.status, 404, uitleg(spook));

  const bezig = await api('/api/office/balie/klacht/status',
    { klachtId: spoor.klachtId, status: 'in behandeling' }, eigenaar);
  assert.equal(bezig.status, 200, uitleg(bezig));
  assert.equal(bezig.body.klacht.status, 'in behandeling');
  assert.deepEqual(bezig.body.klacht.log.map(l => l.status), ['open', 'in behandeling'],
    'de stand verandert, het spoor groeit mee: ' + uitleg(bezig));
  assert.ok(bezig.body.klacht.log.every(l => l.door),
    '"opgelost" zonder afzender is een bewering zonder afzender');

  await api('/api/office/balie/klacht/status', { klachtId: spoor.klachtId, status: 'opgelost' }, eigenaar);
  const na = await api('/api/office/balie/dossier',
    { id: spoor.lidId, reden: 'nagebeld over de afgehandelde klacht' }, eigenaar);
  assert.deepEqual((na.body.lid.klachten || []).map(k => k.id), [raar.body.klacht.id],
    'een opgeloste klacht hoort niet meer op het werkscherm; de andere wel: ' + uitleg(na));
});

/* ------------------------------------------------------------- het journaal */

test('het journaalbeeld is een samenvatting, en telt de mislukkingen echt', async () => {
  const dicht = await api('/api/office/journaal/beeld', {}, gedeeld);
  assert.equal(dicht.status, 403,
    'meekijken met het verkeer is een kaart van het huis: geen gedeelde code: ' + uitleg(dicht));

  const voor = await api('/api/office/journaal/beeld', {}, eigenaar);
  assert.equal(voor.status, 200, uitleg(voor));
  assert.equal(typeof voor.body.mislukt, 'number', 'het getal dat telt is mislukt: ' + uitleg(voor));
  assert.ok(!('regels' in voor.body),
    'het beeld is er juist om NIET de hele lijst op te halen: ' + uitleg(voor));

  await api('/api/dit-pad-bestaat-niet-en-hoort-te-mislukken', {});
  const na = await api('/api/office/journaal/beeld', {}, eigenaar);
  assert.ok(na.body.mislukt >= voor.body.mislukt + 1,
    'een verzoek dat faalde hoort de teller te verhogen (' + voor.body.mislukt +
    ' -> ' + na.body.mislukt + ')');
  assert.ok(na.body.venster > voor.body.venster, 'en het venster loopt mee');
});

/* --------------------------------------------------------------- de dekking */

test('een pakket aanmerken verandert het wereldbeeld van de dekking', async () => {
  const voor = await api('/api/office/payroll/dekking', {}, gedeeld);
  assert.equal(voor.status, 200, 'de payroll-kant staat wel open voor het kantoor: ' + uitleg(voor));
  const nlVoor = (voor.body.landen || []).find(l => l.land === 'NL');
  assert.ok(nlVoor, 'NL heeft werk en staat dus in het wereldbeeld: ' + uitleg(voor));
  assert.equal(nlVoor.stand, 'wacht_op_mens',
    'het meegeleverde pakket is binnengehaald, niet aangemerkt: ' + JSON.stringify(nlVoor).slice(0, 200));
  assert.ok(nlVoor.personeel > 0, 'met het aantal mensen dat het raakt');

  const landVoor = await api('/api/office/payroll/dekking/land', { land: 'nl' }, gedeeld);
  assert.equal(landVoor.body.land.stand, 'wacht_op_mens', uitleg(landVoor));
  assert.equal(landVoor.body.land.pakket.goedgekeurdDoor, null, 'nog niemand heeft getekend');
  spoor.versie = landVoor.body.land.pakket.versie;
  spoor.geldigTot = landVoor.body.land.pakket.geldigTot;

  const keur = await api('/api/office/payroll/regels/keur',
    { land: 'NL', versie: spoor.versie }, gedeeld);
  assert.equal(keur.body.stand, 'goedgekeurd', 'een mens merkt de jaargang aan: ' + uitleg(keur));

  const landNa = await api('/api/office/payroll/dekking/land', { land: 'NL' }, gedeeld);
  assert.equal(landNa.body.land.stand, 'draait', 'nu mag er een definitieve run op: ' + uitleg(landNa));
  assert.ok(landNa.body.land.pakket.goedgekeurdDoor, 'met de naam eraan');
  assert.equal(landNa.body.land.fiscaal, null,
    'en de fiscaal-tabel valt weg: er is nu EEN waarheid over NL');

  const na = await api('/api/office/payroll/dekking', {}, gedeeld);
  assert.equal(na.body.telling.draait, voor.body.telling.draait + 1, uitleg(na));
  assert.equal(na.body.telling.personeelZonderTabel,
    voor.body.telling.personeelZonderTabel - nlVoor.personeel,
    'precies de mensen van NL zijn uit de stapel "krijgt geen loonstrook" gehaald');

  const nergens = await api('/api/office/payroll/dekking/land', { land: 'ZZ' }, gedeeld);
  assert.equal(nergens.body.land.stand, 'geen_tabel', uitleg(nergens));
  for (const veld of ['loonheffing', 'zvw']) {
    assert.ok(nergens.body.land.ontbreekt.includes(veld),
      veld + ' hoort in de lijst met wat er nog moet komen -- die verzinnen we niet: ' + uitleg(nergens));
  }
});

test('een jaargang die afloopt zonder opvolger wordt vooruit gemeld, en niet eerder', async () => {
  const dag = (s) => new Date(s + 'T00:00:00Z').getTime();
  const vandaag = new Date().toISOString().slice(0, 10);
  const dagenTot = Math.round((dag(spoor.geldigTot) - dag(vandaag)) / 86400000);
  assert.ok(dagenTot >= 2,
    'deze toets gaat over vooruitkijken; de NL-jaargang loopt tot ' + spoor.geldigTot +
    ' en dat is al (bijna) voorbij -- er hoort een nieuwe jaargang te liggen');

  const dichtbij = await api('/api/office/payroll/verval', { dagen: 1 }, gedeeld);
  assert.equal(dichtbij.status, 200, uitleg(dichtbij));
  assert.ok(!(dichtbij.body.verloopt || []).some(v => v.land === 'NL'),
    'morgen is er niets aan de hand: ' + uitleg(dichtbij));

  const ver = await api('/api/office/payroll/verval', { dagen: dagenTot + 5 }, gedeeld);
  const nl = (ver.body.verloopt || []).find(v => v.land === 'NL');
  assert.ok(nl, 'over de horizon heen hoort de januarifout gemeld te worden: ' + uitleg(ver));
  assert.equal(nl.geldigTot, spoor.geldigTot);
  assert.equal(nl.versie, spoor.versie);
  assert.ok(nl.personeel > 0, 'met hoeveel mensen het raakt');
  assert.match(nl.uitleg, /geen loonrun meer/, 'en wat het betekent, in gewone taal');
});

test('een bron is https, en een bron die zwijgt blijft als bevinding staan', async () => {
  const onveilig = await api('/api/office/payroll/bron',
    { land: 'ES', naam: 'Onveilig', url: 'http://tarieven.example/es.json' }, gedeeld);
  assert.equal(onveilig.status, 400,
    'wie tussen een loontabel en ons zit, bepaalt wat mensen krijgen uitbetaald: ' + uitleg(onveilig));
  assert.equal((await api('/api/office/payroll/bron', { land: 'ES', url: 'tarieven.example' }, gedeeld)).status, 400,
    'en iets dat geen adres is, is geen bron');

  /* Een poort die gegarandeerd dicht is: de helper geeft er een vrij en laat hem
     meteen weer los. Geen naamserver, geen wachttijd -- de verbinding wordt
     geweigerd, en dat is precies het geval dat we willen zien. */
  const dicht = await vrijePoort();
  const url = 'https://127.0.0.1:' + dicht + '/loontabel-es.json';

  const gezet = await api('/api/office/payroll/bron', { land: 'ES', naam: 'Proefbron', url }, gedeeld);
  assert.equal(gezet.status, 200, uitleg(gezet));
  assert.equal((await api('/api/office/payroll/bron', { land: 'ES', naam: 'Proefbron', url }, gedeeld)).body.ongewijzigd,
    true, 'dezelfde bron twee keer levert geen tweede rij');

  const esVoor = await api('/api/office/payroll/dekking/land', { land: 'ES' }, gedeeld);
  const bronVoor = (esVoor.body.land.bronnen || []).find(b => b.url === url);
  assert.ok(bronVoor, 'de bron staat op het dekkingsscherm van dat land: ' + uitleg(esVoor));
  assert.equal(bronVoor.laatsteFout, null, 'er is nog nooit naar gekeken');

  const ronde = await api('/api/office/payroll/regels/haal', {}, gedeeld);
  assert.equal(ronde.status, 200, uitleg(ronde));
  assert.ok(ronde.body.uitslag.gekeken >= 1,
    'de ronde pakt de bron op die via het scherm is toegevoegd: ' + uitleg(ronde));
  assert.ok((ronde.body.uitslag.fouten || []).some(f => f.land === 'ES'),
    'een bron die niet antwoordt hoort als fout in de uitslag te staan: ' + uitleg(ronde));
  assert.deepEqual(ronde.body.uitslag.nieuw, [],
    'en levert natuurlijk geen pakket op');

  const esNa = await api('/api/office/payroll/dekking/land', { land: 'ES' }, gedeeld);
  const bronNa = (esNa.body.land.bronnen || []).find(b => b.url === url);
  assert.ok(bronNa.laatsteFout, 'de fout blijft aan de bron hangen: ' + uitleg(esNa));
  assert.ok(bronNa.laatst, 'met het moment waarop er voor het laatst gekeken is');
  assert.equal(esNa.body.land.stand, 'geen_tabel',
    'en een kapotte bron maakt nooit stilzwijgend dekking: ' + uitleg(esNa));

  assert.equal((await api('/api/office/payroll/bron/weg', { land: 'ES', url: url + '-anders' }, gedeeld)).status, 404,
    'een bron weghalen die er niet is, is geen stille bevestiging');
  assert.equal((await api('/api/office/payroll/bron/weg', { land: 'ES', url }, gedeeld)).status, 200);
  const esWeg = await api('/api/office/payroll/dekking/land', { land: 'ES' }, gedeeld);
  assert.ok(!(esWeg.body.land.bronnen || []).some(b => b.url === url),
    'en dan staat hij er echt niet meer: ' + uitleg(esWeg));
});

/* ------------------------------------------------- het componentenregister */

test('een looncomponent is een regel in het register, en vervallen is niet verdwijnen', async () => {
  const zonderGrondslag = await api('/api/office/payroll/component',
    { sleutel: 'fooienpot', naam: 'Fooienpot', soort: 'bruto', belast: true, grondslagen: [],
      invoerbron: 'handmatig', goedkeuring: 'manager' }, gedeeld);
  assert.equal(zonderGrondslag.status, 422, uitleg(zonderGrondslag));
  assert.ok(zonderGrondslag.body.bezwaren.some(b => /grondslagen/.test(b)),
    'belast zonder grondslagen laat de motor gokken, en dat mag hij niet: ' + uitleg(zonderGrondslag));

  const rareSleutel = await api('/api/office/payroll/component',
    { sleutel: 'Fooien Pot!', naam: 'Fooienpot', soort: 'bruto', belast: true,
      grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager' }, gedeeld);
  assert.equal(rareSleutel.status, 422, 'sleutels staan straks in stroken van jaren geleden: ' + uitleg(rareSleutel));

  const voor = await api('/api/office/payroll/componenten', {}, gedeeld);
  assert.equal(voor.status, 200, uitleg(voor));
  const sleutels = voor.body.componenten.map(c => c.sleutel);
  for (const basis of ['basissalaris', 'gewerkte_uren', 'vakantiegeld'])
    assert.ok(sleutels.includes(basis), 'de basisset hoort er te liggen, mist ' + basis);
  assert.ok(voor.body.soorten.includes('werkgever'),
    'het scherm hoort de vier soorten mee te krijgen: ' + JSON.stringify(voor.body.soorten));

  const nieuw = await api('/api/office/payroll/component',
    { sleutel: 'fooienpot', naam: 'Fooienpot', soort: 'bruto', belast: true,
      grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager',
      grootboek: '4031' }, gedeeld);
  assert.equal(nieuw.status, 200, uitleg(nieuw));
  assert.equal(nieuw.body.nieuw, true, 'een sector voegt een RIJ toe, geen tak in de code');

  const na = await api('/api/office/payroll/componenten', { opDatum: PERIODE + '-15' }, gedeeld);
  const erin = na.body.componenten.find(c => c.sleutel === 'fooienpot');
  assert.ok(erin, 'en hij telt mee op de dag van de loonrun: ' + uitleg(na));
  assert.equal(erin.grootboek, '4031', 'met waar hij in de boekhouding landt');

  const vervalt = await api('/api/office/payroll/component',
    { sleutel: 'fooienpot', naam: 'Fooienpot', soort: 'bruto', belast: true,
      grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager',
      geldigTot: '2026-01-31' }, gedeeld);
  assert.equal(vervalt.body.nieuw, false, 'dezelfde sleutel is dezelfde rij, geen tweede');

  const opDag = await api('/api/office/payroll/componenten', { opDatum: PERIODE + '-15' }, gedeeld);
  assert.ok(!opDag.body.componenten.some(c => c.sleutel === 'fooienpot'),
    'een vervallen component telt niet meer mee in nieuwe runs: ' + uitleg(opDag));
  const alles = await api('/api/office/payroll/componenten', {}, gedeeld);
  assert.ok(alles.body.componenten.some(c => c.sleutel === 'fooienpot'),
    'maar hij verdwijnt niet: oude stroken moeten leesbaar blijven');
  assert.equal(alles.body.componenten.length, voor.body.componenten.length + 1,
    'en er is precies een rij bijgekomen');
});

/* ---------------------------------------------------- personeel en contract */

test('een contract wordt op de persoon vastgelegd en komt terug in de personeelslijst', async () => {
  const spook = await api('/api/office/payroll/personeel', { code: 'BESTAATNIET' }, gedeeld);
  assert.equal(spook.status, 404, uitleg(spook));

  const pers = await api('/api/office/payroll/personeel', { code: ZAAK, opDatum: PERIODE + '-15' }, gedeeld);
  assert.equal(pers.status, 200, uitleg(pers));
  assert.equal(pers.body.land, 'NL', 'de run vraagt het regelpakket van het land van de zaak');
  assert.ok(pers.body.staff.some(m => m.id === MANAGER && m.manager === true),
    'de manager staat als manager in de lijst: ' + uitleg(pers));
  const medewerker = pers.body.staff.find(m => !m.manager);
  assert.ok(medewerker, 'er werkt personeel bij ' + ZAAK);
  assert.equal(medewerker.contract, null,
    'zonder contract is het antwoord null en niet een verzonnen uurloon');
  spoor.staffId = medewerker.id;

  const andere = await api('/api/office/payroll/personeel', { code: ANDERE_ZAAK }, gedeeld);
  const vreemde = (andere.body.staff || [])[0];
  assert.ok(vreemde, 'ook ' + ANDERE_ZAAK + ' heeft personeel: ' + uitleg(andere));
  const kruis = await api('/api/office/payroll/contract',
    { code: ZAAK, staffId: vreemde.id, vanaf: '2026-01-01', soort: 'vast', uurloonCenten: 1800 }, gedeeld);
  assert.equal(kruis.status, 404, uitleg(kruis));
  assert.match(kruis.body.error, /niet bij deze zaak/,
    'een personeelsnummer van de buurman hoort hier niet doorheen te komen');

  assert.equal((await api('/api/office/payroll/contract',
    { code: 'BESTAATNIET', staffId: spoor.staffId, vanaf: '2026-01-01', soort: 'vast', uurloonCenten: 1800 },
    gedeeld)).status, 404, 'en een zaak die niet bestaat ook niet');

  const zonderLoon = await api('/api/office/payroll/contract',
    { code: ZAAK, staffId: spoor.staffId, vanaf: '2026-01-01', soort: 'vast' }, gedeeld);
  assert.equal(zonderLoon.status, 422, uitleg(zonderLoon));
  assert.ok(zonderLoon.body.bezwaren.some(b => /uurloonCenten/.test(b)), uitleg(zonderLoon));

  const tijdelijk = await api('/api/office/payroll/contract',
    { code: ZAAK, staffId: spoor.staffId, vanaf: '2026-01-01', soort: 'tijdelijk', uurloonCenten: 1800 }, gedeeld);
  assert.equal(tijdelijk.status, 422,
    'een tijdelijk contract zonder einddatum is geen tijdelijk contract: ' + uitleg(tijdelijk));

  const ok = await api('/api/office/payroll/contract',
    { code: ZAAK, staffId: spoor.staffId, vanaf: '2026-01-01', soort: 'vast',
      uurloonCenten: 1800, urenPerWeek: 32, functie: 'Receptie' }, gedeeld);
  assert.equal(ok.status, 200, uitleg(ok));
  assert.equal(ok.body.terugwerkend, true, 'ingang 2026-01-01 en nu pas vastgelegd');
  assert.match(ok.body.let, /correctierun/,
    'en dat wordt gezegd, in plaats van stilzwijgend perioden te raken die al gedraaid zijn');

  const terug = await api('/api/office/payroll/personeel', { code: ZAAK, opDatum: PERIODE + '-15' }, gedeeld);
  const mijn = terug.body.staff.find(m => m.id === spoor.staffId);
  assert.equal(mijn.contract.uurloonCenten, 1800, 'het contract leest terug: ' + uitleg(terug));
  assert.equal(mijn.contract.urenPerWeek, 32);

  const eerder = await api('/api/office/payroll/personeel', { code: ZAAK, opDatum: '2025-06-15' }, gedeeld);
  assert.equal(eerder.body.staff.find(m => m.id === spoor.staffId).contract, null,
    'en op een dag voor de ingangsdatum gold hij nog niet -- een versie, geen veld');
});

/* ------------------------------------------------------------- de loonrun */

test('een loonrun hoort bij een zaak, en een bevinding wordt verklaard en niet weggeklikt', async () => {
  const leeg = await api('/api/office/payroll/run/lijst', { code: ZAAK }, gedeeld);
  assert.equal(leeg.status, 200, uitleg(leeg));
  assert.deepEqual(leeg.body.runs, [], 'er is nog geen loonrun gedraaid');

  const open = await api('/api/office/payroll/run/open', { code: ZAAK, periode: PERIODE }, gedeeld);
  assert.equal(open.status, 200, uitleg(open));
  spoor.runId = open.body.run.id;

  const lijst = await api('/api/office/payroll/run/lijst', { code: ZAAK }, gedeeld);
  assert.deepEqual(lijst.body.runs.map(r => r.id), [spoor.runId], uitleg(lijst));
  assert.equal(lijst.body.runs[0].periode, PERIODE);
  assert.equal(lijst.body.runs[0].stand, 'concept', 'een verse run staat op concept');
  assert.equal(lijst.body.runs[0].valuta, 'EUR', 'met de valuta erbij, zodat een scherm niet gokt');
  assert.deepEqual((await api('/api/office/payroll/run/lijst', { code: ANDERE_ZAAK }, gedeeld)).body.runs, [],
    'en hij hoort bij EEN zaak: bij ' + ANDERE_ZAAK + ' staat hij niet');

  /* Het contract van hierboven ging met terugwerkende kracht in, dus de
     controlelaag hoort daarover een bevinding te hebben opgeleverd. Dat is
     precies het soort ding dat je wilt verklaren en niet wegklikken. */
  const bevinding = (open.body.bevindingen || [])
    .find(b => b.soort === 'terugwerkende_contractwijziging');
  assert.ok(bevinding, 'een terugwerkende contractwijziging hoort op te vallen: ' + uitleg(open));
  assert.equal(bevinding.status, 'open');

  const kort = await api('/api/office/payroll/run/verklaar',
    { runId: spoor.runId, soort: bevinding.soort, staffId: bevinding.staffId, verklaring: 'ok' }, gedeeld);
  assert.equal(kort.status, 400, 'een verklaring van twee letters verklaart niets: ' + uitleg(kort));

  const onbekend = await api('/api/office/payroll/run/verklaar',
    { runId: spoor.runId, soort: 'bestaat_niet', verklaring: 'nagelopen met de manager' }, gedeeld);
  assert.equal(onbekend.status, 404, uitleg(onbekend));

  const verklaard = await api('/api/office/payroll/run/verklaar',
    { runId: spoor.runId, soort: bevinding.soort, staffId: bevinding.staffId,
      verklaring: 'nagelopen met de manager: de opslag gaat per januari in en is al nabetaald' }, gedeeld);
  assert.equal(verklaard.status, 200, uitleg(verklaard));
  assert.equal(verklaard.body.bevinding.status, 'verklaard');

  const vol = await api('/api/office/payroll/run/een', { runId: spoor.runId }, gedeeld);
  const terug = (vol.body.bevindingen || []).find(b => b.soort === bevinding.soort);
  assert.equal(terug.status, 'verklaard', 'en dat staat er ook als je de run opnieuw opvraagt');
  assert.match(terug.verklaring, /nabetaald/, 'met de verklaring zelf');
  assert.ok(terug.verklaardOp && terug.door, 'en wie het wanneer verklaarde');
});

test('een correctie is een nieuwe run die naar de oude wijst, en de aangifte leest per periode terug', async () => {
  const teVroeg = await api('/api/office/payroll/run/corrigeer',
    { runId: spoor.runId, reden: 'de uren klopten niet' }, gedeeld);
  assert.equal(teVroeg.status, 409,
    'een concept-run corrigeer je niet, die pas je aan: ' + uitleg(teVroeg));

  const spook = await api('/api/office/payroll/run/corrigeer',
    { runId: 'run_bestaatniet', reden: 'de uren klopten niet' }, gedeeld);
  assert.equal(spook.status, 404, uitleg(spook));

  // vier ogen: de manager bij de zaak, de administrateur bij het kantoor
  const zaakTok = (await api('/api/supplier/login',
    { code: ZAAK, staffId: MANAGER, pin: '1234' })).body.token;
  assert.ok(zaakTok, 'de manager van ' + ZAAK + ' logt in bij zijn eigen zaak');
  assert.equal((await api('/api/supplier/payroll/keur', { runId: spoor.runId }, zaakTok)).status, 200);
  assert.equal((await api('/api/office/payroll/run/keur', { runId: spoor.runId }, gedeeld)).status, 200);
  assert.equal((await api('/api/office/payroll/run/definitief', { runId: spoor.runId }, gedeeld)).status, 200,
    'de verklaarde bevinding houdt de run niet meer tegen');

  const voor = await api('/api/office/payroll/aangifte/lijst', { code: ZAAK }, gedeeld);
  assert.deepEqual(voor.body.aangiftes, [], 'er is nog niets aangegeven: ' + uitleg(voor));

  const aan = await api('/api/office/payroll/aangifte', { runId: spoor.runId }, gedeeld);
  assert.equal(aan.status, 200, uitleg(aan));
  const na = await api('/api/office/payroll/aangifte/lijst', { code: ZAAK }, gedeeld);
  assert.deepEqual(na.body.aangiftes.map(a => a.id), [aan.body.aangifte.id], uitleg(na));
  assert.equal(na.body.aangiftes[0].runId, spoor.runId, 'de aangifte wijst naar de run waar hij uit komt');
  assert.equal(na.body.aangiftes[0].periode, PERIODE);
  assert.equal(na.body.aangiftes[0].stand, 'concept', 'opgemaakt is niet ingediend');
  assert.deepEqual((await api('/api/office/payroll/aangifte/lijst',
    { code: ZAAK, periode: '2026-04' }, gedeeld)).body.aangiftes, [],
    'een andere periode levert niets -- anders zou een filter een sierlijkheid zijn');

  /* De correctie zelf. De regels komen uit de run die er ligt, met een fooi
     erbij: dan is er echt iets te corrigeren en kan het VERSCHIL per medewerker
     bewezen worden, in plaats van een correctie die toevallig nul oplevert. */
  const vol = await api('/api/office/payroll/run/een', { runId: spoor.runId }, gedeeld);
  const regels = vol.body.run.stroken.map(s => ({ staffId: s.staffId, naam: s.naam,
    contract: s.contract, leeftijdsgroep: '21+', gewerkteUren: s.gewerkteUren || 0,
    invoer: (s.invoer || []).concat([{ component: 'fooi', centen: 5000 }]) }));
  assert.ok(regels.length, 'de run heeft stroken om te corrigeren: ' + uitleg(vol));

  assert.equal((await api('/api/office/payroll/run/corrigeer', { runId: spoor.runId, regels }, gedeeld)).status, 400,
    'een correctie zonder reden is een stille wijziging');

  const cor = await api('/api/office/payroll/run/corrigeer',
    { runId: spoor.runId, regels, reden: 'de fooien van maart waren niet meegenomen' }, gedeeld);
  assert.equal(cor.status, 200, uitleg(cor));
  assert.equal(cor.body.run.correctieVan, spoor.runId,
    'de correctie wijst naar de run die hij rechtzet: ' + uitleg(cor));
  assert.equal(cor.body.run.periode, PERIODE, 'over dezelfde periode');
  assert.ok(cor.body.run.totaalVerschilCenten > 0,
    'en het verschil staat erbij, want dat is wat er nabetaald wordt: ' + uitleg(cor));

  const lijst = await api('/api/office/payroll/run/lijst', { code: ZAAK }, gedeeld);
  assert.equal(lijst.body.runs.length, 2, 'beide runs staan er: ' + uitleg(lijst));
  const oud = lijst.body.runs.find(r => r.id === spoor.runId);
  assert.equal(oud.stand, 'definitief', 'de oorspronkelijke run blijft staan precies zoals hij was');
  assert.equal(oud.correctieVan, null, 'en is zelf geen correctie');
});
