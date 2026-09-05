/* De kantoordeur, tweede helft.

   De RTG-kant van de ontwerptak is er net zo aan toe als de RTF-kant was: alles
   wat MAAKT en LEEST staat in de tests, alles wat WIJZIGT en WEGGOOIT niet.
   Daar komt de bedienlaag van de backoffice bij -- de concierge-inbox, het
   seintje, de briefing, de live stroom en de documentdownload -- plus een paar
   losse deuren die nergens anders langskomen.

   Twee dingen zijn hier eigen aan het kantoor en krijgen daarom eigen asserties:

   1. TWEE VAN DEZE ROUTES NEMEN HUN TOKEN UIT DE URL, niet uit de header:
      /api/office/stream (een SSE-stroom) en /api/office/doc (een download).
      Een browser kan bij die twee geen Authorization-header meesturen, dus
      staat het token in de query. Het is WEL hetzelfde token: een echte
      kantoorsessie of het eigenaarsaccount. Een ledentoken hoort er dus net zo
      hard op af te ketsen als geen token, en dat toetsen we hier expliciet --
      juist omdat een token in een URL makkelijker weglekt (logs, Referer) en
      de deur daarachter dus streng moet zijn.
   2. /api/office/doc levert een identiteitsbewijs uit. Padtraversal hoort daar
      dood te lopen op de basename-filter, niet op geluk.

   Draai los:
   node --test test/office-tweede-helft.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

/* De inlog zet de code eerst op HOOFDLETTERS voor hij hem vergelijkt, dus een
   proefcode met kleine letters erin komt er nooit door. */
const CODE = 'PROEFKANTOOR-' + Date.now().toString(36).toUpperCase();
let srv, base;
function post(pad, body, token) {
  return fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function haal(pad) { return fetch(base + pad).then(async r => ({ status: r.status, tekst: await r.text().catch(() => '') })); }

let kantoor, lid, lidId, eigenaar;
const ko = (pad, body) => post(pad.startsWith('/api/') ? pad : '/api/office/' + pad, body, kantoor);
const br = (pad, body) => post('/api/office/' + pad, body, eigenaar);

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-off2-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;

  const k = await post('/api/office/login', { code: CODE });
  assert.equal(k.status, 200, 'de kantoorcode werkt: ' + JSON.stringify(k.body).slice(0, 120));
  kantoor = k.body.token;

  const t = Date.now().toString().slice(-7);
  const m = await post('/api/auth/register', { name: 'Kantoor Buitenstaander', email: 'off2' + t + '@rtg.test',
    phone: '+31612340002', password: 'Wachtwoord123', geboortedatum: '1990-05-20' });
  assert.equal(m.status, 200);
  lid = m.body.token;
  lidId = m.body.state.user.id;

  const e = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  assert.equal(e.status, 200);
  eigenaar = e.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de vier ontwerpbureaus van RTG: wijzigen en weggooien', async () => {
  for (const bureau of ['atelier', 'studio', 'hardware', 'architect']) {
    const mk = await ko(bureau + '/maak', { naam: 'Proef ' + bureau, brief: 'Een verkenning om weer weg te gooien.' });
    assert.equal(mk.status, 200, bureau + '/maak: ' + JSON.stringify(mk.body).slice(0, 140));
    const id = mk.body.ontwerp.id;

    const voor = (await ko(bureau, {})).body.ontwerpen.length;
    const weg = await ko(bureau + '/verwijder', { id });
    assert.equal(weg.status, 200);
    const na = (await ko(bureau, {})).body.ontwerpen;
    assert.equal(na.length, voor - 1, bureau + ' telt er een minder');
    assert.ok(!na.some(o => o.id === id), 'en juist die ene is weg');

    // nog een keer weggooien is stil: er valt niets te verklappen over wat er ooit stond
    assert.equal((await ko(bureau + '/verwijder', { id })).status, 200);
    assert.equal((await ko(bureau, {})).body.ontwerpen.length, voor - 1, 'en er verdwijnt niets extra');
  }
});

