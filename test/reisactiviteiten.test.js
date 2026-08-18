/* ACTIVITEITEN IN DE REIS, EN DE SLUITDAG -- REIZEN.md fase 4, eerste helft.

   Twee gaten die hier dicht moeten, en waarom ze gaten waren:

   1. EEN GEKOCHTE EXCURSIE HOORDE NIET BIJ DE REIS. Tickets stonden in de
      Mall-bestellingen en de reisagenda, maar niet in de reiswereld -- dus een
      snorkeltocht in Ibiza stond LOS van de reis naar Ibiza, terwijl De Reis
      juist bestaat om dat verband te leggen. Nu is 'activiteiten' een bron als
      elk ander: met de stad van de zaak als bestemming (dezelfde reparatie als
      bij de verblijven), de tijd van het slot, herkomst partner, en een eigen
      wachttekst -- op een betaald ticket wacht DE ZAAK, geen reisadviseur.
   2. EEN ONDERNEMER KON GEEN DAG SLUITEN. De acceptatie-eis van fase 4: een
      kleine ondernemer sluit op zijn telefoon een dag, en vanaf dat moment is
      er niets meer te boeken -- terwijl bestaande, betaalde gasten NIET stil
      geannuleerd worden (dat zou geld afpakken zonder dat iemand erop drukte).

   EEN AFGESLAGEN MUTATIE, opgeschreven zoals LAT-regel 2 vraagt: het weghalen
   van de statusfilter in de bron (naast paid) liet alles groen, omdat de
   lid-annulering paid al op false zet. De filter blijft staan als verdediging
   tegen een annuleringsweg die paid laat staan; welke toets hem ooit moet
   dekken staat in het commentaar bij de bron zelf.

   Draai los: node --experimental-sqlite --test test/reisactiviteiten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, lid, manager, deur;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisact-'));
const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'ra' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  const roster = (await post('/api/supplier/roster', { code: 'ESVEDRA' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const rest = roster.staff.find(x => x.role !== 'manager');
  manager = (await post('/api/supplier/login', { code: 'ESVEDRA', staffId: man.id, pin: '1234' })).body.token;
  deur = (await post('/api/supplier/login', { code: 'ESVEDRA', staffId: rest.id, pin: '5678' })).body.token;
  assert.ok(lid && manager && deur, 'lid en zaak staan klaar');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een betaald ticket hoort bij de reis naar dezelfde stad', async () => {
  // een verblijf in Ibiza, en een excursie bij Es Vedra Cruises (ook Ibiza)
  const hotels = await post('/api/hotels', {}, lid);
  const huis = hotels.body.huizen.find(h => /ibiza/i.test(h.stad || ''));
  assert.equal((await post('/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id,
    aankomst: dag(10), vertrek: dag(14), personen: 2 }, lid)).status, 200);

  const aanbod = (await post('/api/tickets/aanbod', {}, lid)).body;
  const boot = aanbod.partners.find(p => p.code === 'ESVEDRA');
  const act = boot.activiteiten[0];
  const koop = await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: act.id,
    datum: dag(11), tijd: act.tijden[0], personen: 2 }, lid);
  assert.equal(koop.status, 200);

  /* ONBETAALD hoort het er nog niet in: wacht-op-betaling vervalt na een half
     uur vanzelf en zou anders eeuwig als spook in de reis staan. */
  const voor = await post('/api/reis/reizen', {}, lid);
  const reisVoor = voor.body.reizen.find(r => /ibiza/i.test(r.bestemming));
  assert.ok(!reisVoor.onderdelen.some(o => o.kenmerk === koop.body.ticket.ref),
    'een onbetaald ticket staat nog niet in de reis');

  assert.equal((await post('/api/booking/pay', { ref: koop.body.ticket.ref }, lid)).status, 200);

  const na = await post('/api/reis/reizen', {}, lid);
  const reis = na.body.reizen.find(r => /ibiza/i.test(r.bestemming));
  assert.equal(reis.telling.onderdelen, 2, 'verblijf en excursie zijn samen een reis');
  const ticket = reis.onderdelen.find(o => o.kenmerk === koop.body.ticket.ref);
  assert.ok(ticket, 'het ticket staat in de reis');
  assert.equal(ticket.soort, 'activiteit');
  assert.equal(ticket.herkomst, 'partner');
  assert.equal(ticket.bestemming, 'Ibiza', 'de bestemming komt uit de zaak, niet uit de boeking');
  assert.equal(ticket.tijd, act.tijden[0], 'een excursie heeft een tijd, en die staat erbij');
  assert.equal(ticket.wacht, 'de zaak', 'op een betaald ticket wacht de zaak -- geen reisadviseur');
  global.__ticketRef = koop.body.ticket.ref;
});

test('2. een geannuleerd ticket verdwijnt uit de reis', async () => {
  const ann = await post('/api/annuleer', { soort: 'boeking', ref: global.__ticketRef }, lid);
  assert.equal(ann.status, 200, JSON.stringify(ann.body));
  const na = await post('/api/reis/reizen', {}, lid);
  const reis = na.body.reizen.find(r => /ibiza/i.test(r.bestemming));
  assert.ok(!reis.onderdelen.some(o => o.kenmerk === global.__ticketRef),
    'wat geannuleerd is, hoort niet meer op de tijdlijn');
});

