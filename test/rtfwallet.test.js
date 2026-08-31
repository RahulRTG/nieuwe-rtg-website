/* ============================================================================
   DE POSITIE VAN DE RTFOUNDATION -- waar een gift landt (kern/rtfwallet.js).

   Deze toets bestaat omdat er een gat zat tussen twee dingen die allebei klopten:
   de giftstand kan niet open zonder walletcode (terecht -- een knop zonder
   ontvanger stuurt geld nergens heen), en een leverancier ontstaat alleen uit
   een partneraanvraag met ledenbewijs en toelatingsdossier (ook terecht -- je
   wilt niet dat iemand zich via het partnerformulier tot stichting uitroept).
   Samen betekende dat: de eigenaar kon een code INTIKKEN, maar er stond niets
   achter.

   Vier dingen die hier moeten houden, en alle vier zijn ze tegen een tijdelijk
   kapotgemaakte kern gezien zakken (LAT.md regel 2):

   1. ER IS ER PRECIES EEN. Twee posities zijn twee plekken waar giften landen.
   2. HIJ STAAT IN DE WERELD VAN DE STICHTING en niet in de commerciele.
   3. HIJ GAAT NOOIT ONLINE -- dit is geen zaak in de etalage.
   4. AANMAKEN OPENT DE GIFTSTAND NIET. De positie is een feit, de stand een
      besluit.

   Draai los: node --test test/rtfwallet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, board;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer(); base = srv.base;
  board = await kantoorAlsPersoon(base);
  assert.ok(board, 'geen boardroom-sessie; zonder eigenaar valt hier niets te toetsen');
});
test.after(() => stop(srv));

test('de stichting krijgt een positie, en er is er precies een', async () => {
  const voor = await api('/api/office/rtfwallet', {}, board);
  assert.equal(voor.status, 200);
  assert.equal(voor.body.bestaat, false);
  assert.match(voor.body.uitleg, /kan de giftstand niet open/,
    'de lege stand zegt niet waarom het uitmaakt');

  /* ZONDER BEHEERDER GAAT HET NIET: een positie zonder mens is een pot geld
     waar niemand bij kan. */
  const zonder = await api('/api/office/rtfwallet/maak', {}, board);
  assert.equal(zonder.status, 400);

  const r = await api('/api/office/rtfwallet/maak',
    { naam: 'RTFoundation', beheerder: 'Nadia Bestuur', plaats: 'Haarlem' }, board);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.code, 'geen bedrijfscode');
  assert.ok(r.body.pin, 'geen beheer-PIN -- dan kan niemand uitbetalen');
  assert.equal(r.body.wereldFout, null, 'de economische wereld is niet gezet: ' + r.body.wereldFout);
  assert.equal(r.body.giftFout, null, 'de ontvanger van de giftstand is niet ingevuld: ' + r.body.giftFout);

  /* GRENDEL 2 -- en dit is de stilste van de vier. Een leverancier is in
     kern/economie/werelden.js een `zaak:` en dus `commercieel`, een wereld die
     WEL factureert. Zonder de regel in kern/economie/identiteit.js was de
     stichting een commerciele klant van RTG geweest en had de firewall daar
     niets van gezegd. */
  assert.equal(r.body.wallet.wereld, 'rtfoundation',
    'de stichting staat in de verkeerde economische wereld');

  // GRENDEL 3: niet in de etalage
  assert.equal(r.body.wallet.online, false, 'de stichting stond online tussen de zaken');

  // GRENDEL 1: geen tweede
  const nog = await api('/api/office/rtfwallet/maak',
    { naam: 'RTFoundation Twee', beheerder: 'Iemand Anders' }, board);
  assert.equal(nog.status, 409, 'er kon een tweede positie naast');
  assert.match(nog.body.error, /precies een/);
  assert.equal(nog.body.wallet.code, r.body.code, 'de weigering wees niet naar de bestaande');

  /* GRENDEL 4: de ontvanger is ingevuld, de schakelaar staat nog dicht. */
  const g = await api('/api/rtfos/gift/stand/kantoor', {}, board);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.ontvanger && g.body.ontvanger.code, r.body.code,
    'de giftstand wijst niet naar de nieuwe positie');
  assert.equal(g.body.stand, 'dicht',
    'het aanmaken van de positie zette de giftknop open -- dat is een besluit van een mens');

  const na = await api('/api/office/rtfwallet', {}, board);
  assert.equal(na.body.bestaat, true);
  assert.equal(na.body.wallet.rekening, false,
    'er stond meteen een bankrekening; die zet de stichting zelf in de partner-app');
});

/* Het genre is 'huis' en niet 'intern', en dat verschil is precies grendel 1.
   Stond hij op 'intern', dan zette kern/instelling.js hem in zijn lijst van
   aan te sluiten instellingen en kon iemand er langs die weg een tweede naast
   maken. En hij gaat ook met een uitnodiging in de hand niet open. */
test('de stichting is niet aan te vragen en niet aan te sluiten', async () => {
  const genres = require('../server/seed/genres');
  assert.equal(genres.genreToegang('rtfoundation').ok, false);
  assert.equal(genres.genreToegang('rtfoundation', { viaUitnodiging: true }).ok, false,
    'een uitnodiging tilde het huis-genre op');

  const lijst = await api('/api/office/instelling/genres', {}, board);
  assert.equal(lijst.status, 200);
  assert.ok(!(lijst.body.genres || []).some(x => x.id === 'rtfoundation'),
    'de stichting stond in de lijst van aan te sluiten instellingen -- dan is er een tweede weg');
});