test('2. de redactie en de ideeenkamer van RTG', async () => {
  const art = await ko('redactie/artikel/maak', { kop: 'Proefstuk dat weer weg mag',
    rubriek: 'nieuws', tekst: 'Een kort bericht om zo weer in te trekken.' });
  assert.equal(art.status, 200);
  const aid = art.body.artikel.id;
  assert.ok((await ko('redactie', {})).body.artikelen.some(a => a.id === aid));
  assert.equal((await ko('redactie/artikel/verwijder', { id: aid })).status, 200);
  assert.ok(!(await ko('redactie', {})).body.artikelen.some(a => a.id === aid), 'het stuk is van de schrijftafel');

  const idee = await ko('ideeen/maak', { titel: 'Een lamp die met het seizoen meedraait',
    brief: 'Licht dat de kleur van het jaargetijde aanneemt.', bureaus: ['atelier'] });
  assert.equal(idee.status, 200);
  const iid = idee.body.idee.id;

  const zet = await ko('ideeen/zet', { id: iid, titel: 'Een lamp die met de seizoenen meedraait', status: 'in-werk' });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.idee.titel, 'Een lamp die met de seizoenen meedraait');
  assert.equal((await ko('ideeen/zet', { id: 'bestaatniet', titel: 'x' })).status, 404);

  assert.equal((await ko('ideeen/verwijder', { id: iid })).status, 200);
  assert.ok(!(await ko('ideeen', {})).body.ideeen.some(i => i.id === iid), 'het idee is uit de kamer');
});

test('3. de Werkplaats: een opdracht bijstellen, kritiek vragen en intrekken', async () => {
  const mk = await ko('werkplaats/maak', { soort: 'nieuw', naam: 'Proefopdracht',
    brief: 'Een app die reisbonnen vanzelf ordent.' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 140));
  const id = mk.body.item.id;

  const zet = await ko('werkplaats/zet', { id, naam: 'Proefopdracht, bijgesteld', status: 'in-bouw' });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.item.naam, 'Proefopdracht, bijgesteld');
  assert.equal(zet.body.item.status, 'in-bouw');
  // een status die de Werkplaats niet kent wordt genegeerd, niet overgenomen
  const raar = await ko('werkplaats/zet', { id, status: 'af-en-toe' });
  assert.equal(raar.body.item.status, 'in-bouw', 'de onbekende status is niet blijven plakken');
  assert.equal((await ko('werkplaats/zet', { id: 'wpbestaatniet', naam: 'x' })).status, 404);

  /* Kritiek vraag je op een PLAN, niet op een losse regel tekst: zolang de
     opdracht nog niet is uitgewerkt heeft de chef niets om over te oordelen,
     en zegt hij dat ook. */
  const teVroeg = await ko('werkplaats/kritiek', { id });
  assert.equal(teVroeg.status, 400);
  assert.match(teVroeg.body.error, /eerst uit/i, 'en hij legt uit wat er eerst moet gebeuren');

  assert.equal((await ko('werkplaats/uitwerken', { id })).status, 200, 'de AI werkt het idee uit');
  const kritiek = await ko('werkplaats/kritiek', { id });
  assert.equal(kritiek.status, 200, 'nu leest de chef kritisch mee (zonder sleutel uit het sjabloon)');
  assert.ok(kritiek.body.item.kritiek, 'en er staat echt kritiek bij de opdracht');
  assert.equal((await ko('werkplaats/kritiek', { id: 'wpbestaatniet' })).status, 404);

  const voor = (await ko('werkplaats', {})).body.items.length;
  assert.equal((await ko('werkplaats/verwijder', { id })).status, 200);
  assert.equal((await ko('werkplaats', {})).body.items.length, voor - 1);
});

