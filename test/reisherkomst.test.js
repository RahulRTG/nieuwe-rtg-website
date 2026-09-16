/* DE EERSTE VERTICALE SLICE VAN ECONOMIC PROVENANCE -- besluit van de eigenaar,
   15 september 2026.

   De keten die hier wordt beproefd:

     reiscomponent -> herkomst -> commerciele geldgebeurtenis -> pay-geldrij
       -> economic provenance -> doorbelasting -> bijdragebasis

   De dragende toets is nummer 6 en niet de optelling. Dat `bruto` gelijk is aan
   `doorbelasting + bijdragebasis + overig` klopt namelijk VANZELF zolang elke
   rij in een bak valt -- en dat doet ze, want `onbekend` is de restbak. Een
   nieuwe partijsoort die niemand indeelt, valt daar in en de som blijft kloppen
   terwijl de betekenis wegloopt. Toets 6 is de enige die dat vangt.

   En toets 11 en 12 draaien tegen een ECHTE server, want een nagemaakte app
   bewijst het handlergedrag en niet de montage of de deur (LAT.md regel 17). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { startServer, stop, kantoorAlsPersoon, keurLidGoed } = require('./helper');

const sam = require('../server/kern/reisbureau-samenstelling.js');
const { geldrijenVoor } = require('../server/kern/reisbureau-geldrijen.js');
const bb = require('../server/kern/waarde/bijdragebasis.js');
const eh = require('../server/kern/waarde/economischeherkomst.js');
const vergoeding = require('../server/kern/commercie/vergoeding.js');

const tb = require('../server/kern/reisbureau-terugboeking.js');

const TRIPS = require('../server/seed/partners.js').partnerTrips;
const IBIZA = TRIPS.find(t => t.id === 'ibiza-jetset');
const GSTAAD = TRIPS.find(t => t.id === 'gstaad-alpien');
const MONACO = TRIPS.find(t => t.id === 'monaco-glamour');

/* De bewaarde vorm van een herkomstrij, zoals kern/reisbureau-betaling.js hem
   wegschrijft. Los hulpje, want de terugboeklaag werkt op BEWAARDE rijen en niet
   op de verse uitkomst van geldrijenVoor. */
function bewaardeRijen(trip, personen) {
  const g = geldrijenVoor({ trip, personen: personen || 1, boekingId: 'PB-toets', valuta: 'EUR' });
  return g.rijen.map((r, i) => ({
    id: 'RGH-' + i, ref: 'RTG-R-TOETS', at: '2026-09-15T10:00:00.000Z',
    bedragCenten: r.bedragCenten, valuta: r.valuta,
    economischeHerkomst: r.economischeHerkomst, economischeEigenaar: r.economischeEigenaar,
    naarWie: r.naarWie, grond: r.grond, bronObject: r.bronObject,
    relatie: r.relatie, land: r.land, bewijs: r.bewijs
  }));
}

/* ---------------------------------------------- 1-4: de commerciele bron -- */

test('1. de samenstelling sluit exact op de reissom, en schaalt niets bij', () => {
  const s = sam.samenstellingVan(IBIZA);
  assert.equal(s.bekend, true, s.waarom || '');
  assert.equal(s.verschil, 0,
    'de onderdelen tellen op tot ' + s.somCenten + ' en de reis kost ' + s.nettoCenten +
    '. Een samenstelling die niet sluit hoort te WEIGEREN en niet te worden bijgeschaald: ' +
    'het verschil is precies de cent die later aan de verkeerde kant van de streep belandt.');
  assert.equal(s.nettoCenten, 220000, 'netto staat in EURO in de zaaiset en wordt hier naar centen gerekend');
});

test('2. een reis zonder samenstelling is ONBEKEND en nooit een lege lijst', () => {
  /* Sinds reis 1 t/m 3 zijn uitgesplitst, is dit de enige die nog ONBEKEND is --
     en hij staat daar met opzet voor (zie de zaaiset). */
  for (const t of TRIPS.filter(x => !Array.isArray(x.samenstelling))) {
    const s = sam.samenstellingVan(t);
    assert.equal(s.bekend, false, t.id + ' claimt een samenstelling die er niet is');
    assert.ok(s.waarom && s.waarom.length > 40,
      'zonder reden leest een lege samenstelling als "er zijn geen derden", en dat is een ' +
      'bewering die niemand heeft gedaan');
    assert.equal(s.onderdelen.length, 0);
  }
});

