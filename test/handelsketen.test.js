/* ============================================================================
   DE HANDELSKETEN: één weg waarlangs elke zaak met elke andere zaak zaken doet.

   WAAROM DIT BESTAAT

   Zaak-naar-zaak werkte al, maar per PAAR opnieuw uitgevonden: veertien
   verschillende aanvraag- en ordercollecties naast elkaar, elk met een eigen
   vorm en eigen statuswoorden. Dat is de N-kwadraat-val -- 73 genres zijn 5329
   paren -- en het is de reden dat een beachclub geen linnen bij een wasserij
   kon bestellen: niet omdat het moeilijk is, maar omdat dat paar niet gebouwd
   was.

   Deze toets loopt precies dat paar af, van aanvraag tot betaling, en legt
   daarnaast de drie dingen vast waar een gedeelde keten op kan stukgaan:

   1. HET VINDEN. Een aanvraag gaat naar een GENRE, niet naar een adres. Elke
      wasserij ziet hem; een garage niet. Dat is wat van N-kwadraat weer N maakt,
      dus als dit wegvalt is de hele opzet weg zonder dat er iets kapot lijkt.
   2. DE VOLGORDE. Leveren voor er gegund is, factureren voor er geleverd is:
      dat hoort te weigeren. Een keten zonder volgorde is een lijst velden.
   3. WIE ER AAN ZET IS. Een derde zaak mag niet offreren op een aanvraag die
      niet aan haar genre is gericht, en niet leveren op wat aan een ander is
      gegund. En een leverancier mag de prijs van zijn CONCURRENT niet zien --
      anders bepaalt de eerste bieder wat de rest vraagt.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const path = require('path');
const { STAPPEN } = require('../server/kern/handelsketen/regels');

const KOPER = 'VORA';        // Vora Beach Club
const WASSERIJ = 'LAVANDA';  // Lavanda Wasserij
const GARAGE = 'TALLER';     // Taller Ibiza Motors -- een ander genre
const ZORG_A = 'ZENITH', ZORG_B = 'CLARA';  // twee zaken in hetzelfde genre

async function post(base, pad, body, tok) {
  const r = await fetch(base + '/api' + pad, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json', 'X-Forwarded-Proto': 'https' },
      tok ? { authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
// de beheerder van een demozaak (PIN 1234); geldstappen zijn voor het beheer
async function beheer(base, code) {
  const roster = await post(base, '/supplier/roster', { code });
  const mgr = (roster.body.staff || []).find(m => m.role === 'manager');
  assert.ok(mgr, 'demozaak ' + code + ' hoort een beheerder te hebben');
  const login = await post(base, '/supplier/login', { code, staffId: mgr.id, pin: '1234' });
  assert.ok(login.body.token, 'inloggen bij ' + code + ' hoort te werken');
  return login.body.token;
}
const vind = (lijst, id) => (lijst || []).find(h => h.id === id);

test('van aanvraag tot betaling: een beachclub koopt linnen bij een wasserij', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const was = await beheer(srv.base, WASSERIJ);

    // 1) de beachclub zet een aanvraag uit bij het GENRE wasserij
    const aan = await post(srv.base, '/supplier/handel/aanvraag', {
      genre: 'wasserij', titel: 'Linnen voor het weekend',
      regels: [{ wat: 'servetten', aantal: 800, eenheid: 'stuk' },
        { wat: 'tafellakens', aantal: 400, eenheid: 'stuk' }],
      ophalen: 'dinsdag 09:00', retour: 'woensdag 12:00'
    }, club);
    assert.equal(aan.status, 200, JSON.stringify(aan.body));
    const id = aan.body.handel.id;
    assert.equal(aan.body.handel.status, 'aanvraag');

    // 2) de wasserij ziet hem staan zonder dat iemand haar heeft aangewezen
    const bijWas = await post(srv.base, '/supplier/handel/mijn', {}, was);
    assert.ok(vind(bijWas.body.open, id), 'een wasserij hoort een linnenaanvraag te zien staan');

    // 3) offerte, en de koper ziet hem
    const off = await post(srv.base, '/supplier/handel/offreren',
      { id, prijs: 240, opmerking: 'Ophalen en brengen inbegrepen.' }, was);
    assert.equal(off.status, 200, JSON.stringify(off.body));
    const bijClub = await post(srv.base, '/supplier/handel/mijn', {}, club);
    const gezien = vind(bijClub.body.alsKoper, id);
    assert.equal(gezien.offertes.length, 1);
    assert.equal(gezien.offertes[0].prijs, 240);

    // 4) gunnen -> plannen -> leveren -> factureren -> betalen
    const gun = await post(srv.base, '/supplier/handel/gunnen',
      { id, offerteId: gezien.offertes[0].id }, club);
    assert.equal(gun.status, 200, JSON.stringify(gun.body));
    assert.equal(gun.body.handel.status, 'gegund');

    const plan = await post(srv.base, '/supplier/handel/plannen',
      { id, ophaalMoment: 'dinsdag 09:00', retourMoment: 'woensdag 11:00' }, was);
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.equal(plan.body.handel.status, 'gepland');

    const lev = await post(srv.base, '/supplier/handel/leveren',
      { id, bewijs: 'Marta, bedrijfsleider' }, was);
    assert.equal(lev.status, 200, JSON.stringify(lev.body));
    assert.equal(lev.body.handel.status, 'geleverd');
    assert.equal(lev.body.handel.levering.bewijs, 'Marta, bedrijfsleider');

    const fac = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 240 }, was);
    assert.equal(fac.status, 200, JSON.stringify(fac.body));
    assert.equal(fac.body.handel.status, 'gefactureerd');
    assert.ok(fac.body.handel.factuur.nummer, 'de factuur hoort een nummer te dragen');

    /* En dat nummer komt uit de CENTRALE facturatielaag, niet uit een eigen
       reeks van deze keten. De bewering daarvoor is niet de vorm van het nummer
       maar de vindbaarheid: de factuur hoort in het overzicht van BEIDE zaken te
       staan, met de aanvraagreferentie eraan. Een keten met een eigen
       nummerreeks zou hier slagen op een prefix en toch buiten de boekhouding
       staan. */
    const nummer = fac.body.handel.factuur.nummer;
    const bijLev = await post(srv.base, '/supplier/facturen/mijn', {}, was);
    const bijKop = await post(srv.base, '/supplier/facturen/mijn', {}, club);
    const zoek = (lijst) => (lijst || []).find(f => f.nummer === nummer);

    const verkocht = zoek(bijLev.body.verkocht);
    assert.ok(verkocht, 'de handelsfactuur hoort bij de leverancier onder "verkocht" te staan');
    assert.equal(verkocht.ref, aan.body.handel.ref,
      'de factuur hoort de aanvraagreferentie te dragen, anders is hij niet terug te vinden bij de handel');
    assert.ok(zoek(bijKop.body.gekocht),
      'en bij de koper onder "gekocht" -- een factuur die maar een kant kent, is geen boekhouding');
    assert.equal(zoek(bijLev.body.gekocht), undefined,
      'de leverancier hoort zijn eigen factuur niet ook als inkoop te zien');

    const bet = await post(srv.base, '/supplier/handel/betalen', { id }, club);
    assert.equal(bet.status, 200, JSON.stringify(bet.body));
    assert.equal(bet.body.handel.status, 'betaald');
    assert.ok(bet.body.handel.betaaldAt, 'een voldane handel hoort een tijdstip te dragen');

    // en hij staat bij BEIDE kanten in het overzicht, elk in zijn eigen rol
    const naClub = await post(srv.base, '/supplier/handel/mijn', {}, club);
    const naWas = await post(srv.base, '/supplier/handel/mijn', {}, was);
    assert.equal(vind(naClub.body.alsKoper, id).rol, 'koper');
    assert.equal(vind(naWas.body.alsLeverancier, id).rol, 'leverancier');
  } finally { await stop(srv); }
});

