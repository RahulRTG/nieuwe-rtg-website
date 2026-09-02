/* ============================================================================
   ZESTIEN ROUTES VAN DE BUURTRUIL, DE GIFTLAAG EN DE WINKEL -- OVER DE DRAAD.

   De kern van deze drie delen wordt al getoetst (test/rtfos-ruil.test.js,
   test/rtfos-gift.test.js, test/rtfos-winkel.test.js), maar die drie roepen de
   modules rechtstreeks aan of bouwen hun paden in elkaar (`ruil('lijst', ...)`).
   Het routejournaal telt alleen wat de server zelf heeft gematcht, dus voor de
   deltapoort bestonden deze zestien paden niet. Ze staan hier voluit, en niet
   om aangetikt te worden: elke oproep legt een grens vast die de route zegt te
   hebben.

   WAT ER HIER BOVENOP KOMT ten opzichte van die drie bestanden, en waarom dit
   geen kopie is: de DEUR. Alle zestien hangen aan de ledendeur (`auth` +
   `geenGast`), en dat is voor dit domein de uitzondering -- de rest van RTFOS
   staat achter de kantoor- of boardroomdeur. Een rechtstreekse handleraanroep
   ziet die deur nooit. En de tweede helft die alleen over de draad zichtbaar is:
   de codenaam komt uit de SESSIE en niet uit het lijf, dus wie iets plaatst,
   meldt, tekent of koopt is niet te sturen vanaf de client.

   WAT GIFT.md HIER LAAT VASTLEGGEN, en dat is de reden dat dit bestand streng
   is op zinnen en niet alleen op statuscodes:

   - er is met opzet GEEN doneerknop en geen incasso. `voorbereid` rekent uit wat
     er ZOU gebeuren en betaalt niets (`nietGedaan` staat in het antwoord zelf),
     en de machtiging zegt in elk antwoord `geindNu: false` met de reden erbij.
   - een periodieke gift heet alleen zo met een overeenkomst van ten minste vijf
     jaar; tot de stichting die vastlegt is elke termijn een gewone gift.
   - een giftbewijs WEIGERT waar het geen gift is: staat er iets tegenover, dan
     is het sponsoring met een factuur -- ook als de stichting een ANBI is.
   - een aankoop in de winkel is nooit een gift, en dat staat in het antwoord.

   EN DE SCHAKELAAR STAAT STANDAARD DICHT (CLAUDE.md, "let op de terugstortstand"
   -- de giftstand heeft dezelfde vorm). Toets 7 legt precies dat vast: zolang de
   boardroom hem niet heeft gezet, weigeren de giftweg EN de winkel met een zin
   die zegt waarom. Pas daarna zet toets 8 hem om, en dat is geen omweg om de
   grens heen: het IS de grens -- die knop hoort door een mens uit de boardroom
   gezet te worden en door niemand anders. Wat daardoor NIET beproefd is:
   `/api/rtfos/gift/bevestig` (de enige plek waar geld beweegt) hoort niet bij
   deze groep en wordt hier met opzet niet aangeroepen.

   DE VOLGORDE VAN DIT BESTAND DOET ERTOE. Toets 7 moet vóór toets 8 draaien
   (anders staat de knop al open) en toets 18 gaat als laatste, want die zet de
   ANBI-stand op "ja" en dat verandert wat elke eerdere toets zou zien.

   Draai los: node --test test/rtfos-gift-ruil-routes.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

/* De twee getallen die deze toets nodig heeft komen UIT de bron en staan hier
   niet nog een keer overgetypt (LAT.md regel 4): een tweede kopie van de
   drempel of van de ondergrens gaat een keer uiteen, en dan toetst dit bestand
   een belofte die de code niet meer doet. */
const { DREMPEL_CENTEN } = require('../server/kern/rtfos/herkomst');
const { JAREN_MIN } = require('../server/kern/rtfos/gift-vormen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-giftruil-'));
const OFFICE_CODE = 'GIFTRUIL-KEURING';

/* De zestien paden van deze groep, voluit -- ook omdat de deurtoets ze een voor
   een langsloopt. */
const PADEN = [
  '/api/rtfos/ruil/lijst', '/api/rtfos/ruil/mijn', '/api/rtfos/ruil/plaats',
  '/api/rtfos/ruil/sluit', '/api/rtfos/ruil/interesse', '/api/rtfos/ruil/meld',
  '/api/rtfos/gift/voorbereid', '/api/rtfos/gift/plan/voorstel',
  '/api/rtfos/gift/plan/mijn', '/api/rtfos/gift/plan/stop',
  '/api/rtfos/gift/projecten', '/api/rtfos/gift/machtiging/mijn',
  '/api/rtfos/gift/machtiging/teken', '/api/rtfos/gift/machtiging/intrek',
  '/api/rtfos/winkel/koop', '/api/rtfos/winkel/mijn'
];

let srv, base, kantoor, bestuur2;
let STAD, DICHTE_STAD, PROJECT, PROJECT_IDEE, ARTIKEL;
/* De leden. Ze zijn met opzet uit elkaar getrokken: de schrijfrem van
   routes/rtfos/ruil.js staat op twintig schrijfacties per minuut per CODENAAM,
   en een toetsbestand dat alles op een lid doet, zakt straks op die rem in
   plaats van op zijn onderwerp. */
