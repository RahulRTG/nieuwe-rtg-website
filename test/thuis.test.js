/* RTG Thuis: thuisverhuur van lid aan lid -- ons antwoord op Airbnb, met de
   premium functies gratis. Getest: huis live zetten (validatie), zoeken met
   filters, de transparante prijsopbouw met 0% servicekosten en weekkorting,
   instant boeken vs aanvraag + hostbeslissing, dubbele periodes geweigerd,
   keyless deurcode pas dichtbij aankomst, annuleringsbeleid, reviews twee
   kanten op, wenslijst, berichten, het hostbord en de Reiswijzer die met de
   boeking meereist. Draai los: node --experimental-sqlite --test test/thuis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, host, gastLid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-thuis-'));
const api = (pad, body, token) => fetch(base + '/api/thuis/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }).then(r => r.json());

const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  host = { token: (await login('business')).token };   // de host (codenaam van de business-persona)
  gastLid = { token: (await login('rtg')).token };     // de gast (ander lid)
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let huisId, instantId;

test('een host zet zijn huis live; rommel wordt geweigerd', async () => {
  assert.equal((await api('huis', { huis: { titel: '', plaats: 'Ibiza' } }, host.token)).status, 400, 'zonder titel geen huis');
  const r = await api('huis', { huis: { titel: 'Finca met zeezicht', plaats: 'Ibiza', land: 'Spanje', type: 'villa',
    prijs: 200, schoonmaak: 40, borg: 300, maxGasten: 6, kortingWeek: 10, minNachten: 2,
    voorzieningen: ['wifi', 'zwembad', 'nepvoorziening'], instant: false, keyless: true, annulering: 'gemiddeld' } }, host.token);
  assert.equal(r.status, 200);
  huisId = r.body.huis.id;
  assert.equal(r.body.huis.land, 'ES', 'het land wordt uit de tekst herkend');
  assert.deepEqual(r.body.huis.voorzieningen, ['wifi', 'zwembad'], 'onbekende voorzieningen vallen weg');
  const r2 = await api('huis', { huis: { titel: 'Stadsloft', plaats: 'Ibiza', type: 'appartement', prijs: 90, maxGasten: 2, instant: true } }, host.token);
  instantId = r2.body.huis.id;
  assert.ok(instantId);
});

test('zoeken: filters werken en het eigen huis staat er voor de host niet tussen', async () => {
  const alles = await api('zoek', { plaats: 'ibiza', gasten: 2 }, gastLid.token);
  assert.equal(alles.body.huizen.length, 2, 'de gast ziet beide huizen');
  const eigen = await api('zoek', { plaats: 'ibiza' }, host.token);
  assert.equal(eigen.body.huizen.length, 0, 'de host vindt zijn eigen huizen niet als gast');
  const groot = await api('zoek', { plaats: 'ibiza', gasten: 5 }, gastLid.token);
  assert.equal(groot.body.huizen.length, 1, 'gastenfilter: alleen de finca past bij 5 gasten');
  const instant = await api('zoek', { plaats: 'ibiza', instant: true }, gastLid.token);
  assert.deepEqual(instant.body.huizen.map(h => h.id), [instantId], 'instant-filter');
});

test('de prijsopbouw: weekkorting, schoonmaak en ALTIJD 0 servicekosten', async () => {
  const d = await api('detail', { id: huisId, van: dag(10), tot: dag(17) }, gastLid.token);
  const p = d.body.huis.prijsopbouw;
  assert.equal(p.nachten, 7);
  assert.equal(p.basis, 1400);
  assert.equal(p.kortingPct, 10);
  assert.equal(p.korting, 140);
  assert.equal(p.schoonmaak, 40);
  assert.equal(p.serviceKosten, 0, 'het punt: 0% servicekosten');
  assert.equal(p.totaal, 1300);
  assert.equal(p.borg, 300);
  assert.ok(d.body.huis.reiswijzer && d.body.huis.reiswijzer.code === 'ES', 'de reiswijzer van Spanje staat bij het huis');
});

let aanvraagRef, instantRef;
test('boeken: instant is meteen bevestigd; een aanvraag wacht op de host; dubbel kan niet', async () => {
  const inst = await api('boek', { id: instantId, van: dag(10), tot: dag(12), gasten: 2 }, gastLid.token);
  assert.equal(inst.status, 200);
  assert.equal(inst.body.boeking.status, 'bevestigd');
  assert.equal(inst.body.reiswijzer.code, 'ES', 'de reiswijzer reist mee met de boeking');
  instantRef = inst.body.boeking.ref;
  const dubbel = await api('boek', { id: instantId, van: dag(11), tot: dag(13), gasten: 1 }, gastLid.token);
  assert.equal(dubbel.status, 409, 'overlappende periode geweigerd');
  const kort = await api('boek', { id: huisId, van: dag(10), tot: dag(11), gasten: 2 }, gastLid.token);
  assert.equal(kort.status, 400, 'minimaal aantal nachten wordt bewaakt');
  const aan = await api('boek', { id: huisId, van: dag(10), tot: dag(14), gasten: 4 }, gastLid.token);
  assert.equal(aan.body.boeking.status, 'aangevraagd');
  aanvraagRef = aan.body.boeking.ref;
  assert.equal((await api('boek', { id: huisId, van: dag(1), tot: dag(4), gasten: 1 }, host.token)).status, 400, 'je eigen huis boeken hoeft niet');
});

test('de host ziet de aanvraag op zijn bord en accepteert; de gast checkt in en de deurcode verschijnt', async () => {
  const bord = await api('bord', {}, host.token);
  assert.equal(bord.body.aanvragen.length, 1);
  const ok = await api('beslis', { ref: aanvraagRef, akkoord: true }, host.token);
  assert.equal(ok.body.boeking.status, 'bevestigd');
  // de instant-boeking (keyless is uit op de loft): geen deurcode; de finca heeft keyless
  const mijnVoor = await api('mijn', {}, gastLid.token);
  const finca = mijnVoor.body.reizen.find(b => b.ref === aanvraagRef);
  assert.equal(finca.deurcode, null, 'de deurcode is er pas dichtbij aankomst of na check-in');
  const inChk = await api('checkin', { ref: aanvraagRef }, gastLid.token);
  assert.equal(inChk.body.boeking.status, 'ingecheckt');
  assert.match(inChk.body.boeking.deurcode, /^\d{6}$/, 'na check-in staat de keyless deurcode klaar');
  const uit = await api('checkuit', { ref: aanvraagRef }, gastLid.token);
  assert.equal(uit.body.boeking.status, 'uitgecheckt');
  assert.equal(uit.body.boeking.uitbetaling.status, 'gepland', 'de uitbetaling staat gepland, nooit "verwerkt"');
});

test('reviews twee kanten op, een keer per kant; het huis krijgt zijn rating', async () => {
  assert.equal((await api('review', { ref: aanvraagRef, sterren: 9 }, gastLid.token)).status, 400, 'sterren 1-5');
  assert.equal((await api('review', { ref: aanvraagRef, sterren: 5, tekst: 'Prachtig huis' }, gastLid.token)).status, 200);
  assert.equal((await api('review', { ref: aanvraagRef, sterren: 4 }, gastLid.token)).status, 409, 'niet twee keer');
  assert.equal((await api('review', { ref: aanvraagRef, sterren: 5, tekst: 'Nette gast' }, host.token)).status, 200, 'de host beoordeelt de gast');
  const rev = await api('reviews', { id: huisId }, gastLid.token);
  assert.equal(rev.body.rating.sterren, 5);
  assert.equal(rev.body.reviews.length, 1, 'alleen de gast-over-huis-reviews staan bij het huis');
});

test('annuleren volgt het beleid van het huis (gemiddeld: ver vooruit 100%)', async () => {
  const b = await api('boek', { id: huisId, van: dag(30), tot: dag(33), gasten: 2 }, gastLid.token);
  await api('beslis', { ref: b.body.boeking.ref, akkoord: true }, host.token);
  const ann = await api('annuleer', { ref: b.body.boeking.ref }, gastLid.token);
  assert.equal(ann.body.terugPct, 100, '30 dagen vooruit bij beleid gemiddeld = alles terug');
});

test('wenslijst, berichten en het hostbord met inkomsten en blokkades', async () => {
  await api('wens', { id: huisId }, gastLid.token);
  const w = await api('wenslijst', {}, gastLid.token);
  assert.equal(w.body.huizen.length, 1);
  assert.equal((await api('bericht', { ref: instantRef, tekst: 'Hoe laat kunnen we erin?' }, gastLid.token)).status, 200);
  const ber = await api('berichten', { ref: instantRef }, host.token);
  assert.equal(ber.body.berichten.length, 1, 'de host leest het bericht op de boeking');
  const vreemd = await api('berichten', { ref: instantRef }, (await login('lifestyle')).token);
  assert.equal(vreemd.status, 403, 'buitenstaanders lezen niet mee');
  const blok = await api('blokkeer', { id: huisId, van: dag(60), tot: dag(65) }, host.token);
  assert.equal(blok.status, 200);
  assert.equal((await api('boek', { id: huisId, van: dag(61), tot: dag(63), gasten: 2 }, gastLid.token)).status, 409, 'geblokkeerde datums zijn niet boekbaar');
  const bord = await api('bord', {}, host.token);
  assert.equal(bord.body.inkomstenTotaal, 840, 'de afgeronde finca-boeking telt als inkomsten (4 nachten x 200 + 40 schoonmaak, geen weekkorting)');
});

test('prijsadvies en poorten: gast (gratis app) mag kijken, niet boeken', async () => {
  const adv = await api('prijsadvies', { id: huisId }, host.token);
  assert.equal(adv.status, 200);
  assert.ok(adv.body.advies > 0 && adv.body.uitleg, 'het AI-advies zegt eerlijk waarom');
  const g = await login('guest');
  assert.equal((await api('zoek', { plaats: 'ibiza' }, g.token)).status, 200, 'kijken mag iedereen');
  assert.equal((await api('boek', { id: huisId, van: dag(40), tot: dag(42), gasten: 1 }, g.token)).status, 403, 'boeken is voor leden');
});