test('het vinden gaat op genre: een garage ziet een linnenaanvraag niet en mag er niet op offreren', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const garage = await beheer(srv.base, GARAGE);
    const aan = await post(srv.base, '/supplier/handel/aanvraag', {
      genre: 'wasserij', titel: 'Linnen', regels: [{ wat: 'servetten', aantal: 100, eenheid: 'stuk' }]
    }, club);
    const id = aan.body.handel.id;

    const bijGarage = await post(srv.base, '/supplier/handel/mijn', {}, garage);
    assert.equal(vind(bijGarage.body.open, id), undefined, 'een garage hoort geen linnenaanvraag te zien');

    const off = await post(srv.base, '/supplier/handel/offreren', { id, prijs: 10 }, garage);
    assert.equal(off.status, 403, 'een garage hoort niet te mogen offreren op een wasserij-aanvraag');
  } finally { await stop(srv); }
});

test('de volgorde ligt vast: niet leveren voor de gunning, niet factureren voor de levering', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const was = await beheer(srv.base, WASSERIJ);
    const aan = await post(srv.base, '/supplier/handel/aanvraag', {
      genre: 'wasserij', titel: 'Linnen', regels: [{ wat: 'servetten', aantal: 100, eenheid: 'stuk' }]
    }, club);
    const id = aan.body.handel.id;

    const teVroegLeveren = await post(srv.base, '/supplier/handel/leveren', { id, bewijs: 'X' }, was);
    assert.equal(teVroegLeveren.status, 409, 'leveren op een aanvraag die nog niet gegund is, hoort te weigeren');

    await post(srv.base, '/supplier/handel/offreren', { id, prijs: 100 }, was);
    const mijn = await post(srv.base, '/supplier/handel/mijn', {}, club);
    const offerteId = vind(mijn.body.alsKoper, id).offertes[0].id;
    await post(srv.base, '/supplier/handel/gunnen', { id, offerteId }, club);

    const teVroegFactureren = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 100 }, was);
    assert.equal(teVroegFactureren.status, 409, 'factureren voor de levering hoort te weigeren');

    // en zonder bewijs is er geen levering
    const zonderBewijs = await post(srv.base, '/supplier/handel/leveren', { id, bewijs: '' }, was);
    assert.equal(zonderBewijs.status, 400, 'een levering zonder bewijs hoort te weigeren');

    await post(srv.base, '/supplier/handel/leveren', { id, bewijs: 'Marta' }, was);
    // een factuur die afwijkt van de gunning is een andere afspraak
    const anderBedrag = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 175 }, was);
    assert.equal(anderBedrag.status, 409, 'een factuur boven het gegunde bedrag hoort te weigeren');
    const goed = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 100 }, was);
    assert.equal(goed.status, 200, JSON.stringify(goed.body));
  } finally { await stop(srv); }
});