let A, B, C, G, P, H, K;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een echt lid met een echte sessie. De codenaam komt uit het antwoord van de
   server: die hebben we nodig om te toetsen dat een aanbod aan een CODENAAM
   hangt en niet aan een naam. */
async function lid(naam) {
  const email = naam.toLowerCase().replace(/\W+/g, '') + Date.now() + Math.random().toString(36).slice(2, 6) + '@voorbeeld.test';
  const r = await api('/api/auth/register', { name: naam, email, password: 'geheim123',
    geboortedatum: '1990-05-05', pasApp: 'rtg' });
  assert.ok(r.body.token, 'aanmelden mislukt voor ' + naam + ': ' + JSON.stringify(r.body).slice(0, 160));
  return { token: r.body.token, codenaam: r.body.state.user.codename, naam, email };
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, OFFICE_CODE, SMTP_URL: '' } });
  base = srv.base;

  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen kantoorsessie; de stad, het project en de giftstand komen daar vandaan');

  /* EEN TWEEDE MENS IN HET BESTUUR, en niet uit netheid: een project dat nooit
     beoordeeld is, mag geen geld ontvangen, dus wie het indient keurt het niet
     zelf goed (kern/rtfos/projecten-besluit.js). Zonder deze tweede persoon is
     er geen LOPEND project en kan de geoormerkte gift niet worden beproefd. */
  const tweede = await lid('Tweede Bestuurder');
  await api('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, tweede.token);
  bestuur2 = (await api('/api/account/start', { rol: 'kantoor' }, tweede.token)).body.token;
  assert.ok(bestuur2, 'de tweede kantoormedewerker kreeg geen sessie');
  const geef = await api('/api/office/boardroom/toegang/geef', { codenaam: tweede.codenaam }, kantoor);
  assert.equal(geef.status, 200, 'boardroom-toegang geven mislukte: ' + JSON.stringify(geef.body).slice(0, 160));

  const stad = await api('/api/rtfos/stad/maak', { naam: 'Beverwijk' }, kantoor);
  STAD = stad.body.stad.id;
  await api('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, kantoor);
  // een tweede afdeling die met opzet NIET wordt geopend
  DICHTE_STAD = (await api('/api/rtfos/stad/maak', { naam: 'Velsen' }, kantoor)).body.stad.id;

  // een project dat loopt, en een dat blijft steken op "idee"
  PROJECT = (await api('/api/rtfos/project/maak', { stad: STAD, naam: 'Huiswerkklas',
    soort: 'overig', budget: 0 }, kantoor)).body.project.id;
  PROJECT_IDEE = (await api('/api/rtfos/project/maak', { stad: STAD, naam: 'Nog Een Idee',
    soort: 'overig', budget: 0 }, kantoor)).body.project.id;
  await api('/api/rtfos/project/status', { id: PROJECT, status: 'aanvraag' }, kantoor);
  await api('/api/rtfos/project/status', { id: PROJECT, status: 'beoordeling' }, kantoor);
  const goed = await api('/api/rtfos/project/status', { id: PROJECT, status: 'goedgekeurd' }, bestuur2);
  assert.equal(goed.status, 200, 'goedkeuren door de tweede bestuurder mislukte: ' + JSON.stringify(goed.body).slice(0, 160));
  const act = await api('/api/rtfos/project/status', { id: PROJECT, status: 'actief' }, bestuur2);
  assert.equal(act.status, 200, 'het project werd niet actief: ' + JSON.stringify(act.body).slice(0, 160));

  // een artikel om te kopen; de prijs komt hiervandaan en nooit uit de browser
  const art = await api('/api/rtfos/winkel/artikel/zet', { naam: 'Katoenen tas',
    euro: 12.5, voorraad: 2, doel: 'Taalcafe' }, kantoor);
  assert.equal(art.status, 200, JSON.stringify(art.body).slice(0, 160));
  ARTIKEL = art.body.artikel.id;

  [A, B, C, G, P, H, K] = await Promise.all([lid('Aafke Buur'), lid('Bram Buur'),
    lid('Cato Buur'), lid('Gijs Gever'), lid('Pia Plan'), lid('Hidde Gever'), lid('Koos Koper')]);
});
test.after(() => stop(srv));

/* ------------------------------------------------------------------ de deur */

test('1. de ledendeur: geen van de zestien routes komt open zonder sessie', async () => {
  /* Dit is de ENIGE rtfos-deur die op een gewone ledensessie opengaat
     (routes/rtfos/ruil.js), en dat maakt hem de gevoeligste van dit domein: een
     gat hier raakt meteen elk lid. Een handleraanroep ziet deze laag nooit. */
  for (const pad of PADEN) {
    const r = await api(pad, { stad: STAD, id: 'x', euro: 10 });
    assert.equal(r.status, 401, pad + ' antwoordde zonder sessie met ' + r.status);
    assert.match(r.body.error || '', /Niet ingelogd/, pad + ' weigerde zonder reden');
    assert.equal(r.body.ok, undefined, pad + ' leverde zonder sessie een uitkomst op');
  }
});

/* ------------------------------------------------------------- de buurtruil */