test('3. een onderdeel met een verzonnen soort, herkomst of eigenaar wordt GEWEIGERD', () => {
  const kapot = [
    { ...IBIZA, samenstelling: [{ soort: 'verzonnen', herkomst: 'partner', eigenaar: 'derde', ppCenten: 220000 }] },
    { ...IBIZA, samenstelling: [{ soort: 'verblijf', herkomst: 'iets', eigenaar: 'derde', ppCenten: 220000 }] },
    { ...IBIZA, samenstelling: [{ soort: 'verblijf', herkomst: 'partner', eigenaar: 'partner', ppCenten: 220000 }] },
    { ...IBIZA, samenstelling: [{ soort: 'verblijf', herkomst: 'partner', eigenaar: 'onbekend', ppCenten: 220000 }] },
    { ...IBIZA, samenstelling: [{ soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 219999 }] }
  ];
  for (const t of kapot) {
    const s = sam.samenstellingVan(t);
    assert.equal(s.bekend, false, 'deze samenstelling hoorde te worden geweigerd: ' +
      JSON.stringify(t.samenstelling));
  }
});

test('4. de geldrijen tellen op tot precies de reissom, ook bij meer personen', () => {
  for (const personen of [1, 2, 5]) {
    const g = geldrijenVoor({ trip: IBIZA, personen, boekingId: 'PB-toets', valuta: 'EUR' });
    assert.equal(g.ok, true, g.waarom || '');
    const som = g.rijen.reduce((a, r) => a + r.bedragCenten, 0);
    assert.equal(som, 220000 * personen,
      'bij ' + personen + ' personen tellen de herkomstrijen op tot ' + som +
      ' in plaats van ' + (220000 * personen));
    assert.equal(g.totaalCenten, som);
  }
});

/* --------------------------------------------- 5-7: economic provenance -- */

test('5. herkomst, eigenaar en naarWie lopen uiteen op DEZELFDE rij', () => {
  /* Het voorbeeld waarop `herkomst: "partner"` sneuvelde: de klant betaalt, RTG
     int, het hotel is de eigenaar. Drie partijen, een rij. */
  const g = geldrijenVoor({ trip: IBIZA, personen: 1, boekingId: 'PB-toets', valuta: 'EUR' });
  const hotel = g.rijen.find(r => /Aguamarina/.test(r.grond || ''));
  assert.ok(hotel, 'de hotelrij ontbreekt');
  assert.equal(hotel.economischeHerkomst, 'lid', 'het LID betaalde');
  assert.equal(hotel.economischeEigenaar, 'derde', 'het HOTEL komt het toe');
  assert.equal(hotel.naarWie, 'rtg', 'en RTG INT het -- er is niets uitgekeerd');

  const eigenDienst = g.rijen.find(r => r.economischeEigenaar === 'rtg');
  assert.ok(eigenDienst, 'de eigen dienst van RTG ontbreekt');
  assert.equal(eigenDienst.economischeHerkomst, 'lid',
    'de herkomst is afgeleid uit de eigenaar -- precies de fout waar deze laag tegen bestaat');
});

test('6. DRAGEND: elke partijsoort heeft een verklaarde bak', () => {
  /* Dit is de invariant die de optelling NIET vangt. Een som over bakken waarin
     `onbekend` de restbak is, klopt altijd; wat wegloopt is de betekenis. */
  assert.deepEqual(bb.ongedeeldeSoorten(eh.SOORTEN), [],
    'er is een partijsoort zonder verklaarde bak. Zolang dat zo is, valt hij in de restbak ' +
    '`onbekend` en blijft de som kloppen terwijl de indeling stil verkeerd is.');
  /* En de controle kan uitslaan: een verzonnen soort hoort hem te laten zakken. */
  assert.deepEqual(bb.ongedeeldeSoorten({ ...eh.SOORTEN, stichting: 'verzonnen' }), ['stichting'],
    'de volledigheidscontrole ziet een nieuwe soort niet -- dan is hij geen controle');
});