test('een leverancier ziet de prijs van zijn concurrent niet', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const a = await beheer(srv.base, ZORG_A);
    const b = await beheer(srv.base, ZORG_B);
    const aan = await post(srv.base, '/supplier/handel/aanvraag', {
      genre: 'zorg', titel: 'Bedrijfs-APK voor het team',
      regels: [{ wat: 'keuringen', aantal: 12, eenheid: 'stuk' }]
    }, club);
    const id = aan.body.handel.id;

    await post(srv.base, '/supplier/handel/offreren', { id, prijs: 900 }, a);
    await post(srv.base, '/supplier/handel/offreren', { id, prijs: 750 }, b);

    const bijA = await post(srv.base, '/supplier/handel/mijn', {}, a);
    const gezienA = vind(bijA.body.open, id);
    assert.equal(gezienA.offertes.length, 1, 'een leverancier hoort alleen zijn eigen offerte te zien');
    assert.equal(gezienA.offertes[0].prijs, 900);

    const bijClub = await post(srv.base, '/supplier/handel/mijn', {}, club);
    assert.equal(vind(bijClub.body.alsKoper, id).offertes.length, 2, 'de koper ziet ze allebei');
  } finally { await stop(srv); }
});

test('een derde zaak kan niet leveren op wat aan een ander is gegund', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const a = await beheer(srv.base, ZORG_A);
    const b = await beheer(srv.base, ZORG_B);
    const aan = await post(srv.base, '/supplier/handel/aanvraag', {
      genre: 'zorg', titel: 'Keuringen', regels: [{ wat: 'keuringen', aantal: 5, eenheid: 'stuk' }]
    }, club);
    const id = aan.body.handel.id;
    await post(srv.base, '/supplier/handel/offreren', { id, prijs: 400 }, a);
    const mijn = await post(srv.base, '/supplier/handel/mijn', {}, club);
    await post(srv.base, '/supplier/handel/gunnen',
      { id, offerteId: vind(mijn.body.alsKoper, id).offertes[0].id }, club);

    const stiekem = await post(srv.base, '/supplier/handel/leveren', { id, bewijs: 'ik' }, b);
    assert.equal(stiekem.status, 403, 'wie de gunning niet heeft, hoort niet te kunnen leveren');
    const stiekemFactuur = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 400 }, b);
    assert.equal(stiekemFactuur.status, 403, 'en al helemaal niet te kunnen factureren');
  } finally { await stop(srv); }
});