test('2. de buurtruil bestaat alleen in een stad die echt open is', async () => {
  /* Grendel 4 uit kern/rtfos/ruil.js. Een vrij tekstveld zou een landelijke
     marktplaats opleveren; een afdeling die nog niet van start is, hoort te
     zeggen dat hij nog niet van start is en niet leeg terug te komen. */
  const onbekend = await api('/api/rtfos/ruil/lijst', { stad: 'bestaat-niet' }, A.token);
  assert.equal(onbekend.status, 404);
  assert.match(onbekend.body.error, /stadsafdeling kennen we niet/);

  const dicht = await api('/api/rtfos/ruil/lijst', { stad: DICHTE_STAD }, A.token);
  assert.equal(dicht.status, 409);
  assert.match(dicht.body.error, /Velsen/, 'de weigering noemt de afdeling niet');
  assert.match(dicht.body.error, /nog niet open/);
  assert.equal(dicht.body.ruil, undefined, 'een gesloten afdeling gaf toch een lijst');

  const open = await api('/api/rtfos/ruil/lijst', { stad: STAD }, A.token);
  assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 160));
  assert.deepEqual(open.body.soorten.map(s => s.soort), ['geef', 'zoek']);
  assert.ok(Array.isArray(open.body.ruil));
});

test('3. een aanbod hangt aan een codenaam, en de echte naam komt er niet langs', async () => {
  /* Grendel 1. De codenaam komt uit de SESSIE: wat de client meestuurt doet
     niet mee, anders plaatst de een een aanbod op naam van de ander. */
  const mis = await api('/api/rtfos/ruil/plaats', { stad: STAD, soort: 'geef', titel: 'ab' }, A.token);
  assert.equal(mis.status, 400, 'een titel van twee tekens kwam erdoor');
  assert.match(mis.body.error, /Wat is het/);

  const geplaatst = await api('/api/rtfos/ruil/plaats', { stad: STAD, soort: 'geef',
    titel: 'Kinderfiets', wat: 'Blauw, 16 inch', staat: 'gebruikt',
    codenaam: B.codenaam /* een poging om het op naam van een ander te zetten */ }, A.token);
  assert.equal(geplaatst.status, 200, JSON.stringify(geplaatst.body).slice(0, 160));
  A.aanbod = geplaatst.body.ruil.id;
  assert.equal(geplaatst.body.ruil.van, A.codenaam,
    'de codenaam kwam uit het lijf in plaats van uit de sessie');

  const alsAnder = await api('/api/rtfos/ruil/lijst', { stad: STAD }, B.token);
  const rij = alsAnder.body.ruil.find(r => r.id === A.aanbod);
  assert.ok(rij, 'het aanbod staat niet in de lijst van de buurt');
  assert.equal(rij.van, A.codenaam);
  const rauw = JSON.stringify(rij);
  assert.ok(!rauw.includes(A.naam), 'de echte naam stond in de buurtlijst');
  assert.ok(!rauw.includes(A.email), 'het e-mailadres stond in de buurtlijst');
  assert.equal(rij.ikBenEigenaar, false);
  assert.equal(rij.belangstellenden, undefined,
    'een ander lid kon zien wie er in zijn buurt naar spullen zoekt');
});

test('4. interesse is een signaal dat een keer telt, en nooit op je eigen aanbod', async () => {
  /* Grendel 2 en 5. Er vertrekt niets: de eigenaar HAALT op dat er
     belangstelling is. Wie tien keer klikt, telt een keer. */
  const eigen = await api('/api/rtfos/ruil/interesse', { id: A.aanbod }, A.token);
  assert.equal(eigen.status, 400);
  assert.match(eigen.body.error, /je eigen aanbod/);

  const eerste = await api('/api/rtfos/ruil/interesse', { id: A.aanbod }, B.token);
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body).slice(0, 160));
  assert.equal(eerste.body.ruil.interesse, 1);
  assert.equal(eerste.body.ruil.belangstellenden, undefined,
    'de melder kreeg de lijst met belangstellenden terug');

  const nogmaals = await api('/api/rtfos/ruil/interesse', { id: A.aanbod }, B.token);
  assert.equal(nogmaals.status, 409, 'twee keer klikken telde twee keer');
  assert.match(nogmaals.body.error, /liet al weten/);

  /* En alleen de eigenaar ziet WIE -- en dat is een codenaam en geen mens. */
  const alsEigenaar = await api('/api/rtfos/ruil/lijst', { stad: STAD }, A.token);
  const mijn = alsEigenaar.body.ruil.find(r => r.id === A.aanbod);
  assert.equal(mijn.ikBenEigenaar, true);
  assert.deepEqual(mijn.belangstellenden, [B.codenaam]);
});