test('7. bruto = doorbelasting + bijdragebasis + de benoemde overige posten', () => {
  const g = geldrijenVoor({ trip: IBIZA, personen: 1, boekingId: 'PB-toets', valuta: 'EUR' });
  const u = bb.bereken(g.rijen);
  assert.equal(u.sluit, true, 'er is een restverschil van ' + u.verschil +
    ' cent. Een cent die in geen enkele bak valt, verhoogt of verlaagt de basis en niemand kan ' +
    'zeggen welke -- daarom mag hier nooit een rest stilletjes verdwijnen.');
  assert.equal(u.bruto, 220000);
  assert.equal(u.doorbelasting, 192000, 'vlucht 520 + hotel 610 + villa 580 + boot 210');
  assert.equal(u.overig.belasting, 4000);
  assert.equal(u.bijdragebasis, 24000, 'alleen het samenstellen en begeleiden is van RTG');
  assert.equal(u.overig.onbekend, 0);
  /* En de tegenrekening komt langs een ANDERE weg dan de bakken: een som die je
     uit haar eigen delen opbouwt, klopt altijd. */
  assert.equal(u.uitRijen, u.bruto);
});

test('8. de machine antwoordt per cent WAAROM hij boven of onder de streep staat', () => {
  const g = geldrijenVoor({ trip: IBIZA, personen: 1, boekingId: 'PB-toets', valuta: 'EUR' });
  for (const r of g.rijen) {
    const w = bb.waarom(r);
    assert.ok(w.bak, 'een rij zonder bak: ' + JSON.stringify(r));
    assert.ok(w.waarom && w.waarom.length > 15,
      'een indeling zonder reden is bij een geschil niets waard: ' + JSON.stringify(w));
  }
});

test('9. de bijdragebasislaag kent geen tarief', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const pad = require.resolve('../server/kern/waarde/bijdragebasis.js');
  const rauw = fs.readFileSync(pad, 'utf8');
  const code = zonderCommentaar(rauw, { soort: 'js' });
  assert.ok(code.length < rauw.length - 300, 'de commentaarscheider haalde vrijwel niets weg');
  for (const verboden of ['0.20', '0,20', 'vergoeding', 'royalty', 'percentage', 'tarief']) {
    assert.ok(!code.includes(verboden),
      'de basislaag draagt "' + verboden + '" in de CODE. De basis is de waarheid; het tarief is ' +
      'beleid, en die twee horen niet in hetzelfde bestand.');
  }
});

/* ------------------------------------ 10: RTG_OPERATING_SERVICE, leeg maar echt -- */

test('10. de vijfde dienst bestaat, is LEEG, en raakt de 0%-invariant niet', () => {
  const o = vergoeding.SOORTEN.rtg_operating_service;
  assert.ok(o, 'RTG_OPERATING_SERVICE bestaat niet als benoemde dienst');
  assert.equal(o.grondslag, vergoeding.OPEN, 'de grondslag hoort OPEN te zijn, niet ingevuld');
  assert.equal(o.tarief, vergoeding.OPEN, 'er staat een tarief waar de eigenaar er geen heeft gezet');
  assert.equal(o.berekening, vergoeding.NIET_ACTIEF);
  assert.equal(vergoeding.isActief('rtg_operating_service'), false,
    'de vijfde dienst wordt ergens uitgerekend terwijl hij op NIET ACTIEF staat');
  assert.equal(o.overOmzet, false,
    'zou hij over omzet gaan, dan was het een commissie en hoort hij hier niet');
  assert.equal(o.tegenpartij, 'exploitant',
    'de tegenpartij is een EXPLOITANT en geen partner -- daar hangt de partnerbelofte aan');

  /* De invariant zelf blijft onaangeraakt. */
  assert.equal(vergoeding.PARTNER_COMMISSIE, 0);
  assert.equal(vergoeding.commissieVoor({ code: 'KIKUNOI', rate: 0.3 }), 0);

  /* En de weigering aan een PARTNER noemt de vijfde niet: die gaat over een
     netwerk waarvan een zaak geen gebruiker is. */
  const uitleg = vergoeding.waaromGeenCommissie();
  assert.ok(!/operating/i.test(uitleg),
    'de partnerweigering noemt het operating network. Dan leest een zaak dat RTG haar iets ' +
    'rekent voor iets waar zij niets mee te maken heeft.');
  for (const s of Object.values(vergoeding.SOORTEN)) {
    if (s.tegenpartij === 'partner') {
      assert.ok(uitleg.toLowerCase().includes(s.label.toLowerCase()),
        'de partnerdienst "' + s.label + '" ontbreekt in de uitleg');
    }
  }
});