test('een aanvraag zonder soort, zonder regels of aan het eigen vak weigert', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const geenGenre = await post(srv.base, '/supplier/handel/aanvraag',
      { genre: 'bestaatniet', titel: 'X', regels: [{ wat: 'y', aantal: 1 }] }, club);
    assert.equal(geenGenre.status, 400);
    const geenRegels = await post(srv.base, '/supplier/handel/aanvraag',
      { genre: 'wasserij', titel: 'X', regels: [] }, club);
    assert.equal(geenRegels.status, 400);
    const eigenVak = await post(srv.base, '/supplier/handel/aanvraag',
      { genre: 'beachclub', titel: 'X', regels: [{ wat: 'y', aantal: 1 }] }, club);
    assert.equal(eigenVak.status, 400, 'een aanvraag aan het eigen soort bedrijf hoort te weigeren');
  } finally { await stop(srv); }
});

test('rechtstreeks bestellen: dezelfde staart, zonder de omweg langs een offerte', async () => {
  /* WAAROM DEZE TWEEDE INGANG BESTAAT. Er zijn twee manieren waarop zaken bij
     elkaar kopen: je weet niet wie en niet voor hoeveel (dan zet je een aanvraag
     uit), of je weet het allebei al (een vaste leverancier, een prijslijst). In
     het tweede geval is offreren een omweg langs iets wat vaststaat.

     Alleen de KOP verschilt; de staart -- inplannen, leveren, factureren,
     betalen -- is identiek. Deze toets legt vast dat het ook echt DEZELFDE
     staart is en geen tweede keten met dezelfde woorden erop. */
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const was = await beheer(srv.base, WASSERIJ);

    const best = await post(srv.base, '/supplier/handel/bestellen', {
      leverancierCode: WASSERIJ, titel: 'Weekvoorraad servetten',
      regels: [{ wat: 'servetten', aantal: 500, eenheid: 'stuk' }],
      prijs: 150, ophalen: 'maandag 08:00'
    }, club);
    assert.equal(best.status, 200, JSON.stringify(best.body));
    const id = best.body.handel.id;

    // meteen gegund: geen offerterondje, de prijs stond al vast
    assert.equal(best.body.handel.status, 'gegund');
    assert.equal(best.body.handel.gegundAan.prijs, 150);

    // hij staat NIET in de open lijst van andere wasserijen: dit is geen aanvraag
    const bijWas = await post(srv.base, '/supplier/handel/mijn', {}, was);
    assert.equal((bijWas.body.open || []).find(h => h.id === id), undefined,
      'een rechtstreekse bestelling hoort niet als open aanvraag rond te gaan');
    assert.ok((bijWas.body.alsLeverancier || []).find(h => h.id === id),
      'de bestelde zaak hoort hem meteen als opdracht te zien');

    // en dan exact dezelfde staart als bij een gegunde aanvraag
    assert.equal((await post(srv.base, '/supplier/handel/plannen',
      { id, ophaalMoment: 'maandag 08:00' }, was)).status, 200);
    assert.equal((await post(srv.base, '/supplier/handel/leveren',
      { id, bewijs: 'Marta' }, was)).status, 200);
    // de factuurcontrole is woordelijk dezelfde: afwijken van de afspraak weigert
    assert.equal((await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 200 }, was)).status, 409,
      'ook bij een rechtstreekse bestelling is de afgesproken prijs de afspraak');
    const fac = await post(srv.base, '/supplier/handel/factureren', { id, bedrag: 150 }, was);
    assert.equal(fac.status, 200, JSON.stringify(fac.body));
    assert.equal((await post(srv.base, '/supplier/handel/betalen', { id }, club)).status, 200);
  } finally { await stop(srv); }
});

