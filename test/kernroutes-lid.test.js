/* ============================================================================
   ACHT LEDENDEUREN UIT DE LANCEERBARE KERN DIE GEEN ENKELE TOETS AANRIEP.

   De keuring (scripts/keuring.js, dekking) telde deze routes als "komt in geen
   test voor". Ze horen bij RTG Pass, betalen en Rahul -- de kern uit
   CONSOLIDATIE.md -- en elk ervan doet iets dat een lid merkt:

     - /api/geld/pot/weg        een oormerk opheffen; een pot met een aanstaande
                                beleidsregel gaat NIET weg (anders verliest die
                                regel stil zijn doel), en het weghalen staat in
                                het actielog.
     - /api/rahul/kijk          zonder geldige foto een 400, en zonder AI-sleutel
                                een eerlijke 503 in plaats van een verzonnen
                                beschrijving.
     - /api/rahul/plekken       zonder vrienden alleen De Salon; Rahul plaatst
                                nooit iets uit zichzelf.
     - /api/rahul/stemming      een stand uit de vaste lijst.
     - /api/ik/vandaag          zonder plek geen gebedstijden en dat zegt hij;
                                met plek een qibla die bij die plek hoort.
     - /api/push/subscribe      alleen https naar een bekende pushdienst; een
                                intern adres is een SSRF-poging en wordt geweigerd.
     - /api/contracten/mijn     het lid ziet het contract dat een zaak hem stuurde,
     - /api/contract/weiger     en kan het weigeren; een ander lid kan dat niet.

   Elke toets heeft een positieve kant EN een weigering, zodat een kapotte route
   die overal "nee" zegt hier niet groen staat (LAT.md regel 9).

   MUTATIES GEZIEN ZAKKEN: (1) in server/kern/geldbeleid/potten.js de grendel
   `rec.regels.some(x => x.aan && x.potId === pid)` op `false`; de pot-toets
   zakte. (2) in server/server.js `!ssrf.pushEndpointOk(sub.endpoint)` op
   `false`; de push-toets zakte op het metadata-adres. Teruggedraaid, groen.

   Draai los: node --test test/kernroutes-lid.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('node:crypto');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kernroutes-lid-'));
let srv, base;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function versLid(metPaspoort) {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Kern Toets', email: 'kernroutes-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven: ' + JSON.stringify(r.body).slice(0, 160));
  if (metPaspoort) {
    const kyc = await api('/api/verify/upload', { image: MINI_PNG }, r.body.token);
    assert.equal(kyc.status, 200, 'het paspoort hoort aangenomen te worden: ' + JSON.stringify(kyc.body).slice(0, 160));
  }
  return r.body.token;
}

test.before(async () => {
  /* Geen AI-sleutel: /api/rahul/kijk moet dan eerlijk zeggen dat hij niet kan
     kijken. Een sleutel uit de omgeving van de ontwikkelaar mag dat niet
     stilletjes omzetten in een echte modelaanroep. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
});
test.after(() => {
  stop(srv);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { if (e && e.code !== 'ENOTEMPTY') throw e; }
});

test('geld/pot/weg: een pot gaat weg, maar niet zolang een aanstaande regel erin reserveert', async () => {
  const tok = await versLid(true);
  const pot = await api('/api/geld/pot/zet', { naam: 'Vakantie', doelCenten: 50000 }, tok);
  assert.equal(pot.status, 200, JSON.stringify(pot.body).slice(0, 160));
  const id = pot.body.pot.id;

  const regel = await api('/api/geld/beleid/zet',
    { soort: 'reserveer-maandelijks', drempelCenten: 5000, niveau: 'automatisch', potId: id }, tok);
  assert.equal(regel.status, 200, JSON.stringify(regel.body).slice(0, 160));

  const geweigerd = await api('/api/geld/pot/weg', { id }, tok);
  assert.equal(geweigerd.status, 400, 'een pot met een aanstaande regel gaat niet weg');
  assert.match(geweigerd.body.error, /beleidsregel/);
  let b = (await api('/api/geld/beleid', {}, tok)).body;
  assert.ok(b.potten.some(p => p.id === id), 'na de weigering staat de pot er nog');

  assert.equal((await api('/api/geld/pot/weg', { id: 'bestaat-niet' }, tok)).status, 404);
  assert.equal((await api('/api/geld/pot/weg', { id }, null)).status, 401, 'zonder sessie niets');

  assert.equal((await api('/api/geld/beleid/weg', { id: regel.body.regel.id }, tok)).status, 200);
  const weg = await api('/api/geld/pot/weg', { id }, tok);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  b = (await api('/api/geld/beleid', {}, tok)).body;
  assert.ok(!b.potten.some(p => p.id === id), 'de pot is weg');

  const log = (await api('/api/geld/actielog', {}, tok)).body.log;
  assert.ok(Array.isArray(log) && log.length > 0, 'het actielog is gevuld');
  assert.ok(log.some(x => /Pot weggehaald: Vakantie/.test(x.wat || '')), 'het weghalen staat in het log');
});

test('rahul/kijk: geen foto is een 400, en zonder AI-sleutel raadt hij niet maar zegt hij 503', async () => {
  const tok = await versLid(false);
  const zonder = await api('/api/rahul/kijk', { vraag: 'Wat is dit?' }, tok);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /foto/);

  const tekst = await api('/api/rahul/kijk', { foto: 'data:text/plain;base64,aGFsbG8=' }, tok);
  assert.equal(tekst.status, 400, 'alleen jpeg, png of webp');

  const geenModel = await api('/api/rahul/kijk', { foto: MINI_PNG, vraag: 'Wat is dit?' }, tok);
  assert.equal(geenModel.status, 503, JSON.stringify(geenModel.body).slice(0, 160));
  assert.match(geenModel.body.error, /niet raden/);
  assert.equal(geenModel.body.tekst, undefined, 'geen verzonnen beschrijving');

  assert.equal((await api('/api/rahul/kijk', { foto: MINI_PNG }, null)).status, 401);
});

test('rahul/plekken en rahul/stemming: zonder vrienden alleen De Salon, en een stand uit de lijst', async () => {
  const tok = await versLid(false);
  const p = await api('/api/rahul/plekken', {}, tok);
  assert.equal(p.status, 200);
  assert.ok(p.body.plekken.length > 0, 'er is minstens een plek');
  assert.deepEqual(p.body.plekken.map(x => x.id), ['salon'], 'zonder connecties geen snap-bestemming');
  assert.equal(p.body.plekken[0].pad, '/api/member/story/post');
  assert.match(p.body.noot, /nooit iets uit zichzelf/);
  assert.equal((await api('/api/rahul/plekken', {}, null)).status, 401);

  const s = await api('/api/rahul/stemming', {}, tok);
  assert.equal(s.status, 200);
  const standen = s.body.stemming.standen.map(x => x.id);
  assert.ok(standen.length > 0, 'er zijn standen');
  assert.ok(standen.includes(s.body.stemming.id), 'de huidige stand komt uit de vaste lijst');
  assert.equal((await api('/api/rahul/stemming', {}, null)).status, 401);
});

test('ik/vandaag: zonder plek geen gebedstijden, met plek een qibla die bij die plek past', async () => {
  const tok = await versLid(false);
  const leeg = await api('/api/ik/vandaag', {}, tok);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.tradities, [], 'zonder profiel geen tradities');
  assert.equal(leeg.body.plekNodig, true);

  const zet = await api('/api/ik/geloof', { tradities: ['islam'], gebed: true }, tok);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));

  const zonderPlek = await api('/api/ik/vandaag', {}, tok);
  assert.equal(zonderPlek.body.tradities.length, 1, 'na het zetten staat er een traditie');
  assert.deepEqual(zonderPlek.body.tradities, ['islam']);
  assert.equal(zonderPlek.body.gebed, null, 'zonder plek geen tijden');
  assert.equal(zonderPlek.body.qibla, null);

  const onzin = await api('/api/ik/vandaag', { lat: 500, lon: 4.9 }, tok);
  assert.equal(onzin.body.plekNodig, true, 'een breedtegraad van 500 is geen plek');

  const amsterdam = await api('/api/ik/vandaag', { lat: 52.37, lon: 4.9 }, tok);
  assert.equal(amsterdam.body.plekNodig, false);
  assert.ok(amsterdam.body.gebed, 'met plek komen er tijden');
  // Vanuit Amsterdam ligt Mekka in het zuidoosten: ruwweg 120 graden.
  assert.ok(amsterdam.body.qibla.graden > 110 && amsterdam.body.qibla.graden < 130,
    'qibla vanuit Amsterdam hoort rond 120 graden te liggen, kreeg ' + amsterdam.body.qibla.graden);
  assert.ok(amsterdam.body.qibla.afstandKm > 4000 && amsterdam.body.qibla.afstandKm < 5000);

  assert.equal((await api('/api/ik/vandaag', {}, null)).status, 401);
});

test('push/subscribe: alleen https naar een bekende pushdienst; een intern adres is geen abonnement', async () => {
  const tok = await versLid(false);
  assert.equal((await api('/api/push/subscribe', {}, tok)).status, 400, 'zonder subscription een 400');
  const ssrf = await api('/api/push/subscribe',
    { subscription: { endpoint: 'http://169.254.169.254/latest/meta-data/' } }, tok);
  assert.equal(ssrf.status, 400);
  assert.match(ssrf.body.error, /push-endpoint/);
  const vreemd = await api('/api/push/subscribe',
    { subscription: { endpoint: 'https://kwaad.example/push/abc' } }, tok);
  assert.equal(vreemd.status, 400, 'https alleen is niet genoeg: de host moet een pushdienst zijn');

  const goed = await api('/api/push/subscribe', { subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/toets-' + Date.now(),
    keys: { p256dh: 'x', auth: 'y' } } }, tok);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  assert.equal(goed.body.ok, true);
  assert.equal((await api('/api/push/subscribe', { subscription: { endpoint: 'https://fcm.googleapis.com/x' } }, null)).status, 401);
});

test('contracten/mijn en contract/weiger: het lid ziet en weigert zijn eigen contract, een ander niet', async () => {
  const lid = await versLid(false);
  const ander = await versLid(false);
  const me = await api('/api/auth/me', {}, lid);
  const codenaam = me.body.user && me.body.user.codename;
  assert.ok(codenaam, 'het lid heeft een codenaam');

  /* De commerciele lidmaatschapskern en de zaakcontracten delen van oudsher
     dezelfde collectie, maar hebben bewust een andere vorm. Maak eerst langs
     de echte menselijke besluitroute zo'n commercieel contract. Dit was de
     combinatie die APPWERKT op Ter plaatse liet crashen: contracten/mijn nam
     ten onrechte aan dat elke rij `partij.kind` droeg. */
  const aanvraag = await api('/api/aanmelding/aanvraag', {
    idem: randomUUID(), pas: 'lifestyle', naam: 'Kern Toets', contact: 'kernroutes-contract@toets.example'
  }, lid);
  assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 200));
  const kantoor = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  assert.ok(kantoor, 'de kantoormens op naam kon niet inloggen');
  const besluit = await api('/api/aanmelding/beslis', {
    id: aanvraag.body.ontvangst.aanvraagId, besluit: 'geaccepteerd', contractEuro: 20000,
    notitie: 'vormgrens van de gedeelde contractencollectie'
  }, kantoor);
  assert.equal(besluit.status, 200, JSON.stringify(besluit.body).slice(0, 200));

  const rooster = await api('/api/supplier/roster', { code: 'CASTELL' });
  const mg = (rooster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(mg, 'de demozaak heeft leiding');
  const baas = (await api('/api/supplier/login', { code: 'CASTELL', staffId: mg.id, pin: '1234' })).body.token;
  assert.ok(baas, 'de leiding logt in');

  const maak = await api('/api/supplier/contract/maak', { soort: 'algemeen', titel: 'Verbouwing keuken',
    tekst: 'De zaak verbouwt de keuken van het lid volgens de offerte in de bijlage.', codenaam }, baas);
  assert.equal(maak.status, 200, JSON.stringify(maak.body).slice(0, 160));
  const ref = maak.body.contract.ref;

  const mijn = await api('/api/contracten/mijn', {}, lid);
  assert.equal(mijn.status, 200);
  const c = mijn.body.contracten.find(x => x.ref === ref);
  assert.ok(c, 'het contract staat in de lijst van het lid');
  assert.equal(c.status, 'wacht');
  assert.equal(c.getekendDoorMij, false);
  assert.ok(!(await api('/api/contracten/mijn', {}, ander)).body.contracten.some(x => x.ref === ref),
    'een ander lid ziet dit contract niet');

  assert.equal((await api('/api/contract/weiger', { ref }, ander)).status, 404, 'een ander lid kan het niet weigeren');
  assert.equal((await api('/api/contract/weiger', { ref }, null)).status, 401);

  const weiger = await api('/api/contract/weiger', { ref }, lid);
  assert.equal(weiger.status, 200, JSON.stringify(weiger.body).slice(0, 160));
  const na = (await api('/api/contracten/mijn', {}, lid)).body.contracten.find(x => x.ref === ref);
  assert.equal(na.status, 'geweigerd');
  const teken = await api('/api/contract/teken', { ref, naam: 'Kern Toets', akkoord: true }, lid);
  assert.equal(teken.status, 409, 'een geweigerd contract wordt niet alsnog getekend');
});