test('4. de Website-studio bewaart sjablonen -- en houdt de huisstijl vast', async () => {
  const voor = (await ko('atelierweb/lijst', {})).body.lijst.length;

  const bewaar = await ko('atelierweb/bewaar', { design: { titel: 'Proefsjabloon', thema: 'donker',
    blokken: [{ type: 'kop', tekst: 'Een rustige opening' }] } });
  assert.equal(bewaar.status, 200);
  const id = bewaar.body.design.id;
  assert.equal(bewaar.body.design.accent, '#7F1634', 'zonder opgave staat het accent op het bordeaux van het logo');

  // een accent dat geen hex is, is geen accent: dan valt hij terug op de huisstijl
  const raar = await ko('atelierweb/bewaar', { design: { titel: 'Raar accent', accent: 'knalroze' } });
  assert.equal(raar.body.design.accent, '#7F1634', 'een verzonnen kleurnaam haalt het niet');
  const goed = await ko('atelierweb/bewaar', { design: { titel: 'Eigen accent', accent: '#857007' } });
  assert.equal(goed.body.design.accent, '#857007', 'een echte hex mag wel');

  const lijst = await ko('atelierweb/lijst', {});
  assert.equal(lijst.body.lijst.length, voor + 3, 'er staan drie sjablonen bij');

  const op = await ko('atelierweb/haal', { id });
  assert.equal(op.status, 200);
  assert.equal(op.body.design.titel, 'Proefsjabloon');
  assert.equal(op.body.design.blokken.length, 1);
  assert.equal((await ko('atelierweb/haal', { id: 'bestaatniet' })).status, 404);

  // bewaren onder hetzelfde id vervangt, het wordt geen tweede sjabloon
  const weer = await ko('atelierweb/bewaar', { design: { id, titel: 'Proefsjabloon v2' } });
  assert.equal(weer.body.design.id, id);
  assert.equal((await ko('atelierweb/lijst', {})).body.lijst.length, voor + 3, 'nog steeds drie erbij');
  assert.equal((await ko('atelierweb/haal', { id })).body.design.titel, 'Proefsjabloon v2');

  for (const d of [id, raar.body.design.id, goed.body.design.id]) {
    assert.equal((await ko('atelierweb/verwijder', { id: d })).status, 200);
  }
  assert.equal((await ko('atelierweb/lijst', {})).body.lijst.length, voor, 'de studio is weer opgeruimd');
});

test('5. de kantoordrive van RTG: versies, ster, formulier en weggooien', async () => {
  const mk = await ko('kantoorpakket/maak', { soort: 'tekst', titel: 'Kantoornotitie' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 140));
  const id = mk.body.id;

  assert.equal((await ko('kantoorpakket/bewaar', { id, inhoud: { tekst: 'Eerste versie.' } })).status, 200);
  assert.equal((await ko('kantoorpakket/bewaar', { id, inhoud: { tekst: 'Tweede versie.' } })).status, 200);

  const versies = await ko('kantoorpakket/versies', { id });
  assert.equal(versies.status, 200);
  assert.ok(versies.body.versies.length >= 1);
  const terug = await ko('kantoorpakket/terug', { id, nr: 0 });
  assert.equal(terug.status, 200);
  assert.equal(terug.body.inhoud.tekst, 'Eerste versie.', 'de vorige stand staat er weer');

  assert.equal((await ko('kantoorpakket/ster', { id, aan: true })).body.ster, true);
  assert.equal((await ko('kantoorpakket/ster', { id, aan: false })).body.ster, false);

  const ai = await ko('kantoorpakket/ai', { id, opdracht: 'actiepunten' });
  assert.equal(ai.status, 200);
  assert.ok(ai.body.voorstel, 'de AI stelt voor; invoegen doet een mens');
  assert.equal((await ko('kantoorpakket/ai', { id, opdracht: 'toveren' })).status, 400,
    'een opdracht die RTG Office niet kent wordt geweigerd');

  // delen kan alleen met een bestaande codenaam
  const deel = await ko('kantoorpakket/deel', { id, codenaam: 'Bestaat Niet 0000', aan: true });
  assert.equal(deel.status, 404);

  // een formulier: invullen en de uitslag
  const f = await ko('kantoorpakket/maak', { soort: 'formulier', titel: 'Kantoorpeiling' });
  const fid = f.body.id;
  assert.equal((await ko('kantoorpakket/vul', { id: fid, antwoorden: ['Meer lucht in de agenda.'] })).body.aantal, 1);
  const uitslag = await ko('kantoorpakket/uitslag', { id: fid });
  assert.equal(uitslag.status, 200);
  assert.equal((await ko('kantoorpakket/uitslag', { id })).status, 400, 'een notitie is geen formulier');

  assert.equal((await ko('kantoorpakket/weg', { id })).status, 200);
  assert.equal((await ko('kantoorpakket/weg', { id: fid })).status, 200);
  assert.equal((await ko('kantoorpakket/versies', { id })).status, 404, 'weg is weg');
});