test('3. de manager sluit een dag; kopen weigert met de reden, en het aanbod zegt het vooraf', async () => {
  // personeel zonder managersrol mag dit niet
  assert.equal((await post('/api/supplier/activiteit/sluit', { datum: dag(20) }, deur)).status, 403);

  const sluit = await post('/api/supplier/activiteit/sluit', { datum: dag(20), reden: 'onderhoud aan de boot' }, manager);
  assert.equal(sluit.status, 200);
  assert.equal(sluit.body.bestaandeBoekingen, 0, 'er stond nog niets op die dag');

  const aanbod = (await post('/api/tickets/aanbod', {}, lid)).body;
  const boot = aanbod.partners.find(p => p.code === 'ESVEDRA');
  assert.ok(boot.dicht.some(d => d.datum === dag(20) && d.reden === 'onderhoud aan de boot'),
    'het lid ziet de sluitdag voordat hij het probeert');

  const act = boot.activiteiten[0];
  const koop = await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: act.id,
    datum: dag(20), tijd: act.tijden[0], personen: 1 }, lid);
  assert.equal(koop.status, 409);
  assert.match(koop.body.error, /gesloten/, 'gesloten heet gesloten, niet vol: ' + koop.body.error);
  assert.match(koop.body.error, /onderhoud aan de boot/, 'met de reden van de zaak erbij');

  // een andere dag kan gewoon nog
  assert.equal((await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: act.id,
    datum: dag(21), tijd: act.tijden[0], personen: 1 }, lid)).status, 200);
});

test('4. sluiten raakt bestaande boekingen niet -- het telt ze en zegt dat er werk ligt', async () => {
  const aanbod = (await post('/api/tickets/aanbod', {}, lid)).body;
  const act = aanbod.partners.find(p => p.code === 'ESVEDRA').activiteiten[0];
  const koop = await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: act.id,
    datum: dag(30), tijd: act.tijden[0], personen: 2 }, lid);
  assert.equal((await post('/api/booking/pay', { ref: koop.body.ticket.ref }, lid)).status, 200);

  const sluit = await post('/api/supplier/activiteit/sluit', { datum: dag(30), reden: 'prive-charter' }, manager);
  assert.equal(sluit.status, 200);
  assert.equal(sluit.body.bestaandeBoekingen, 1, 'de bestaande boeking wordt geteld');
  assert.match(sluit.body.opmerking, /blijven staan/i, 'en de zaak leest dat daar werk ligt');

  /* De boeking van het lid staat er nog gewoon -- in zijn reizen en al. Over
     ALLE reizen gezocht: een ticket ver buiten het hotelvenster vormt terecht
     zijn eigen reis naar Ibiza (de groeperingsregel van fase 1). */
  const alle = (await post('/api/reis/reizen', {}, lid)).body.reizen.reduce((a, r) => a.concat(r.onderdelen), []);
  assert.ok(alle.some(o => o.kenmerk === koop.body.ticket.ref),
    'een sluitdag annuleert niemand stil');
});

test('5. heropenen: de dag gaat weer open, en een verzonnen dag heropent niet', async () => {
  assert.equal((await post('/api/supplier/activiteit/open', { datum: dag(20) }, manager)).status, 200);
  const aanbod = (await post('/api/tickets/aanbod', {}, lid)).body;
  const boot = aanbod.partners.find(p => p.code === 'ESVEDRA');
  assert.ok(!boot.dicht.some(d => d.datum === dag(20)), 'de sluitdag is weg uit het aanbod');
  const act = boot.activiteiten[0];
  assert.equal((await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: act.id,
    datum: dag(20), tijd: act.tijden[0], personen: 1 }, lid)).status, 200, 'en kopen kan weer');
  assert.equal((await post('/api/supplier/activiteit/open', { datum: dag(25) }, manager)).status, 404,
    'een dag die niet dicht stond, heropent niet stil');
});

test('6. een sluitdag voor EEN activiteit laat de andere open', async () => {
  const aanbod = (await post('/api/tickets/aanbod', {}, lid)).body;
  const boot = aanbod.partners.find(p => p.code === 'ESVEDRA');
  assert.ok(boot.activiteiten.length >= 2, 'de demozaak heeft minstens twee activiteiten');
  const [a, b] = boot.activiteiten;
  assert.equal((await post('/api/supplier/activiteit/sluit', { datum: dag(40), activiteitId: a.id }, manager)).status, 200);
  assert.equal((await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: a.id,
    datum: dag(40), tijd: a.tijden[0], personen: 1 }, lid)).status, 409, 'de gesloten activiteit is dicht');
  assert.equal((await post('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: b.id,
    datum: dag(40), tijd: b.tijden[0], personen: 1 }, lid)).status, 200, 'de andere gewoon open');
  // en een verzonnen activiteit sluiten kan niet
  assert.equal((await post('/api/supplier/activiteit/sluit', { datum: dag(41), activiteitId: 'bestaat-niet' }, manager)).status, 404);
});
