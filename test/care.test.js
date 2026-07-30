/* Toren 4: RTG Care (zorg & welzijn). Een behandeling boeken bij een
   behandelaar in een tijdslot, het zorgprofiel dat meereist, de aparte en
   veilige intake-deling per aanbieder, en Rahul die het in gewone taal
   regelt. Draai los: node --experimental-sqlite --test test/care.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-care-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'ZENITH' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het overzicht toont de demo-aanbieders met behandelingen en behandelaars', async () => {
  const ov = (await api('care', {}, lid)).body;
  assert.ok(ov.aanbieders.length >= 2, 'een spa en een kliniek zijn geseed');
  const spa = ov.aanbieders.find(a => a.soort === 'spa');
  const kliniek = ov.aanbieders.find(a => a.soort === 'kliniek');
  assert.ok(spa && kliniek);
  assert.ok(spa.behandelingen.some(b => /massage/i.test(b.naam)) && spa.behandelaars.length);
});

test('een behandeling boeken en betalen: referentie, agenda-schaarste per behandelaar', async () => {
  const ov = (await api('care', {}, lid)).body;
  const spa = ov.aanbieders.find(a => a.soort === 'spa');
  const beh = spa.behandelingen.find(b => /massage/i.test(b.naam));
  const tijd = beh.tijden[0];
  const r = await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.boeking.status, 'wacht-op-betaling');
  const betaald = await api('care/betaal', { ref: r.body.boeking.ref }, lid);
  assert.ok(betaald.body.boeking.paid && betaald.body.boeking.status === 'geboekt');
  // hetzelfde slot bij dezelfde behandelaar is nu bezet, ook voor een ander lid
  const bezet = await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd }, lid2);
  assert.equal(bezet.status, 409, 'een behandelaar kan maar een gezelschap per slot hebben');
  // een onzin-tijdslot en een dag in het verleden worden netjes geweigerd
  assert.equal((await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd: '03:03' }, lid)).status, 400);
  assert.equal((await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: '2000-01-01', tijd }, lid)).status, 400);
});

test('het zorgprofiel reist mee naar de behandelaar (met toestemming)', async () => {
  await api('zorgprofiel/zet', { allergenen: 'noten, lavendel', dieet: '', medisch: '', delen: true }, lid2);
  const ov = (await api('care', {}, lid2)).body;
  const spa = ov.aanbieders.find(a => a.soort === 'spa');
  const beh = spa.behandelingen.find(b => /gezicht/i.test(b.naam)) || spa.behandelingen[2];
  const r = await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd: beh.tijden[0] }, lid2);
  assert.equal(r.status, 200);
  assert.ok(r.body.boeking.zorg && r.body.boeking.zorg.allergenen.includes('noten'), 'de spa weet van de notenallergie');
});

test('veilige intake-deling: uitdrukkelijk, per aanbieder, en te stoppen', async () => {
  const ov = (await api('care', {}, lid)).body;
  const kliniek = ov.aanbieders.find(a => a.soort === 'kliniek');
  // zonder gedeelde intake staat er niets extra's in de boeking
  const zonder = await api('care/boek', { aanbiederId: kliniek.id, behandelingId: kliniek.behandelingen[0].id, datum: morgen(), tijd: kliniek.behandelingen[0].tijden[0] }, lid);
  assert.equal(zonder.body.boeking.intake, null);
  // het lid deelt uitdrukkelijk een intake met precies deze kliniek
  const deel = await api('care/intake/deel', { aanbiederId: kliniek.id, medisch: 'Ik gebruik bloedverdunners en ben allergisch voor penicilline.' }, lid);
  assert.equal(deel.status, 200);
  assert.ok(deel.body.intake.vervaltOp, 'de deling heeft een einddatum');
  const met = await api('care', {}, lid);
  assert.ok(met.body.intakes.some(i => i.aanbiederNaam === kliniek.naam), 'de lopende intake staat in het overzicht');
  // een nieuwe boeking draagt de intake nu wel mee
  const boeking = await api('care/boek', { aanbiederId: kliniek.id, behandelingId: kliniek.behandelingen[1].id, datum: morgen(), tijd: kliniek.behandelingen[1].tijden[0] }, lid);
  assert.ok(/penicilline/.test(boeking.body.boeking.intake || ''), 'de behandelaar krijgt de gedeelde context');
  // en het lid trekt het weer in: weg is weg
  const stop = await api('care/intake/stop', { id: deel.body.intake.id }, lid);
  assert.equal(stop.status, 200);
  assert.ok(!(await api('care', {}, lid)).body.intakes.length, 'na stoppen deelt niets meer');
});

test('gasten mogen niet boeken; leden wel', async () => {
  const gast = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) })).json();
  const ov = (await api('care', {}, lid)).body;
  const spa = ov.aanbieders.find(a => a.soort === 'spa');
  const r = await api('care/boek', { aanbiederId: spa.id, behandelingId: spa.behandelingen[0].id, datum: morgen(), tijd: spa.behandelingen[0].tijden[1] }, gast.token);
  assert.equal(r.status, 403);
});

test('de aanbieder-agenda: de behandelaar ziet de dag met zorgcontext en rondt af', async () => {
  // een lid met zorgprofiel boekt en betaalt een aromamassage bij Zenith
  await api('zorgprofiel/zet', { allergenen: 'pinda', dieet: '', medisch: '', delen: true }, lid);
  const ov = (await api('care', {}, lid)).body;
  const spa = ov.aanbieders.find(a => a.soort === 'spa');
  const beh = spa.behandelingen.find(b => /aroma/i.test(b.naam));
  const tijd = beh.tijden[beh.tijden.length - 1]; // laatste slot, zeker vrij
  const boek = await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd }, lid);
  assert.equal(boek.status, 200);
  await api('care/betaal', { ref: boek.body.boeking.ref }, lid);
  // de aanbieder (demo-eigenaar = ZENITH) logt in en ziet zijn dagagenda
  const sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(sup, 'de zorgaanbieder kan inloggen');
  const ag = await api('supplier/care/agenda', { datum: morgen() }, sup);
  assert.equal(ag.status, 200);
  const mijn = ag.body.afspraken.find(x => x.ref === boek.body.boeking.ref);
  assert.ok(mijn, 'de betaalde afspraak staat in de agenda');
  assert.ok(mijn.zorg && /pinda/.test(mijn.zorg.allergenen), 'de behandelaar ziet de allergie vooraf');
  assert.ok(ag.body.behandelaars.length, 'de behandelaars staan erbij');
  // afronden zet de afspraak op afgerond
  const af = await api('supplier/care/afronden', { ref: boek.body.boeking.ref }, sup);
  assert.equal(af.status, 200);
  const ag2 = await api('supplier/care/agenda', { datum: morgen() }, sup);
  assert.equal(ag2.body.afspraken.find(x => x.ref === boek.body.boeking.ref).status, 'afgerond');
  // een gewoon restaurant is geen zorgaanbieder: 409
  const geen = (await api('care', {}, lid)); // alleen om base te houden
  assert.ok(geen.status === 200);
});

test('herstel- & verblijfpakket: overzicht met voordeel, boeken, betalen en mijn', async () => {
  const pk = (await api('care/pakketten', {}, lid)).body.pakketten;
  assert.ok(pk.length >= 1, 'er zijn pakketten geseed');
  const p = pk.find(x => /Herstel/i.test(x.naam));
  assert.ok(p.hotelNaam && p.behandelingNaam && p.nachten >= 1, 'het pakket koppelt hotel aan behandeling');
  assert.ok(p.bespaar > 0, 'een pakket is voordeliger dan los');
  const tijd = p.tijden[p.tijden.length - 1];
  const boek = await api('care/pakket/boek', { pakketId: p.id, datum: morgen(), tijd }, lid);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.pakket.status, 'wacht-op-betaling');
  const bet = await api('care/pakket/betaal', { ref: boek.body.pakket.ref }, lid);
  assert.ok(bet.body.pakket.paid && bet.body.pakket.status === 'geboekt');
  const mijn = (await api('care/pakket/mijn', {}, lid)).body.pakketten;
  assert.ok(mijn.some(x => x.ref === boek.body.pakket.ref && x.paid), 'het pakket staat betaald in mijn overzicht');
  // de gekoppelde behandeling is meebevestigd in de gewone agenda
  const care = (await api('care/mijn', {}, lid)).body.boekingen;
  assert.ok(care.some(b => b.ref === boek.body.behandeling.ref && b.paid), 'de behandeling van het pakket staat betaald');
  // gasten mogen geen pakket boeken
  const gast = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) })).json();
  assert.equal((await api('care/pakket/boek', { pakketId: p.id, datum: morgen(), tijd: p.tijden[0] }, gast.token)).status, 403);
});

test('Rahul boekt een behandeling in gewone taal: voorstel, "ja", referentie', async () => {
  const r = await api('fluister', { q: 'boek een hot stone massage bij Zenith morgen om 11:00' }, lid2);
  assert.ok(r.body.voorstel, 'een behandeling is geld: eerst een voorstel');
  assert.ok(/Hot stone/i.test(r.body.antwoord) && /135,00/.test(r.body.antwoord), 'behandeling en prijs staan er eerlijk bij');
  const ja = await api('fluister', { q: 'ja' }, lid2);
  assert.ok(ja.body.gedaan && /Geboekt en betaald/i.test(ja.body.antwoord));
  const mijn = (await api('care/mijn', {}, lid2)).body.boekingen || [];
  assert.ok(mijn.some(b => /Hot stone/i.test(b.behandelingNaam) && b.paid), 'de behandeling staat betaald in mijn overzicht');
});