test('6. de concierge-inbox: lezen, antwoorden en een seintje', async () => {
  const inbox = await ko('conversations', { lang: 'nl' });
  assert.equal(inbox.status, 200);
  assert.ok(Array.isArray(inbox.body.conversations), 'de inbox is een lijst, ook als hij leeg is');

  // antwoorden vraagt een bestaand account en echte tekst
  assert.equal((await ko('/api/office/reply', { userId: 999999999, text: 'Hallo' })).status, 404);
  assert.equal((await ko('/api/office/reply', { userId: lidId, text: '   ' })).status, 400, 'een leeg bericht gaat niet de deur uit');
  const antwoord = await ko('/api/office/reply', { userId: lidId, text: 'Wij kijken er vandaag nog naar.' });
  assert.equal(antwoord.status, 200, 'de concierge kan wel echt antwoorden');

  const briefing = await ko('/api/office/briefing', {});
  assert.equal(briefing.status, 200);

  // het seintje wijst altijd naar een bestaande bestelling of rit
  const nudge = await ko('/api/office/nudge', { kind: 'order', ref: 'BESTAAT-NIET' });
  assert.equal(nudge.status, 404, 'een seintje zonder doel gaat nergens heen');

  // en de hele bedienlaag zit achter de kantoordeur
  for (const pad of ['conversations', 'reply', 'briefing', 'nudge']) {
    assert.equal((await post('/api/office/' + pad, {}, lid)).status, 401, pad + ' is niet van een lid');
    assert.equal((await post('/api/office/' + pad, {})).status, 401, pad + ' is niet van een onbekende');
  }
});

test('7. de twee routes met hun token in de URL zijn even streng als de rest', async () => {
  // de live stroom: alleen met een echt kantoortoken
  assert.equal((await haal('/api/office/stream')).status, 401, 'geen token, geen stroom');
  assert.equal((await haal('/api/office/stream?token=verzonnen')).status, 401);
  assert.equal((await haal('/api/office/stream?token=' + encodeURIComponent(lid))).status, 401,
    'een LEDENtoken opent de kantoorstroom niet -- ook al staat het in de URL');

  // de documentdownload: zelfde deur, plus een padtraversal die doodloopt
  assert.equal((await haal('/api/office/doc?file=paspoort.jpg')).status, 401, 'eerst de deur, dan pas het bestand');
  assert.equal((await haal('/api/office/doc?file=x&token=' + encodeURIComponent(lid))).status, 401);
  const traversal = await haal('/api/office/doc?token=' + encodeURIComponent(kantoor) +
    '&file=' + encodeURIComponent('../../server/data/secret.key'));
  assert.equal(traversal.status, 404, 'een pad omhoog wordt een basename, en die bestaat niet');
  assert.ok(!/BEGIN|-----/.test(traversal.tekst), 'en er komt zeker geen sleutel terug');
  assert.equal((await haal('/api/office/doc?token=' + encodeURIComponent(kantoor))).status, 404,
    'zonder bestandsnaam valt er niets te downloaden');

  // met een geldig kantoortoken gaat de stroom wel open (en meteen weer dicht)
  const ctrl = new AbortController();
  const r = await fetch(base + '/api/office/stream?token=' + encodeURIComponent(kantoor), { signal: ctrl.signal });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/event-stream/);
  ctrl.abort();
});

