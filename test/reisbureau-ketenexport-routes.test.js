/* Echte HTTP-/SQLite-zelfexport en de bestaande tenantinvoer. De zaken,
   controles en leveranciersverklaringen zijn uitsluitend lokale proefdata. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisexport-http-'));
const MP = '/api/reisbureau/keten', SP = '/api/supplier/reisbureau/keten', AP = '/api/supplier/reisbureau/opdrachten';
let srv, x, eigen, anders, eersteHash, uitvoer;
test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  x = await maakReisketenFixture(srv.base);
  const start = async (supplierCode, titel) => goed(await x.api(MP + '/start', {
    supplierCode, titel, bestemming: 'Exportproef', idem: 'reisexport-start-' + titel
  }, x.reiziger.token), 'aanvraag').reis;
  eigen = await start(x.bureau.code, 'eigen'); anders = await start(x.anderBureau.code, 'concurrent');
  await start('', 'rtg');
  let o = goed(await x.api(SP + '/offerte', x.offerte(eigen), x.bureau.token), 'eerste offerte').reis;
  eersteHash = o.offerte.hash;
  o = goed(await x.api(SP + '/offerte', x.offerte(o, { idem: 'reisexport-offerte-twee',
    voorwaarden: 'Tweede versie van lokale offertevoorwaarden.' }), x.bureau.token), 'tweede offerte').reis;
  eigen = goed(await x.api(MP + '/akkoord', { ref: o.ref, versie: o.versie,
    offerteHash: o.offerte.hash, idem: 'reisexport-akkoord' }, x.reiziger.token), 'akkoord').reis;
  goed(await x.api('/api/supplier/reisbureau/opdracht/besluit', { ref: eigen.ref, versie: eigen.versie,
    onderdeel: 'hotel', besluit: 'accepteer', bewijsRef: 'EXPORT-TEST-HOTEL-ACCEPTATIE',
    idem: 'reisexport-hotel-accepteer' }, x.hotel.token), 'eigen hotelacceptatie');
  eigen = goed(await x.api(MP, {}, x.reiziger.token), 'actuele reis voor nazorg').reizen.find(r => r.ref === eigen.ref);
  eigen = goed(await x.api(MP + '/nazorg', { ref: eigen.ref, versie: eigen.versie, offerteHash: eigen.offerte.hash,
    soort: 'wijziging', onderdelen: ['hotel'], toelichting: 'Eigen persoonlijke nazorgtoelichting voor export',
    idem: 'reisexport-nazorg-vraag' }, x.reiziger.token), 'nazorgvraag').reis;
  eigen = goed(await x.api(SP + '/nazorg/antwoord', { ref: eigen.ref, versie: eigen.versie,
    nazorgId: eigen.nazorg[0].id, soort: 'voorstel', toelichting: 'Ongeverifieerd verkopersvoorstel voor export',
    bronRef: 'NAZORG-EXPORT-BRONCLAIM', idem: 'reisexport-nazorg-antwoord' }, x.bureau.token), 'nazorgantwoord').reis;
});
test.after(async () => { if (srv) await stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
function canoniek(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
}
const som = v => crypto.createHash('sha256').update(canoniek(v)).digest('hex');

test('bestaande zaakroute exporteert uitsluitend eigen contracthistorie met onafhankelijk narekenbare checksum', async () => {
  uitvoer = goed(await x.api(SP, { vorm: 'uitvoer', org: x.anderBureau.org,
    supplierCode: x.anderBureau.code }, x.bureau.token), 'zaakzelfexport');
  assert.equal(uitvoer.versie, 1); assert.equal(uitvoer.status, 'gedeeltelijk');
  const a = uitvoer.inhoud.reisarchief;
  assert.equal(a.scope.org, x.bureau.org); assert.equal(a.scope.supplierCode, x.bureau.code);
  assert.deepEqual(a.reizen.map(r => r.ref), [eigen.ref]);
  assert.equal(a.reizen[0].offerteVersies[0].hash, eersteHash);
  assert.equal(a.reizen[0].leveringen[0].bewijzen[0].bewijsRef, 'EXPORT-TEST-HOTEL-ACCEPTATIE');
  const v = a.reizen[0].nazorg[0];
  assert.equal(v.antwoord.bronRef, 'NAZORG-EXPORT-BRONCLAIM');
  assert.equal(v.antwoord.juridischGoedgekeurd, false); assert.equal(v.financieleUitvoering, 'geblokkeerd');
  assert.equal(v.actor, a.reizen[0].akkoord.actor);
  for (const c of uitvoer.catalogus) assert.equal(c.checksum, som(uitvoer.inhoud[c.soort]));
  assert.equal(uitvoer.checksum, som(uitvoer.catalogus));
  assert.doesNotMatch(JSON.stringify(uitvoer), /"customerKey"|"actorRef"|"ontvangsten"|"sleutel"|user-\d+/);
  const concurrent = goed(await x.api(SP, { vorm: 'uitvoer', ref: eigen.ref }, x.anderBureau.token), 'concurrent zelfexport');
  assert.deepEqual(concurrent.inhoud.reisarchief.reizen.map(r => r.ref), [anders.ref]);
});

test('aanbiederexport is een eigen opdrachthistorie zonder verkoopprijzen, klant of andere leveranciers', async () => {
  const u = goed(await x.api(AP, { vorm: 'uitvoer' }, x.hotel.token), 'eigen aanbiederexport');
  const a = u.inhoud.reisarchief;
  assert.equal(a.scope.rol, 'aanbieder'); assert.equal(a.reizen.length, 1);
  assert.deepEqual(a.reizen[0].opdrachten.map(p => p.id), ['hotel']);
  assert.equal(a.reizen[0].opdrachten[0].verschuldigdCenten, 45000);
  assert.equal(a.reizen[0].opdrachten[0].bewijzen[0].bewijsRef, 'EXPORT-TEST-HOTEL-ACCEPTATIE');
  for (const geheim of [x.reiziger.codenaam, x.transfer.code, x.fiets.code, 'TEST-RIT', 'TEST-FIETSDAG', '80000', '50000',
    'NAZORG-EXPORT-BRONCLAIM', 'Eigen persoonlijke nazorgtoelichting', '"nazorg":'])
    assert.equal(JSON.stringify(a).includes(geheim), false, geheim);
  const r = await fetch(srv.base + AP, { method: 'POST', headers: { 'Content-Type': 'application/json',
    Authorization: 'Bearer ' + x.hotel.token }, body: JSON.stringify({ vorm: 'leesbaar' }) });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/markdown/);
  const md = await r.text(); assert.match(md, /Documentair reisarchief/); assert.ok(md.includes(eigen.ref));
});

test('echte bestaande tenantinvoer maakt alleen een nieuw inert archief en herexport bewaart dezelfde bewijsbytes', async () => {
  const voor = goed(await x.api(MP, {}, x.reiziger.token), 'reisvoorraad voor').reizen;
  const geldVoor = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'geld voor');
  assert.equal((await x.api('/api/techniek/tenant/invoer', { uitvoer }, x.bureau.token)).status, 401);
  const r = goed(await x.api('/api/techniek/tenant/invoer', { uitvoer, naam: 'Documentair exportarchief' }, x.tech), 'archiefinvoer');
  assert.ok(r.werkruimte); assert.ok(r.beheerToken, 'uitsluitend lokale bestaande nieuwe werkruimtesleutel');
  const terug = goed(await x.api('/api/tenant/export', { werkruimte: r.werkruimte, beheerToken: r.beheerToken }), 'herexport');
  assert.equal(terug.tenant, null, 'geen oorspronkelijke tenantbinding teruggezet');
  assert.deepEqual(terug.inhoud.leden, {}); assert.equal(terug.inhoud.reisAanvragen, undefined);
  assert.deepEqual(terug.inhoud.reisarchief, uitvoer.inhoud.reisarchief);
  assert.equal(terug.inhoud.reisarchief.reizen[0].nazorg[0].antwoord.juridischGoedgekeurd, false);
  assert.equal(terug.inhoud.reisarchief.reizen[0].nazorg[0].uitvoering, 'niet-uitgevoerd');
  assert.deepEqual(goed(await x.api(MP, {}, x.reiziger.token), 'reisvoorraad na').reizen, voor);
  assert.deepEqual(goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'geld na'), geldVoor);
  const kwaad = structuredClone(uitvoer); kwaad.inhoud.reisarchief.operationeelHerstel = true;
  for (const c of kwaad.catalogus) c.checksum = som(kwaad.inhoud[c.soort]); kwaad.checksum = som(kwaad.catalogus);
  assert.equal((await x.api('/api/techniek/tenant/invoer', { uitvoer: kwaad }, x.tech)).status, 400);
});

test('echte HTTP-import weigert beschadigde vormen en catalogi zonder nieuwe SQLite-werkruimte', async () => {
  const kv = new DatabaseSync(path.join(map, 'store.db'), { readOnly: true });
  try {
    const snapshot = () => kv.prepare("SELECT key,val,ver,deleted FROM kv WHERE key IN ('werkruimtes','reisAanvragen') ORDER BY key").all();
    const voor = snapshot();
    for (const wijzig of [u => { u.catalogus = {}; }, u => { u.catalogus = [null]; },
      u => { u.catalogus[0].aantal = 999; u.checksum = som(u.catalogus); },
      u => { u.catalogus.push({ ...u.catalogus[0] }); u.checksum = som(u.catalogus); },
      u => { u.inhoud.reisarchief.reizen = [null]; },
      u => { u.inhoud.reisarchief.vrij = JSON.parse('{"__proto__":{"manager":true}}'); }]) {
      const kwaad = structuredClone(uitvoer); wijzig(kwaad);
      if (Array.isArray(kwaad.catalogus) && kwaad.catalogus.every(c => c && typeof c.soort === 'string')) {
        for (const c of kwaad.catalogus) c.checksum = som(kwaad.inhoud[c.soort]);
        kwaad.checksum = som(kwaad.catalogus);
      }
      const r = await x.api('/api/techniek/tenant/invoer', { uitvoer: kwaad }, x.tech);
      assert.equal(r.status, 400, JSON.stringify(r));
      assert.deepEqual(snapshot(), voor, 'geen gedeeltelijke import of reiswijziging');
    }
    const goedArchief = goed(await x.api('/api/techniek/tenant/invoer', { uitvoer }, x.tech), 'goede import na afwijzingen');
    const terug = goed(await x.api('/api/tenant/export', {
      werkruimte: goedArchief.werkruimte, beheerToken: goedArchief.beheerToken
    }), 'goede herexport');
    assert.deepEqual(terug.inhoud.reisarchief, uitvoer.inhoud.reisarchief);
  } finally { kv.close(); }
});

test('export volgt bestaande persoonlijke auth en actuele tenantintrekking, ook bij herhaalde transportidentiteit', async () => {
  assert.equal((await x.api(SP, { vorm: 'uitvoer' })).status, 401);
  assert.equal((await x.api(SP, { vorm: 'uitvoer' }, x.bureau.gedeeldeManager)).status, 403);
  assert.equal((await x.api(SP, { vorm: 'uitvoer' }, x.hotel.token)).status, 403);
  const header = { 'Idempotency-Key': 'reisexport-transport-vast' };
  const geleverd = goed(await x.api(SP, { vorm: 'uitvoer' }, x.bureau.token, header), 'eerste echte uitvoer');
  assert.equal(geleverd.versie, 1); assert.ok(geleverd.inhoud.reisarchief);
  goed(await x.api('/api/techniek/tenant', { org: x.bureau.org, actief: false }, x.tech), 'tenant dicht');
  assert.equal((await x.api(SP, { vorm: 'uitvoer' }, x.bureau.token, header)).status, 403);
});
