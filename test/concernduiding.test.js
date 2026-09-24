/* ============================================================================
   CONCERN: EEN VRIJE NAAM ALSNOG DUIDEN (server/kern/concern/duiding.js).

   Een bestuurder van voor 23 september 2026 draagt een vrije naam en telt niet
   mee voor de tekengrens in het Werk OS. De eigenaar van de entiteit kan hem
   koppelen aan een codenaam of uitdrukkelijk als extern vastleggen. Wat deze
   toets vastlegt:

   1. Het is een CORRECTIE en geen wisseling: hetzelfde venster, dezelfde
      waarde, dezelfde juridische bron -- geen dag zonder bestuurder.
   2. Het oude feit wordt niet gewist maar vervalt, met de reden erbij.
   3. De duiding draagt een eigen bron; zonder bron geen duiding.
   4. Een feit op een codenaam wordt niet opnieuw geduid (dan is het een andere
      mens en een ander feit), en een mens staat er niet twee keer.
   5. Na het duiden is de bestuurder HERKEND in de tekenvraag.
   6. Op een echte server: alleen de eigenaar, en een onbekende codenaam is 404.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

function bouw() {
  const db = { data: {} };
  db.capsVan = () => [];
  return require('../server/kern/concern')({
    db, save: () => {}, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    findSupplier: () => null, vandaag: () => '2027-06-14'
  });
}
const BRON = { bronSoort: 'register', bronDetail: 'KvK' };

test('1-5. een oude vrije naam wordt een codenaam, zonder dat de tijdmachine een wissel ziet', () => {
  const K = bouw();
  const e = K.entiteitVind(K.entiteitNieuw('lid_a', { naam: 'Duid BV', land: 'NL', rechtsvorm: 'bv' }).entiteit.id);
  // zo stond een bestuurder er voor 23 september: een vrije naam, geen extern-vlag
  const oud = K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'marco', van: '2026-02-01',
    extra: { bevoegd: 'alleen', tekenlimiet: 500 } }, BRON)).feit;
  assert.equal(K.concernMagTekenen(e.id, 100).alleen.find(x => x.wie === 'marco').herkend, false, 'een vrije naam is niet herkend');

  const zonderBron = K.tijdDuid(e.id, oud.id, { sleutel: 'Amberen Vos', extern: false }, { wie: 'lid_a' });
  assert.equal(zonderBron.status, 400, 'een duiding is een bewering en draagt een bron');

  const r = K.tijdDuid(e.id, oud.id, { sleutel: 'Amberen Vos', extern: false }, { bronSoort: 'mens', bronDetail: 'bevestigd door de eigenaar', wie: 'lid_a' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.feit.was, 'vrij');

  const nu = K.tijdOpDatumVan(e.id, 'bestuurder', '2027-06-14');
  assert.equal(nu.length, 1, 'een bestuurder, niet twee');
  assert.equal(nu[0].sleutel, 'Amberen Vos');
  assert.equal(nu[0].van, '2026-02-01', 'hetzelfde venster: geen aftreden en geen aantreden');
  assert.equal(nu[0].waarde, 'directeur');
  assert.equal(nu[0].bron.soort, 'register', 'de juridische bron is die van de akte, niet die van de duiding');
  assert.equal(nu[0].duiding.was, 'vrij');
  assert.equal(nu[0].duiding.bron.soort, 'mens', 'de duiding draagt haar eigen bron');
  assert.equal(K.tijdOpDatumVan(e.id, 'bestuurder', '2026-03-01')[0].sleutel, 'Amberen Vos',
    'ook op een dag in het verleden: er was geen dag zonder bestuurder');

  const m = K.concernMagTekenen(e.id, 100).alleen.find(x => x.wie === 'Amberen Vos');
  assert.equal(m.herkend, true, 'na het duiden telt hij mee voor de tekengrens');

  assert.equal(K.tijdDuid(e.id, oud.id, { sleutel: 'X', extern: true }, Object.assign({ wie: 'lid_a' }, BRON)).status, 404,
    'het oude feit is vervallen');
  const opnieuw = K.tijdDuid(e.id, nu[0].id, { sleutel: 'Blauwe Reiger', extern: false }, Object.assign({ wie: 'lid_a' }, BRON));
  assert.equal(opnieuw.status, 409, 'een feit op een codenaam wordt niet stil een andere mens');

  const tweede = K.tijdZet(e.id, 'volmacht', Object.assign({ waarde: 'inkoop', sleutel: 'piet', van: '2026-02-01' }, BRON)).feit;
  const extern = K.tijdDuid(e.id, tweede.id, { sleutel: 'piet', extern: true }, Object.assign({ wie: 'lid_a' }, BRON));
  assert.equal(extern.ok, true, JSON.stringify(extern));
  assert.equal(K.tijdOpDatumVan(e.id, 'volmacht', '2027-06-14')[0].extra.extern, true);
  assert.equal(K.tijdDuid(e.id, extern.feit.id, { sleutel: 'piet', extern: true }, Object.assign({ wie: 'lid_a' }, BRON)).status, 409,
    'extern is al extern');

  const derde = K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'm. vos', van: '2026-05-01' }, BRON)).feit;
  const dubbel = K.tijdDuid(e.id, derde.id, { sleutel: 'Amberen Vos', extern: false }, Object.assign({ wie: 'lid_a' }, BRON));
  assert.equal(dubbel.status, 409, 'dezelfde mens niet twee keer als bestuurder: ' + JSON.stringify(dubbel));

  const naam = K.tijdOpDatumVan(e.id, 'naam', '2027-06-14');
  assert.equal(K.tijdDuid(e.id, naam.id, { sleutel: 'X', extern: false }, Object.assign({ wie: 'lid_a' }, BRON)).status, 400,
    'een naam van een entiteit draagt geen tekenlimiet');
});

test('6. de route: alleen de eigenaar, en de codenaam komt uit de gids', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concernduiding-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let n = 0;
  async function account(naam) {
    n += 1;
    const u = (Date.now() + n * 7919).toString().slice(-8);
    const r = (await post('/api/auth/register', { name: naam, email: 'duid' + u + '@voorbeeld.test', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' })).body;
    assert.ok(r.token, JSON.stringify(r).slice(0, 160));
    const me = (await post('/api/auth/me', {}, r.token)).body;
    return { token: r.token, codenaam: me.user.codename };
  }
  try {
    const A = await account('Eigenaar');
    const B = await account('Bestuurder');
    const C = await account('Vreemde');
    const ent = (await post('/api/concern/entiteit/nieuw', { naam: 'Route BV', land: 'NL', rechtsvorm: 'bv', van: '2026-01-01' }, A.token)).body.entiteit.id;
    const f = (await post('/api/concern/feit/zet', { entiteit: ent, soort: 'bestuurder', waarde: 'directeur', sleutel: 'marco', extern: true,
      van: '2026-01-01', bronSoort: 'register', bronDetail: 'KvK', extra: { bevoegd: 'alleen', tekenlimiet: 900 } }, A.token)).body.feit;

    const duid = (body, t) => post('/api/concern/feit/duid', Object.assign({ entiteit: ent, feit: f.id,
      bronSoort: 'mens', bronDetail: 'bevestigd door de eigenaar' }, body), t);
    assert.equal((await duid({ codenaam: B.codenaam }, C.token)).status, 404, 'een ander dan de eigenaar krijgt dezelfde 404');
    const onbekend = await duid({ codenaam: 'Niemand Bestaat Hier' }, A.token);
    assert.equal(onbekend.status, 404, JSON.stringify(onbekend.body));
    assert.match(onbekend.body.error, /geen RTG-lid/);

    const ok = await duid({ codenaam: B.codenaam.toLowerCase() }, A.token);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.feit.sleutel, B.codenaam, 'de schrijfwijze uit de gids, niet die van het verzoek');
    assert.equal(ok.body.feit.was, 'extern');

    const teken = (await post('/api/concern/tekenen', { entiteit: ent, bedrag: 100 }, A.token)).body;
    const b = teken.alleen.find(x => x.wie === B.codenaam);
    assert.ok(b && b.herkend === true, 'de tekenvraag ziet hem nu als herkend: ' + JSON.stringify(teken.alleen));
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