test('bestellen weigert bij uzelf, bij een onbekende zaak en zonder afgesproken bedrag', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const club = await beheer(srv.base, KOPER);
    const regels = [{ wat: 'servetten', aantal: 10, eenheid: 'stuk' }];
    assert.equal((await post(srv.base, '/supplier/handel/bestellen',
      { leverancierCode: KOPER, titel: 'X', regels, prijs: 10 }, club)).status, 400);
    assert.equal((await post(srv.base, '/supplier/handel/bestellen',
      { leverancierCode: 'BESTAATNIET', titel: 'X', regels, prijs: 10 }, club)).status, 404);
    assert.equal((await post(srv.base, '/supplier/handel/bestellen',
      { leverancierCode: WASSERIJ, titel: 'X', regels, prijs: 0 }, club)).status, 400,
      'zonder afgesproken bedrag is het geen bestelling maar een aanvraag');
  } finally { await stop(srv); }
});

test('elke stap uit de levensloop heeft een endpoint, en het scherm kent geen andere', () => {
  /* HOE DIT ER KWAM. Het scherm leidt zijn pad af uit de STAPNAAM
     (/api/supplier/handel/<stap>), en de route heette 'offerte' terwijl de stap
     'offreren' heet. Gevolg: de knop deed niets en de gebruiker kreeg "Onbekend
     eindpunt" -- geen enkele servertoets zag dat, want die riepen het endpoint
     rechtstreeks aan. Dit is de lijn tussen de drie plekken: de levensloop, de
     routes en het scherm. */
  const routes = fs.readFileSync(path.join(__dirname, '..', 'server/routes/supplier/handel.js'), 'utf8');
  const scherm = fs.readFileSync(path.join(__dirname, '..', 'public/apps/handel.js'), 'utf8');

  const stappen = new Set();
  for (const wie of Object.values(STAPPEN)) for (const stap of Object.keys(wie)) stappen.add(stap);
  assert.ok(stappen.size >= 7, 'de levensloop hoort stappen te hebben, anders toetst dit niets');

  const zonderRoute = [...stappen].filter(s => !routes.includes("'/api/supplier/handel/" + s + "'"));
  assert.deepEqual(zonderRoute, [], 'stappen zonder endpoint: ' + zonderRoute.join(', '));

  // en andersom: het scherm mag geen stap kennen die de levensloop niet heeft
  const inScherm = [...scherm.matchAll(/^\s{4}(\w+):\s*\{ tekst:/gm)].map(m => m[1]);
  assert.ok(inScherm.length >= 7, 'het scherm hoort knoppen te kennen, anders toetst dit niets');
  const onbekend = inScherm.filter(s => !stappen.has(s));
  assert.deepEqual(onbekend, [], 'het scherm kent stappen die de keten niet heeft: ' + onbekend.join(', '));
});