test('5. melden verbergt pas bij twee VERSCHILLENDE melders, en liegt niet over de eerste', async () => {
  /* Grendel 3: de melding verbergt, maar oordeelt niet. Een teller die bij een
     enkele melding al verwijdert, is een knop waarmee een lid iemand anders
     laat verdwijnen. En wat de melder terugkrijgt is wat er GEBEURDE. */
  const tweede = await api('/api/rtfos/ruil/plaats', { stad: STAD, soort: 'zoek',
    titel: 'Twijfelachtig aanbod', wat: 'hier gaat gemeld worden' }, A.token);
  assert.equal(tweede.status, 200);
  const id = tweede.body.ruil.id;

  const eigen = await api('/api/rtfos/ruil/meld', { id, reden: 'eigen' }, A.token);
  assert.equal(eigen.status, 400, 'je eigen aanbod melden werd niet geweigerd');
  assert.match(eigen.body.error, /kunt het intrekken/);

  const een = await api('/api/rtfos/ruil/meld', { id, reden: 'klopt niet' }, B.token);
  assert.equal(een.status, 200, JSON.stringify(een.body).slice(0, 160));
  assert.equal(een.body.verborgen, false, 'een enkele melding verborg het aanbod al');
  assert.match(een.body.bericht, /nog niets verborgen/,
    'de melder kreeg een dankwoord in plaats van wat er gebeurde');

  const dubbel = await api('/api/rtfos/ruil/meld', { id, reden: 'nog eens' }, B.token);
  assert.equal(dubbel.status, 409, 'dezelfde melder telde twee keer');

  const twee = await api('/api/rtfos/ruil/meld', { id, reden: 'ook niet pluis' }, C.token);
  assert.equal(twee.status, 200, JSON.stringify(twee.body).slice(0, 160));
  assert.equal(twee.body.verborgen, true, 'twee verschillende melders verborgen het aanbod niet');
  assert.match(twee.body.bericht, /iemand van de stichting/i,
    'het verbergen werd gepresenteerd als een eindoordeel');

  const lijst = await api('/api/rtfos/ruil/lijst', { stad: STAD }, B.token);
  assert.ok(lijst.body.ruil.some(r => r.id === A.aanbod), 'het gewone aanbod hoort nog in de buurtlijst -- anders zegt de regel hierna niets');
  assert.ok(!lijst.body.ruil.some(r => r.id === id), 'het verborgen aanbod stond nog in de buurtlijst');
  A.gemeld = id;
});

test('6. sluiten doet alleen de eigenaar; /mijn houdt wat de buurtlijst loslaat', async () => {
  const ander = await api('/api/rtfos/ruil/sluit', { id: A.aanbod, status: 'weg' }, B.token);
  assert.equal(ander.status, 403, 'een ander lid kon het aanbod sluiten');
  assert.match(ander.body.error, /niet van jou/);

  const weg = await api('/api/rtfos/ruil/sluit', { id: A.aanbod, status: 'weg' }, A.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  assert.equal(weg.body.ruil.status, 'weg');

  const lijst = await api('/api/rtfos/ruil/lijst', { stad: STAD }, B.token);
  assert.ok(!lijst.body.ruil.some(r => r.id === A.aanbod), 'een gesloten aanbod stond nog in de buurtlijst');

  /* De rij blijft staan -- verborgen en gesloten zijn geen verwijdering -- en de
     eigenaar ziet zijn eigen geschiedenis, ook het gemelde aanbod. */
  const mijn = await api('/api/rtfos/ruil/mijn', {}, A.token);
  assert.equal(mijn.status, 200, JSON.stringify(mijn.body).slice(0, 160));
  const standen = {};
  for (const r of mijn.body.ruil) standen[r.id] = r.status;
  assert.equal(mijn.body.ruil.length, 2, 'de eigenaar hoort zijn twee aanbiedingen te zien: het gesloten en het gemelde');
  assert.equal(standen[A.aanbod], 'weg');
  assert.equal(standen[A.gemeld], 'verborgen');
  assert.ok(mijn.body.ruil.every(r => r.ikBenEigenaar), '/mijn gaf een aanbod van iemand anders');

  const vanB = await api('/api/rtfos/ruil/mijn', {}, B.token);
  assert.equal(vanB.status, 200);
  assert.deepEqual(vanB.body.ruil, [], '/mijn toont ook wat van een ander is');
});

/* -------------------------------------------------------------- de giftstand */

test('7. de knop staat dicht: geven weigert MET de reden, en de winkel rekent niets af', async () => {
  /* DE STAND IS DE POSITIE EN NIET EEN INSTELLING ERNAAST (GIFT.md; zelfde vorm
     als de terugstortstand in CLAUDE.md). Standaard dicht, en dan hoort een lid
     te LEZEN dat het niet kan en waarom -- geen grijze knop, geen lege lijst.

     Deze toets moet vóór toets 8 draaien: daarna staat de knop open. */
  const gift = await api('/api/rtfos/gift/voorbereid', { euro: 25 }, G.token);
  assert.equal(gift.status, 409);
  assert.match(gift.body.error, /geen giften aan/i);
  assert.match(gift.body.error, /geen storing/i, 'een dichte knop leest als een storing');
  assert.equal(gift.body.voornemen, undefined, 'een dichte knop leverde toch een voornemen op');

  /* De winkel loopt niet langs de giftweg, maar leest wel dezelfde walletcode:
     zonder positie van de stichting in RTG Pay is er niets af te rekenen. En
     hij WEIGERT dan -- hij zet geen bestelling klaar die niemand betaald heeft. */
  const koop = await api('/api/rtfos/winkel/koop', { artikelId: ARTIKEL, aantal: 1 }, K.token);
  assert.equal(koop.status, 409, JSON.stringify(koop.body).slice(0, 160));
  assert.match(koop.body.error, /geen positie in RTG Pay/);
  const mijn = await api('/api/rtfos/winkel/mijn', {}, K.token);
  assert.deepEqual(mijn.body.bestellingen, [], 'er stond een bestelling klaar zonder betaling');
});

test('8. de boardroom zet hem om -- en dat kan niet zonder ontvanger en vorm', async () => {
  /* Grendel 1 van kern/rtfos/gift.js: open kan alleen met een plek waar het
     geld landt en met een giftvorm. Niet te omzeilen door de stand als eerste
     te zetten -- dat is precies wat hier wordt geprobeerd. */
  const kaal = await api('/api/rtfos/gift/stand/zet', { stand: 'open' }, kantoor);
  assert.equal(kaal.status, 409, 'de knop ging open zonder ontvanger');
  assert.match(kaal.body.error, /Waar landt het geld/i);

  const gezet = await api('/api/rtfos/gift/stand/zet', {
    ontvanger: { soort: 'wallet', code: 'RTF-WALLET' },
    vormen: ['eenmalig', 'geoormerkt', 'periodiek'], anbi: 'aangevraagd' }, kantoor);
  assert.equal(gezet.status, 200, JSON.stringify(gezet.body).slice(0, 160));
  assert.equal(gezet.body.stand, 'dicht', 'het invullen van de besluiten opende de knop vanzelf');

  const open = await api('/api/rtfos/gift/stand/zet', { stand: 'open' }, kantoor);
  assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 160));
  assert.equal(open.body.stand, 'open');
});