test('8. de losse deuren: naleving, reisbureau, opvang, kampen en de lastafworp', async () => {
  const naleving = await ko('salon-naleving', {});
  assert.equal(naleving.status, 200);

  const reis = await ko('reisbureau', {});
  assert.equal(reis.status, 200);

  const opvang = await ko('opvang/locaties', {});
  assert.equal(opvang.status, 200);

  const kampen = await ko('sport/kampen', {});
  assert.equal(kampen.status, 200, 'het kantoor ziet de kampen van alle clubs');

  // de lastafworp van de techniekkamer hangt aan de boardroom, niet aan het kantoor
  const werp = await ko('techniek/lastafworp', {});
  assert.equal(werp.status, 403, 'de kantoorcode heeft geen identiteit en komt de boardroom niet in');
  const baas = await post('/api/office/techniek/lastafworp', {}, eigenaar);
  assert.notEqual(baas.status, 403, 'de eigenaar komt er wel bij: ' + baas.status);

  // en ook deze vijf zijn niet van een lid
  for (const pad of ['salon-naleving', 'reisbureau', 'opvang/locaties', 'sport/kampen', 'techniek/lastafworp']) {
    assert.equal((await post('/api/office/' + pad, {}, lid)).status, 401, pad + ' is niet van een lid');
  }
});