test('10a. GRENDEL: zolang het tarief OPEN is, staat de berekening op NIET ACTIEF', () => {
  /* Besluit van de eigenaar, 15 september 2026. De commerciele beslissing over
     een franchisepercentage is NIET genomen, en deze toets zorgt dat een
     volgende sessie hem niet half kan afmaken.

     WAAROM DIT GEEN ZOEKTOCHT NAAR `0.20` IS. Dat getal komt in een codebase
     van deze omvang overal legitiem voor (een kansverdeling, een marge, een
     opacity), dus zo'n greep levert onzintreffers en went binnen een week. Wat
     hier wordt afgedwongen is de KOPPELING: een tarief dat nog openstaat en een
     berekening die al draait, kunnen niet allebei waar zijn. Wie het percentage
     invult moet dus ook de berekening aanzetten, en dat is precies het moment
     waarop een mens ernaar hoort te kijken. */
  for (const [id, soort] of Object.entries(vergoeding.SOORTEN)) {
    if (soort.tarief !== vergoeding.OPEN) continue;
    assert.equal(soort.berekening, vergoeding.NIET_ACTIEF,
      id + ' heeft een tarief dat nog OPEN staat en een berekening die niet op NIET ACTIEF staat. ' +
      'Dat is de helft van een besluit: er wordt iets uitgerekend over een grondslag die niemand ' +
      'heeft vastgesteld. Zet het tarief, of zet de berekening uit -- maar niet allebei half.');
    assert.equal(vergoeding.isActief(id), false,
      id + ' telt als actief terwijl zijn tarief nog OPEN is');
  }
  /* En de grendel kan uitslaan: een soort met een tarief en een draaiende
     berekening hoort er gewoon doorheen te komen, anders bewaakt hij niets maar
     verbiedt hij alles. */
  assert.equal(vergoeding.isActief('payment_service'), true,
    'de betaaldienst heeft een grondslag en een berekening en hoort actief te zijn; staat hij ' +
    'hier op false, dan meet deze grendel niet de koppeling maar iets anders');
});

test('11. geen enkele soort draagt een percentage over omzet', () => {
  for (const [id, s] of Object.entries(vergoeding.SOORTEN)) {
    assert.equal(s.overOmzet, false, id + ' neemt een aandeel in andermans omzet; dat is een commissie');
    assert.ok(s.tegenpartij === 'partner' || s.tegenpartij === 'exploitant',
      id + ' heeft geen verklaarde tegenpartij, en dan is niet te zeggen welke belofte op hem slaat');
  }
});

/* ------------------------------------------------- 12-13: de echte server -- */

async function post(base, pad, body, token) {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' },
      token ? { authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  });
  let j = null; try { j = await r.json(); } catch (_) { j = null; }
  return { status: r.status, body: j || {} };
}

test('12. een reis ZONDER samenstelling wordt geweigerd met de reden', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  try {
    const reg = await post(srv.base, '/api/auth/register', {
      name: 'Reis Lid', email: 'reisherkomst1@x.nl', phone: '0612345001',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const token = reg.body.token;
    assert.ok(token, 'registratie mislukt: ' + JSON.stringify(reg.body).slice(0, 200));

    const aanvraag = await post(srv.base, '/api/reisbureau/boek', { tripId: 'lissabon-nieuw', personen: 1 }, token);
    assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 200));
    const ref = aanvraag.body.aanvraag.ref;

    const otok = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
    assert.ok(otok, 'kantoorinlog mislukt');
    await post(srv.base, '/api/office/reisbureau/besluit',
      { ref, besluit: 'bevestigd', bericht: 'Bevestigd.' }, otok);

    const betaal = await post(srv.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(betaal.status, 409,
      'een reis zonder samenstelling werd geind. Dan staat er een geldrij met een onbekende ' +
      'herkomst in het grootboek, en die ziet er in de meter uit als een meting.');
    assert.ok(String(betaal.body.hoe || '').length > 40,
      'de weigering draagt geen reden; dan weet niemand wat er moet gebeuren');
  } finally { await stop(srv); }
});