test('9. het voornemen zegt wat het IS, en het betaalt niets', async () => {
  /* Grendel 2: `voorbereid` rekent uit wat er ZOU gebeuren en boekt niets. Dat
     staat in het antwoord zelf (`nietGedaan`), zodat een scherm dat het
     overslaat het alsnog toont. */
  const gewoon = await api('/api/rtfos/gift/voorbereid', { euro: 25 }, G.token);
  assert.equal(gewoon.status, 200, JSON.stringify(gewoon.body).slice(0, 160));
  assert.equal(gewoon.body.voornemen.soort, 'donatie');
  assert.equal(gewoon.body.voornemen.euro, 25);
  assert.equal(gewoon.body.voornemen.beoordeeldVooraf, false);
  /* De ANBI-stand is "aangevraagd", dus niet aftrekbaar en geen giftbewijs:
     wat niemand heeft vastgesteld valt terug op de voorzichtige kant. */
  assert.equal(gewoon.body.voornemen.aftrekbaar, false);
  assert.equal(gewoon.body.voornemen.stuk, 'ontvangstbevestiging');
  assert.match(gewoon.body.nietGedaan, /niets betaald en niets vastgelegd/);

  /* Staat er iets tegenover, dan is het geen gift maar sponsoring -- en dan
     hoort er een FACTUUR uit te gaan en geen ontvangstbevestiging. */
  const spons = await api('/api/rtfos/gift/voorbereid', { euro: 25, tegenprestatie: true }, G.token);
  assert.equal(spons.status, 200);
  assert.equal(spons.body.voornemen.soort, 'sponsoring');
  assert.equal(spons.body.voornemen.stuk, 'factuur');
  assert.equal(spons.body.voornemen.aftrekbaar, false);
  assert.ok(spons.body.zegt.some(z => /geen giftbewijs/i.test(z)),
    'de gever leest niet dat hier geen giftbewijs uit komt');

  /* Boven de drempel uit kern/rtfos/herkomst.js wordt er eerst gekeken, en dat
     wordt VOORAF gezegd in plaats van achteraf. */
  const groot = await api('/api/rtfos/gift/voorbereid', { euro: DREMPEL_CENTEN / 100 }, G.token);
  assert.equal(groot.status, 200);
  assert.equal(groot.body.voornemen.beoordeeldVooraf, true);
  assert.ok(groot.body.zegt.some(z => /eerst beoordeeld/i.test(z)));
});

test('10. een geoormerkte gift wijst een LOPEND project aan, en de naam komt van de server', async () => {
  /* De omkering uit kern/rtfos/gift-projecten.js: een lid kon 25 euro
     oormerken op een zelfverzonnen projectId en dat kwam er met 200 doorheen.
     De browser mag een ID kiezen; de NAAM wordt er hier bij gezocht. */
  const verzonnen = await api('/api/rtfos/gift/voorbereid', { euro: 25, vorm: 'geoormerkt',
    projectId: 'bestaat-helemaal-niet' }, G.token);
  assert.equal(verzonnen.status, 400);
  assert.match(verzonnen.body.error, /project dat nu loopt/);

  /* Een project dat nog op "idee" staat is er wel, maar loopt niet: geld
     vastzetten voor iets dat misschien nooit komt, kan niet. */
  const idee = await api('/api/rtfos/gift/voorbereid', { euro: 25, vorm: 'geoormerkt',
    projectId: PROJECT_IDEE }, G.token);
  assert.equal(idee.status, 400, 'een gift kon worden vastgezet op een project dat nog een idee is');

  const echt = await api('/api/rtfos/gift/voorbereid', { euro: 25, vorm: 'geoormerkt',
    projectId: PROJECT, project: 'Verzonnen Naam' }, G.token);
  assert.equal(echt.status, 200, JSON.stringify(echt.body).slice(0, 160));
  assert.equal(echt.body.voornemen.projectId, PROJECT);
  assert.equal(echt.body.voornemen.project, 'Huiswerkklas',
    'de projectnaam kwam uit de browser in plaats van uit het projectregister');
});