test('9. de boardroom deelt zijn eigen sleutels uit', async () => {
  // de lijst zelf zit achter de boardroom-deur, niet achter de kantoordeur
  const metCode = await ko('boardroom/toegang', {});
  assert.equal(metCode.status, 403, 'een anonieme kantoorcode heeft geen identiteit en komt de boardroom niet in');

  const metBaas = await post('/api/office/boardroom/toegang', {}, eigenaar);
  assert.equal(metBaas.status, 200);
  assert.equal(metBaas.body.baas, true);
  assert.ok(Array.isArray(metBaas.body.lijst), 'de eigenaar ziet wie er sleutels heeft');
  /* DEZE LUS DRAAIDE NOOIT. De lijst is in deze toets altijd leeg, dus de
     privacy-controle eronder werd nul keer uitgevoerd en slaagde altijd. Eerst
     dus echt een sleutel uitgeven, en pas dan kijken wat erin staat -- anders
     is dit een bewering over een lege verzameling. */
  const u = Date.now().toString(36);
  const reg = await post('/api/auth/register', { name: 'Sleutelhouder', email: 'sh' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const cn = (await post('/api/state', {}, reg.body.token)).body.state.user.codename;
  assert.equal((await post('/api/office/boardroom/toegang/geef', { codenaam: cn }, eigenaar)).status, 200,
    'de eigenaar geeft een sleutel uit');

  const naGeven = await post('/api/office/boardroom/toegang', {}, eigenaar);
  assert.ok(naGeven.body.lijst.length >= 1, 'er staat nu echt iemand op de lijst');
  // privacy by design: de lijst draait op codenamen, de echte naam blijft in de kluis
  for (const t of naGeven.body.lijst) {
    assert.deepEqual(Object.keys(t).sort(), ['codenaam', 'sinds'],
      'er staat niets anders in dan een codenaam en een datum');
  }
  assert.doesNotMatch(JSON.stringify(naGeven.body.lijst), /Sleutelhouder/,
    'en de echte naam staat er niet bij -- die blijft in de kluis');

  assert.equal((await post('/api/office/boardroom/toegang', {}, lid)).status, 401,
    'een lid komt niet eens door de kantoordeur');
});

test('10. een partneraanvraag beslissen: de Boardroom beslist, en een pas is de voorwaarde', async () => {
  // de uitgiftelijst van het kantoor (contracten) hoort er gewoon te staan
  const uit = await ko('uitgifte', {});
  assert.equal(uit.status, 200);

  /* De aanvraagpoort leest het ledenbewijs met resolveSession(): die kent zowel
     een demosessie als een ECHT ledenaccount. Dat laatste is de weg die een
     klant in de praktijk loopt, en die weg toetsen we hier van begin tot eind:
     de gratis gast komt er niet in, een gewone RTG Pass wel, en een account dat
     later naar Business gaat blijft die weg gewoon lopen.

     DE EIS IS EEN PAS, NIET DE BUSINESS PASS. Hier stond het omgekeerde: alleen
     Business mocht aanvragen. Een pas is een lidmaatschapsniveau en geen
     vergunning om te ondernemen; wie met een RTG Pass een zaak runt, is niet
     minder ondernemer. Wat blijft staan is dat er een LID achter de aanvraag
     hoort, want er gaat een bedrijfscode en een beheer-inlog de deur uit. */
  const t = Date.now().toString().slice(-7);
  const gast = await post('/api/auth/register', { name: 'Gratis Gast', email: 'gg' + t + '@rtg.test',
    password: 'Wachtwoord123', geboortedatum: '1988-03-11', tier: 'guest' });
  assert.equal(gast.status, 200);
  const zonderPas = await post('/api/partner/apply', { company: 'Zonder Pas BV', type: 'restaurant',
    city: 'Rotterdam', contactName: 'A. Vragende', email: 'zp' + t + '@rtg.test', akkoord: true }, gast.body.token);
  assert.equal(zonderPas.status, 403, 'zonder pas komt de aanvraag er niet in');
  assert.doesNotMatch(zonderPas.body.error, /alleen (een|de) Business Pass/i);

  const gewoon = await post('/api/auth/register', { name: 'Partner Aanvrager', email: 'pa' + t + '@rtg.test',
    phone: '+31612340003', password: 'Wachtwoord123', geboortedatum: '1988-03-11' });
  assert.equal(gewoon.status, 200);
  assert.equal(gewoon.body.state.user.tier, 'rtg', 'zelf aanmelden levert een RTG Pass');
  /* EEN CONSUMENTENPAS IS GEEN BEDRIJF. Hier stond dat een gewone RTG Pass een
     partnerplek mocht aanvragen; dat was het antwoord van 18 augustus 2026 op
     een poort die toen DE Business Pass eiste -- vanaf 5.000 euro, en daarmee
     dicht voor het restaurant met acht man uit MARKT.md. Twee dagen later kwam
     de trede die daar wel voor is: COMMERCIE.md 3b maakt RTG Business Lite
     (150 euro) de partnerpoort. De poort vraagt sindsdien de capability
     `can_be_partner` en geen pas-id, zodat een volgende trede zichzelf niet
     opnieuw buitensluit. */
  const metRtg = await post('/api/partner/apply', { company: 'Gewone Pas BV', type: 'restaurant',
    city: 'Rotterdam', contactName: 'A. Vragende', email: 'gp' + t + '@rtg.test', akkoord: true }, gewoon.body.token);
  assert.equal(metRtg.status, 403, 'een RTG Pass is persoonlijk en draagt geen partnerplek: '
    + JSON.stringify(metRtg.body).slice(0, 160));
  assert.match(String(metRtg.body.error || ''), /zakelijke pas/,
    'en de weigering noemt de pas die het wel doet -- anders is 403 een doodlopende weg');

  // en een menselijk besluit naar Business verandert daar niets aan
  await elevateTier(base, gewoon.body.token, 'business', kantoor);
  const zakelijk = await post('/api/auth/login', { login: 'pa' + t + '@rtg.test',
    password: 'Wachtwoord123', pasApp: 'business' });
  assert.equal(zakelijk.status, 200);
  assert.equal(zakelijk.body.state.user.tier, 'business');

  // ook met een pas blijven de gewone eisen staan
  assert.equal((await post('/api/partner/apply', { company: 'Geen Akkoord BV', type: 'restaurant',
    city: 'Rotterdam', contactName: 'A. Vragende', email: 'ga' + t + '@rtg.test' }, zakelijk.body.token)).status, 400,
    'zonder uitdrukkelijk akkoord met de partnervoorwaarden geen aanvraag');
  assert.equal((await post('/api/partner/apply', { company: 'Raar Genre BV', type: 'ruimtevaart',
    city: 'Rotterdam', contactName: 'A. Vragende', email: 'rg' + t + '@rtg.test', akkoord: true }, zakelijk.body.token)).status, 400,
    'een verzonnen bedrijfstype ook niet');

  const aanvraag = await post('/api/partner/apply', { company: 'Proefpartner BV', type: 'restaurant',
    city: 'Rotterdam', contactName: 'A. Vragende', email: 'pp' + t + '@rtg.test', akkoord: true,
    bevoegd: true, waarheidsgetrouw: true, kvkNummer: '68750110', vestigingsnummer: '000037178598',
    bewijzen: { nvwa: 'NVWA-ROTTERDAM-' + t } }, zakelijk.body.token);
  assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 160));

  const stand = await ko('state', {});
  assert.equal(stand.status, 200);
  const mijn = (stand.body.state.partnerApplications || []).find(a => a.company === 'Proefpartner BV');
  assert.ok(mijn, 'de aanvraag staat in de backoffice');
  assert.equal(mijn.status, 'nieuw');

  // Financiën en kantoor mogen de status zien, maar de Boardroom neemt het besluit.
  assert.equal((await ko('partner/decide', { id: mijn.id, action: 'goedkeuren' })).status, 403);
  assert.equal((await br('partner/decide', { id: 'bestaatniet', action: 'goedkeuren' })).status, 404);

  assert.equal((await br('partner/decide', { id: mijn.id, action: 'goedkeuren' })).status, 409,
    'ook de Boardroom kan geen open register- of vergunningcontrole overslaan');
  for (const eis of mijn.toelating.eisen) {
    const uitkomst = eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd';
    const check = await br('partner/controle', { id: mijn.id, onderdeel: eis.id, uitkomst,
      referentie: uitkomst === 'niet_van_toepassing' ? 'Geen extra lokale vergunning nodig' : 'Officieel register ' + eis.id });
    assert.equal(check.status, 200, eis.id + ': ' + JSON.stringify(check.body).slice(0, 140));
  }
  const goed = await br('partner/decide', { id: mijn.id, action: 'goedkeuren' });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));

  // twee keer beslissen kan niet: een behandelde aanvraag is klaar
  const nogmaals = await br('partner/decide', { id: mijn.id, action: 'afwijzen' });
  assert.equal(nogmaals.status, 409);
  assert.match(nogmaals.body.error, /al behandeld/i);

  // en een lid beslist hier niets
  assert.equal((await post('/api/office/partner/decide', { id: mijn.id, action: 'goedkeuren' }, lid)).status, 401);
});

/* Deze test toetste eerst de demoweg (/api/login), want de echte weg WERKTE
   NIET: /api/partner/apply las het ledenbewijs met sessionFor(), en die kent
   alleen de demosessies. Een echte pashouder kwam er dus nooit door.
   Dat is nu gerepareerd (resolveSession, zie routes/member/partnerkanaal.js) en
   de test loopt de echte weg. Blijft deze test groen, dan blijft die weg open. */