test('13. de hele keten op een ECHTE server: een lid betaalt een bevestigde reis', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  try {
    const reg = await post(srv.base, '/api/auth/register', {
      name: 'Reis Lid Twee', email: 'reisherkomst2@x.nl', phone: '0612345002',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const token = reg.body.token;
    assert.ok(token, 'registratie mislukt: ' + JSON.stringify(reg.body).slice(0, 200));
    await keurLidGoed(srv.base, token, reg.body.state.user.codename, '1990-01-01');

    const op = await post(srv.base, '/api/pay/oplaad', { centen: 300000, idem: 'reisherkomst-op' }, token);
    assert.equal(op.status, 200, 'opladen mislukt: ' + JSON.stringify(op.body).slice(0, 200));
    const voor = (await post(srv.base, '/api/pay/overzicht', {}, token)).body.saldo;
    assert.equal(voor, 300000);

    const aanvraag = await post(srv.base, '/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, token);
    assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 200));
    const ref = aanvraag.body.aanvraag.ref;

    const otok = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
    const bes = await post(srv.base, '/api/office/reisbureau/besluit',
      { ref, besluit: 'bevestigd', bericht: 'Bevestigd door een adviseur.' }, otok);
    assert.equal(bes.body.aanvraag.status, 'bevestigd');

    const betaal = await post(srv.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(betaal.status, 200, JSON.stringify(betaal.body).slice(0, 250));
    assert.equal(betaal.body.betaling.centen, 220000, 'er is een ander bedrag geind dan de reissom');
    assert.equal(betaal.body.rijen, 6,
      'de zes onderdelen van de samenstelling horen zes herkomstrijen op te leveren; er zijn er ' +
      betaal.body.rijen);
    assert.ok(betaal.body.betaling.boeking, 'de herkomstrijen wijzen naar geen boeking');

    const na = (await post(srv.base, '/api/pay/overzicht', {}, token)).body.saldo;
    assert.equal(na, voor - 220000, 'het lid betaalde niet precies de reissom');

    /* EEN BOEKING EN NIET ZES. Het lid betaalde EEN bedrag; waar dat economisch
       uiteenvalt is een tweede vraag. Zes boekingen zouden bewegingen verzinnen
       die niet hebben plaatsgevonden -- het hotel heeft nog niets ontvangen. */
    const gesch = (await post(srv.base, '/api/pay/overzicht', {}, token)).body;
    /* `geschiedenis` is de PROJECTIE van het grootboek voor het lid; hij draagt
       geen `ref` (kern/pay/verzoeken.js), dus er wordt op de soort geteld en op
       het boekingsnummer vergeleken -- en niet op een veld dat hier niet bestaat. */
    const reisBoekingen = (gesch.geschiedenis || []).filter(b => b.soort === 'reis');
    assert.equal(reisBoekingen.length, 1,
      'er staan ' + reisBoekingen.length + ' reisboekingen in het grootboek; de uitsplitsing ' +
      'hoort GEEN extra bewegingen te maken -- het hotel heeft op dit moment nog niets ontvangen');
    assert.equal(reisBoekingen[0].id, betaal.body.betaling.boeking,
      'de herkomstrijen wijzen naar een andere boeking dan die in het grootboek staat');
    assert.equal(reisBoekingen[0].centen, -220000, 'het bedrag ging de verkeerde kant op');

    /* En nog een keer betalen boekt niet dubbel. */
    const weer = await post(srv.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(weer.status, 200);
    assert.equal(weer.body.alBetaald, true, 'een tweede betaling werd niet herkend');
    const naTwee = (await post(srv.base, '/api/pay/overzicht', {}, token)).body.saldo;
    assert.equal(naTwee, na, 'de tweede aanroep boekte opnieuw af');

    /* ---- EN DE WEG TERUG, op dezelfde server en dezelfde reis ----
       Een terugboeking is een besluit van een mens, dus een kantoorroute. Er mag
       GEEN geld bewegen: wat ontstaat is een teruggaveRECHT dat een mens
       uitvoert (GELD.md). Zou het saldo hier oplopen, dan heeft deze laag geld
       verplaatst en dat is precies wat zij niet mag. */
    const zonderReden = await post(srv.base, '/api/office/reisbureau/terugboeking',
      { ref, reden: '' }, otok);
    assert.equal(zonderReden.status >= 400, true,
      'een terugboeking zonder reden werd toegestaan');

    const terug = await post(srv.base, '/api/office/reisbureau/terugboeking',
      { ref, reden: 'reis afgezegd door de accommodatie' }, otok);
    assert.equal(terug.status, 200, JSON.stringify(terug.body).slice(0, 250));
    assert.equal(terug.body.teruggedraaid, 6, 'niet alle zes onderdelen zijn gespiegeld');
    assert.equal(terug.body.centen, 220000);
    assert.equal(terug.body.volledig, true);

    const naTerug = (await post(srv.base, '/api/pay/overzicht', {}, token)).body.saldo;
    assert.equal(naTerug, na,
      'het saldo van het lid veranderde door de terugboeking. Deze laag zet een RECHT klaar en ' +
      'verplaatst geen geld -- een mens voert de teruggave uit langs kern/pay.');

    /* En twee keer terugdraaien gaat niet. */
    const weerTerug = await post(srv.base, '/api/office/reisbureau/terugboeking',
      { ref, reden: 'nog een keer' }, otok);
    assert.equal(weerTerug.status >= 400, true,
      'dezelfde reis werd twee keer teruggedraaid; dan loopt het dubbele terug');
  } finally { await stop(srv); }
});

/* ============================================================================
   REIS 2 EN 3 -- besluit van de eigenaar, 15 september 2026. Niet drie keer
   hetzelfde happy path, maar drie verschillende ECONOMISCHE EIGENSCHAPPEN.
   ========================================================================== */

test('14. de drie reizen hebben WEZENLIJK andere verhoudingen', () => {
  /* Drie reizen met dezelfde verhouding zouden dezelfde eigenschap drie keer
     toetsen. Wat hier telt is dat de bijdragebasis van ondergeschikt naar
     dominant beweegt, want dat is de as waarop een franchisevergoeding straks
     rekent. */
  const deel = (trip) => {
    const u = bb.bereken(geldrijenVoor({ trip, personen: 1, boekingId: 'PB-t', valuta: 'EUR' }).rijen);
    assert.equal(u.sluit, true, trip.id + ' sluit niet');
    return u.bijdragebasis / u.bruto;
  };
  const ibiza = deel(IBIZA), gstaad = deel(GSTAAD), monaco = deel(MONACO);
  assert.ok(gstaad > ibiza * 2,
    'gstaad hoort een WEZENLIJK groter eigen aandeel te hebben dan ibiza (' +
    (gstaad * 100).toFixed(1) + '% tegen ' + (ibiza * 100).toFixed(1) + '%); anders toetsen ' +
    'twee reizen dezelfde vorm');
  assert.ok(monaco < ibiza,
    'monaco hoort juist een kleiner eigen aandeel te hebben dan ibiza');
  const uitgesplitst = TRIPS.filter(t => Array.isArray(t.samenstelling));
  assert.equal(uitgesplitst.length, 3, 'er horen precies drie uitgesplitste reizen te zijn');
  for (const t of uitgesplitst) assert.equal(sam.samenstellingVan(t).bekend, true, t.id + ' sluit niet');
  assert.ok(TRIPS.some(t => !Array.isArray(t.samenstelling)),
    'er is geen ONuitgesplitste reis meer in de zaaiset. Dan hebben de weigeringstoetsen geen ' +
    'onderwerp en staan ze groen om de verkeerde reden.');
});

test('15. DRAGEND: na een VOLLEDIGE terugboeking klopt de waarheid achteruit', () => {
  /* De hele vraag van reis 3. Elke bak hoort op nul te staan -- niet alleen het
     bruto. Zou de spiegel de eigenaar `lid` dragen, dan klopte het bruto ook
     (nul) terwijl doorbelasting op 1800 en de bijdragebasis op 120 bleef staan:
     drie getallen die samen nul zijn en elk afzonderlijk liegen. */
  const origineel = bewaardeRijen(MONACO, 1);
  const voor = bb.bereken(origineel);
  assert.equal(voor.doorbelasting, 180000);
  assert.equal(voor.bijdragebasis, 12000);

  const sp = tb.spiegelVoor({ rijen: origineel, kiesIds: null, reden: 'reis afgezegd door het hotel' });
  assert.equal(sp.ok, true, sp.waarom || '');
  assert.equal(sp.volledig, true);
  assert.equal(sp.terugCenten, 195000);

  const na = tb.kloptAchteruit(origineel.concat(sp.rijen.map(x => x.rij)), bb.bereken);
  assert.equal(na.sluit, true, 'restverschil ' + na.verschil);
  assert.equal(na.bruto, 0, 'er is bruto ' + na.bruto + ' blijven staan');
  assert.equal(na.doorbelasting, 0,
    'de doorbelasting staat op ' + na.doorbelasting + ' na een VOLLEDIGE terugbetaling. Dan draagt ' +
    'de spiegel een andere bak dan zijn origineel, en zeggen de losse posten iets onwaars terwijl ' +
    'het totaal klopt.');
  assert.equal(na.bijdragebasis, 0);
  assert.equal(na.overig.belasting, 0);
  assert.equal(na.allesNul, true);
});

test('16. de spiegel draait TWEE velden om en het derde NIET', () => {
  const origineel = bewaardeRijen(MONACO, 1);
  const hotel = origineel.find(r => /Suite/.test(r.grond || ''));
  const sp = tb.spiegelVoor({ rijen: [hotel], kiesIds: null, reden: 'kamer niet geleverd' });
  const m = sp.rijen[0].rij;
  assert.equal(m.bedragCenten, -96000);
  assert.equal(m.economischeHerkomst, 'rtg', 'de waarde komt nu VAN RTG');
  assert.equal(m.naarWie, 'lid', 'en gaat naar het lid');
  assert.equal(m.economischeEigenaar, hotel.economischeEigenaar,
    'de EIGENAAR draait niet om: een hotelnacht terugdraaien is min doorbelasting en geen ' +
    'schuld aan de klant. Precies hier gaat het mis als iemand "het geld gaat naar het lid, ' +
    'dus de eigenaar is het lid" redeneert.');
  assert.equal(sp.rijen[0].spiegelVan, hotel.id, 'de spiegel wijst niet naar zijn origineel');
});

test('17. een GEDEELTELIJKE terugboeking raakt alleen wat is gekozen', () => {
  const origineel = bewaardeRijen(MONACO, 1);
  /* Monaco draagt met opzet TWEE activiteiten; er gaat er precies een terug. */
  const casino = origineel.find(r => /casino/i.test(r.grond || ''));
  const sp = tb.spiegelVoor({ rijen: origineel, kiesIds: [casino.id], reden: 'casino-avond verviel' });
  assert.equal(sp.ok, true, sp.waarom || '');
  assert.equal(sp.volledig, false, 'een van de zes is geen volledige terugboeking');
  assert.equal(sp.terugCenten, 18000);

  const na = bb.bereken(origineel.concat(sp.rijen.map(x => x.rij)));
  assert.equal(na.sluit, true);
  assert.equal(na.bruto, 195000 - 18000);
  assert.equal(na.doorbelasting, 180000 - 18000, 'alleen de casino-avond hoort te verdwijnen');
  assert.equal(na.bijdragebasis, 12000, 'de eigen dienst van RTG is niet teruggedraaid');
  const tafel = origineel.find(r => /circuit/i.test(r.grond || ''));
  assert.ok(tafel, 'de tweede activiteit ontbreekt; dan toetst dit niets');
});

test('18. een terugboeking zonder reden, of twee keer dezelfde, wordt geweigerd', () => {
  const origineel = bewaardeRijen(MONACO, 1);
  for (const reden of [undefined, '', '   ', 'ok']) {
    const sp = tb.spiegelVoor({ rijen: origineel, kiesIds: null, reden });
    assert.equal(sp.ok, false,
      'een terugboeking met reden ' + JSON.stringify(reden) + ' werd toegestaan. Een bedrag dat ' +
      'terugloopt zonder opgeschreven reden, ziet er bij controle hetzelfde uit als een fout.');
  }
  /* En niet twee keer: de spiegels van de eerste ronde reizen mee in de lijst. */
  const eerste = tb.spiegelVoor({ rijen: origineel, kiesIds: null, reden: 'reis afgezegd' });
  const metSpiegels = origineel.concat(eerste.rijen.map((x, i) =>
    Object.assign({ id: 'RGH-S' + i, spiegelVan: x.spiegelVan }, x.rij)));
  const tweede = tb.spiegelVoor({ rijen: metSpiegels, kiesIds: null, reden: 'nog een keer' });
  assert.equal(tweede.ok, false,
    'dezelfde reis werd twee keer teruggedraaid; dan loopt er het dubbele terug terwijl er een ' +
    'keer is afgezegd');
});