test('11. de projectenlijst toont wat loopt; het filter is een beeld en geen grens', async () => {
  const alles = await api('/api/rtfos/gift/projecten', {}, G.token);
  assert.equal(alles.status, 200, JSON.stringify(alles.body).slice(0, 160));
  const ids = alles.body.projecten.map(p => p.id);
  assert.ok(ids.includes(PROJECT), 'het lopende project staat niet in de keuzelijst');
  assert.ok(!ids.includes(PROJECT_IDEE), 'een project dat nog een idee is stond in de keuzelijst');
  assert.equal(alles.body.aantal, alles.body.projecten.length);
  assert.ok(alles.body.projecten.length >= 1, 'de volle lijst hoort het lopende project te dragen; anders zegt het filter hieronder niets');
  assert.match(alles.body.uitleg, /alleen met jouw toestemming herbestemd/);
  /* Karig: naam, stad, soort en doelgroep -- geen budget en geen bestedingen. */
  for (const p of alles.body.projecten) {
    assert.equal(p.budget, undefined, 'het budget van een project lekte naar de gever');
    assert.equal(p.budgetCenten, undefined);
  }

  /* Grendel 2: `soort` filtert het BEELD. Een filter dat stiekem ook bepaalt
     wat mag, is een grens die niemand heeft opgeschreven -- dus de volle lijst
     blijft de volle lijst. */
  const anders = await api('/api/rtfos/gift/projecten', { soort: 'zorg' }, G.token);
  assert.equal(anders.status, 200);
  assert.equal(anders.body.soort, 'zorg');
  assert.ok(!anders.body.projecten.some(p => p.id === PROJECT),
    'het filter gaf een project van een andere soort terug');
  assert.match(anders.body.uitleg, /zonder oormerk komt bij het werk in de steden/,
    'een lege uitkomst kwam zonder uitleg terug');
});

/* --------------------------------------------------- het meerjarige plan */

test('12. een periodieke gift heet pas zo bij vijf jaar, en pas na een vastgelegde overeenkomst', async () => {
  /* Grendel 1 en 3 uit kern/rtfos/gift-periodiek.js. De ondergrens komt uit
     kern/rtfos/gift-vormen.js en staat hier niet als getal. */
  const kort = await api('/api/rtfos/gift/plan/voorstel', { euroPerJaar: 100, jaren: JAREN_MIN - 1 }, P.token);
  assert.equal(kort.status, 400, 'een plan korter dan de ondergrens werd aangenomen');
  assert.match(kort.body.error, new RegExp('ten minste ' + JAREN_MIN + ' jaar'));

  const goed = await api('/api/rtfos/gift/plan/voorstel', { euroPerJaar: 100, jaren: JAREN_MIN }, P.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  P.plan = goed.body.plan.id;
  assert.equal(goed.body.plan.stand, 'voorgesteld',
    'een voorstel van een gever werd meteen een overeenkomst');
  assert.equal(goed.body.plan.kenmerk, null, 'er stond een kenmerk bij zonder vastgelegd stuk');
  assert.equal(goed.body.plan.aftrekbaar, false,
    'een niet-vastgelegd plan bij een stichting zonder ANBI heette aftrekbaar');
  assert.equal(goed.body.plan.termijnen.length, JAREN_MIN);
  assert.ok(goed.body.plan.termijnen.every(t => t.voldaan === false));
  assert.ok(goed.body.plan.zegt.some(z => /elke betaling een gewone gift/i.test(z)),
    'het plan belooft een periodieke gift die er nog niet is');
  assert.ok(goed.body.plan.zegt.some(z => /niets automatisch afgeschreven/i.test(z)),
    'er staat niet dat er geen incasso loopt');
});

test('13. plan/mijn is van de gever zelf, en andermans plan stop je niet', async () => {
  const vanH = await api('/api/rtfos/gift/plan/voorstel', { euroPerJaar: 60, jaren: JAREN_MIN }, H.token);
  assert.equal(vanH.status, 200, JSON.stringify(vanH.body).slice(0, 160));
  H.plan = vanH.body.plan.id;

  const mijnP = await api('/api/rtfos/gift/plan/mijn', {}, P.token);
  assert.equal(mijnP.status, 200);
  const idsP = mijnP.body.plannen.map(x => x.id);
  assert.ok(idsP.includes(P.plan));
  assert.ok(!idsP.includes(H.plan), 'de gever zag het plan van een ander lid');
  assert.ok(mijnP.body.plannen.length >= 1, 'de gever hoort zijn eigen plan te zien');
  assert.ok(mijnP.body.plannen.every(x => x.gever === undefined),
    'de codenaam van de gever staat in zijn eigen overzicht (die hoort bij de kantoorlijst)');

  const stoppen = await api('/api/rtfos/gift/plan/stop', { id: H.plan }, P.token);
  assert.equal(stoppen.status, 403, 'het plan van een ander lid kon gestopt worden');
  assert.match(stoppen.body.error, /niet van jou/);

  const bestaatNiet = await api('/api/rtfos/gift/plan/stop', { id: 'bestaat-niet' }, P.token);
  assert.equal(bestaatNiet.status, 404);
});

/* --------------------------------------------------------- de machtiging */

test('14. de machtiging: nooit onder het jaarbedrag, nooit het hele IBAN, en er wordt niets geind', async () => {
  /* GIFT.md: er is geen incasso, en die komt er niet uit zichzelf. Dit huis
     heeft geen incasso-rail, dus elk antwoord uit deze laag zegt dat met
     `geindNu: false` en de reden erbij. */
  const zonderPlan = await api('/api/rtfos/gift/machtiging/teken', { planId: 'bestaat-niet',
    houder: 'P. Plan', ibanEinde: '4300', max: 150, frequentie: 'jaarlijks' }, P.token);
  assert.equal(zonderPlan.status, 404, 'een machtiging zonder plan werd getekend');

  const teLaag = await api('/api/rtfos/gift/machtiging/teken', { planId: P.plan,
    houder: 'P. Plan', ibanEinde: '4300', max: 50, frequentie: 'jaarlijks' }, P.token);
  assert.equal(teLaag.status, 400, 'een maximum onder het jaarbedrag werd aangenomen');
  assert.match(teLaag.body.error, /ligt onder het jaarbedrag/);

  /* Wie het hele nummer intikt, krijgt ook alleen de laatste vier terug -- en
     het volledige nummer wordt niet bewaard, want er wordt hier niets geind. */
  const getekend = await api('/api/rtfos/gift/machtiging/teken', { planId: P.plan,
    houder: 'P. Plan', iban: 'NL91ABNA0417164300', max: 150, frequentie: 'jaarlijks' }, P.token);
  assert.equal(getekend.status, 200, JSON.stringify(getekend.body).slice(0, 200));
  P.machtiging = getekend.body.machtiging.id;
  assert.equal(getekend.body.machtiging.ibanEinde, '4300');
  assert.ok(!JSON.stringify(getekend.body).includes('NL91ABNA0417164300'),
    'het volledige rekeningnummer kwam terug in het antwoord');
  assert.equal(getekend.body.geindNu, false, 'de machtiging deed alsof er geind werd');
  assert.match(getekend.body.uitleg, /int niets/);
  assert.ok(getekend.body.zegt.some(z => /van tevoren bericht/i.test(z)),
    'de aankondiging vooraf staat niet in wat de gever leest');

  const mijn = await api('/api/rtfos/gift/machtiging/mijn', {}, P.token);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.geindNu, false);
  assert.equal(mijn.body.machtigingen.length, 1);
  assert.equal(mijn.body.machtigingen[0].planId, P.plan,
    'de machtiging hangt niet aan een plan maar aan de mens');
  assert.ok(mijn.body.machtigingen[0].aankondigingDagen > 0);

  const vanH = await api('/api/rtfos/gift/machtiging/mijn', {}, H.token);
  assert.deepEqual(vanH.body.machtigingen, [], 'een ander lid zag deze machtiging');
});

test('15. intrekken stopt de incasso en NIET de gift; een gestopt plan laat geen volmacht achter', async () => {
  const vanAnder = await api('/api/rtfos/gift/machtiging/intrek', { id: P.machtiging }, H.token);
  assert.equal(vanAnder.status, 403, 'een ander lid kon de machtiging intrekken');

  const in1 = await api('/api/rtfos/gift/machtiging/intrek', { id: P.machtiging }, P.token);
  assert.equal(in1.status, 200, JSON.stringify(in1.body).slice(0, 160));
  assert.equal(in1.body.machtiging.actief, false);
  /* Grendel 4: dit zijn twee dingen. Een knop die stilletjes allebei doet, laat
     iemand denken dat hij van een vijfjarige afspraak af is. */
  assert.ok(in1.body.zegt.some(z => /loopt hiermee NIET af/.test(z)),
    'intrekken wekt de indruk dat de periodieke gift eindigt');

  const nogmaals = await api('/api/rtfos/gift/machtiging/intrek', { id: P.machtiging }, P.token);
  assert.equal(nogmaals.status, 409);
  assert.match(nogmaals.body.error, /al ingetrokken/);

  /* Grendel 5: andersom geldt het wel -- een machtiging bij een gestopt plan is
     een openstaande volmacht zonder grond. */
  const opnieuw = await api('/api/rtfos/gift/machtiging/teken', { planId: P.plan,
    houder: 'P. Plan', ibanEinde: '4300', max: 150, frequentie: 'jaarlijks' }, P.token);
  assert.equal(opnieuw.status, 200, JSON.stringify(opnieuw.body).slice(0, 160));
  const kenmerk = opnieuw.body.machtiging.kenmerk;

  const gestopt = await api('/api/rtfos/gift/plan/stop', { id: P.plan, reden: 'toets' }, P.token);
  assert.equal(gestopt.status, 200, JSON.stringify(gestopt.body).slice(0, 160));
  assert.equal(gestopt.body.plan.stand, 'gestopt');
  assert.deepEqual(gestopt.body.vervallenMachtigingen, [kenmerk],
    'het gestopte plan liet de machtiging staan');
  assert.match(gestopt.body.melding, /Wat je al gaf blijft staan/);
  assert.equal(gestopt.body.plan.openDitJaar, false);

  const na = await api('/api/rtfos/gift/machtiging/mijn', {}, P.token);
  /* Twee, niet een: de in toets 14 ingetrokken machtiging staat er ook nog (vervallen,
     niet gewist). Het punt is dat intrekken en stoppen een SPOOR laten. */
  assert.ok(na.body.machtigingen.length >= 1, 'de machtiging is verdwenen in plaats van vervallen -- intrekken laat het spoor staan');
  assert.ok(na.body.machtigingen.every(m => m.actief === false),
    'er stond nog een actieve machtiging bij een gestopt plan');
});

/* ---------------------------------------------------------------- de winkel */

test('16. de winkel: de prijs komt van de server, de voorraad is eindig, en dit is geen gift', async () => {
  /* Grendel 1, 2 en 4 uit kern/rtfos/winkel.js. De giftstand staat inmiddels
     open (toets 8), dus de stichting heeft een positie om aan af te rekenen --
     dezelfde walletcode als een gift, want twee codes naast elkaar zou
     betekenen dat de opbrengst van een boek ergens anders binnenkomt. */
  const nietTeKoop = await api('/api/rtfos/winkel/koop', { artikelId: 'bestaat-niet' }, K.token);
  assert.equal(nietTeKoop.status, 404);

  const eerste = await api('/api/rtfos/winkel/koop', { artikelId: ARTIKEL, aantal: 1,
    euro: 0.01, idem: 'toets-koop-1' }, K.token);
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body).slice(0, 200));
  assert.equal(eerste.body.bestelling.euro, 12.5, 'het meegestuurde bedrag werd de prijs');
  assert.match(eerste.body.meegestuurd, /genegeerd/,
    'een meegestuurd bedrag werd stil genegeerd in plaats van gemeld');
  assert.equal(eerste.body.bestelling.stand, 'klaar',
    'de winkel vinkte zelf af dat er iets verstuurd of opgehaald is');
  assert.ok(eerste.body.zegt.some(z => /geen giftbewijs/.test(z)),
    'de koper leest niet dat een aankoop geen aftrekbare gift is');

  /* De voorraad is eindig, en dat blijkt uit de weigering zelf: er stonden er
     twee, er is er een verkocht. */
  const teveel = await api('/api/rtfos/winkel/koop', { artikelId: ARTIKEL, aantal: 2,
    idem: 'toets-koop-2' }, K.token);
  assert.equal(teveel.status, 409);
  assert.match(teveel.body.error, /nog 1/);

  const laatste = await api('/api/rtfos/winkel/koop', { artikelId: ARTIKEL, aantal: 1,
    idem: 'toets-koop-3' }, K.token);
  assert.equal(laatste.status, 200, JSON.stringify(laatste.body).slice(0, 200));

  const op = await api('/api/rtfos/winkel/koop', { artikelId: ARTIKEL, aantal: 1,
    idem: 'toets-koop-4' }, K.token);
  assert.equal(op.status, 409, 'de winkel verkocht door terwijl de voorraad op was');
  assert.match(op.body.error, /uitverkocht/);
});

test('17. winkel/mijn toont alleen je eigen bestellingen', async () => {
  const mijn = await api('/api/rtfos/winkel/mijn', {}, K.token);
  assert.equal(mijn.status, 200, JSON.stringify(mijn.body).slice(0, 160));
  assert.equal(mijn.body.bestellingen.length, 2, 'niet elke gelukte aankoop staat er');
  assert.ok(mijn.body.bestellingen.every(o => o.artikel === 'Katoenen tas' && o.euro === 12.5));
  assert.ok(mijn.body.bestellingen.every(o => o.koper === undefined && o.codenaam === undefined),
    'de codenaam van de koper stond in zijn eigen overzicht');

  const ander = await api('/api/rtfos/winkel/mijn', {}, G.token);
  assert.equal(ander.status, 200);
  assert.deepEqual(ander.body.bestellingen, [], 'een ander lid zag deze bestellingen');
});

/* ------------------------------------------------------------------- de ANBI */

test('18. met een ANBI-beschikking heet het stuk een giftbewijs -- behalve waar er iets tegenover staat', async () => {
  /* DE LAATSTE TOETS, want hij verandert de ANBI-stand voor alles wat erna zou
     komen. Twee dingen tegelijk: onbekend of aangevraagd is nooit stilzwijgend
     aftrekbaar (toets 9), en een giftbewijs WEIGERT waar het geen gift is --
     ook nu de stichting er een IS. */
  const zet = await api('/api/rtfos/gift/stand/zet', { anbi: 'ja', rsin: '123456789' }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.equal(zet.body.anbi, 'ja');

  const gift = await api('/api/rtfos/gift/voorbereid', { euro: 25 }, G.token);
  assert.equal(gift.status, 200, JSON.stringify(gift.body).slice(0, 160));
  assert.equal(gift.body.voornemen.stuk, 'giftbewijs');
  assert.equal(gift.body.voornemen.aftrekbaar, true);
  assert.ok(gift.body.zegt.some(z => /RSIN 123456789/.test(z)),
    'het giftbewijs noemt het RSIN niet waaronder de stichting bekend staat');

  const spons = await api('/api/rtfos/gift/voorbereid', { euro: 25, tegenprestatie: true }, G.token);
  assert.equal(spons.status, 200);
  assert.equal(spons.body.voornemen.stuk, 'factuur',
    'een ANBI-status maakte van sponsoring alsnog een giftbewijs');
  assert.equal(spons.body.voornemen.aftrekbaar, false);
});
