/* ============================================================================
   EEN MENS, TWEE SCHRIJFWIJZEN IN HET DIENSTVERBAND (kern/concern/employment.js,
   `wie()`; ARBEID.md par. 7a: employment is de waarheid).

   `persoon` op een dienstverband is de LEDENSLEUTEL (uitnodiging, aanname) of
   de CODENAAM (de eigenaar die met de hand aanneemt). Elke lezer vergeleek er
   maar een, dus het dienstverband bestond voor de helft van het huis niet.

   Wat hier vastligt:
   1. wie op zijn sleutel vraagt, krijgt ook het dienstverband onder zijn
      codenaam -- en dat van een ANDER niet;
   2. dezelfde mens twee keer in dezelfde rol aannemen, eens op sleutel en eens
      op codenaam, is een dubbele invoer (409);
   3. echte server: op codenaam aangenomen -> "Mijn werk" toont de werkplek;
   4. echte server: een RTG-medewerker die zijn uitnodiging zelf aannam, staat
      in de toegangsreview van het kantoor als in dienst (kern/kantoor/huis.js)
      -- en de review blijft schaduw;
   5. echte server: /api/concern/mag toont een eigenaar NIETS van een
      dienstverband bij een andere werkgever (de tegenlezing vond dat `bijna`
      die rollen meegaf, en de sleutel-lezing maakte dat met een opeenvolgende
      sleutel op te sommen).
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');

function nepLaag(codenamen) {
  const takken = {};
  const opslag = { tak: (n) => (takken[n] = takken[n] || {}) };
  const ent = { ent_a: { id: 'ent_a' } };
  return require('../server/kern/concern/employment')({
    db: { data: {} }, save() {}, crypto, opslag,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    entiteitVind: (id) => ent[id] || null, vestigingVind: () => null,
    tijdVandaag: () => '2026-10-11',
    codenaamVan: (k) => codenamen[k] || k
  });
}

test('1-2. de sleutel leest ook de codenaam, niet die van een ander, en een tweede invoer is dubbel', () => {
  const L = nepLaag({ 'user-1': 'Stille Reiger', 'user-2': 'Gouden Vos' });
  assert.ok(L.employmentNieuw({ persoon: 'Stille Reiger', entiteit: 'ent_a', rol: 'Kantine', van: '2026-01-01' }).ok);
  assert.ok(L.employmentNieuw({ persoon: 'user-2', entiteit: 'ent_a', rol: 'Kok', van: '2026-01-01' }).ok);

  const een = L.employmentVanPersoon('user-1', false);
  assert.deepEqual(een.map(e => e.rol), ['Kantine'], 'de sleutel vindt het dienstverband op zijn codenaam');
  assert.deepEqual(L.employmentVanPersoon('user-2', false).map(e => e.rol), ['Kok'], 'en op de sleutel zelf');
  assert.deepEqual(L.employmentVanPersoon('Stille Reiger', false).map(e => e.rol), ['Kantine'],
    'een codenaam leest precies zijn codenaam');
  assert.deepEqual(L.employmentVanPersoon('user-3', false), [], 'een onbekende sleutel leest niets van een ander');

  const dubbel = L.employmentNieuw({ persoon: 'user-1', entiteit: 'ent_a', rol: 'Kantine', van: '2026-02-01' });
  assert.equal(dubbel.status, 409, 'op sleutel opnieuw aannemen wat op codenaam al loopt, is dubbel');
  assert.ok(L.employmentNieuw({ persoon: 'user-1', entiteit: 'ent_a', rol: 'Barista', van: '2026-02-01' }).ok,
    'een tweede rol bij dezelfde werkgever mag wel');
});

test('1b. zonder codenaamVan (een kale laag) blijft het de oude, letterlijke vergelijking', () => {
  const L = nepLaag({});
  assert.ok(L.employmentNieuw({ persoon: 'user-9', entiteit: 'ent_a', rol: 'Kok' }).ok);
  assert.equal(L.employmentVanPersoon('user-9', false).length, 1);
});

test('1c. de loonrun: wie op codenaam is aangenomen, is geen loon zonder dienstverband', () => {
  const K = require('../server/kern/concern')({
    db: { data: {} }, save: () => {}, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    findSupplier: (c) => (String(c || '').toUpperCase() === 'BRISA' ? { code: 'BRISA', name: 'Cafe Brisa' } : null),
    vandaag: () => '2026-09-23',
    codenaamVan: (k) => ({ 'user-7': 'Stille Reiger' })[k] || k
  });
  const e = K.entiteitVind(K.entiteitNieuw('user-1', { naam: 'Brisa BV', land: 'NL' }).entiteit.id);
  const v = K.vestigingNieuw(e, { naam: 'Haarlem' }).vestiging;
  assert.ok(K.vestigingUnit(K.vestigingVind(v.id), 'BRISA', () => true).ok);
  assert.ok(K.employmentNieuw({ persoon: 'Stille Reiger', entiteit: e.id, vestiging: v.id, rol: 'Kok', van: '2026-01-01' }).ok);
  const t = K.dienstverbandToets({ zaak: 'BRISA', periode: '2026-09', personeel: [{ id: 3, naam: 'Kok', memberId: 7 }] });
  assert.equal(t.bevindingen.filter(b => b.soort === 'loon_zonder_dienstverband').length, 0, JSON.stringify(t));
});

const CODE = 'DV-SLEUTEL';
const REDEN = 'Kwartaalreview van de kantoortoegang';
const mappen = [];
function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let srv, eigKantoor, eigLid;
test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dvs-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  eigKantoor = await kantoorAlsPersoon(srv.base, CODE);
  eigLid = (await api(srv.base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigKantoor && eigLid);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

async function nieuwLid(base, wat) {
  const reg = (await api(base, '/api/auth/register', { name: 'Dienst ' + wat, email: 'dv' + wat + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token, JSON.stringify(reg).slice(0, 200));
  return reg;
}

test('3-4. echte server: Mijn werk op codenaam, en de kantoorreview na een zelf aangenomen uitnodiging', async () => {
  const base = srv.base;
  const ent = (await api(base, '/api/concern/entiteit/nieuw', { naam: 'Rahul Travel Group', land: 'NL' }, eigLid)).body;
  assert.ok(ent.ok, JSON.stringify(ent).slice(0, 200));
  const entId = ent.entiteit.id;

  // 3. de eigenaar neemt iemand aan op CODENAAM, zoals het scherm dat vraagt
  const a = await nieuwLid(base, 'a');
  const emp = await api(base, '/api/concern/mens/nieuw',
    { entiteit: entId, persoon: a.state.user.codename, rol: 'Kantine', van: '2026-01-01' }, eigLid);
  assert.equal(emp.status, 200, JSON.stringify(emp.body).slice(0, 200));
  const mijn = await api(base, '/api/concern/mijnwerk', {}, a.token);
  assert.equal(mijn.status, 200);
  assert.deepEqual(mijn.body.werkplekken.map(w => w.rol), ['Kantine'],
    'wie op codenaam is aangenomen, ziet zijn werkplek: ' + JSON.stringify(mijn.body));
  assert.match(mijn.body.regel, /klaar/);
  // een ander lid ziet die werkplek niet
  const b0 = await nieuwLid(base, 'x');
  assert.equal((await api(base, '/api/concern/mijnwerk', {}, b0.token)).body.werkplekken.length, 0);

  // 4. een RTG-medewerker met de kantoorrol, aangenomen via een uitnodiging die hij ZELF accepteert
  const b = await nieuwLid(base, 'b');
  assert.equal((await api(base, '/api/account/koppel', await kantoorKoppelBody(base, b.token), b.token)).status, 200);
  const key = 'user-' + b.state.user.id;
  assert.equal((await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: entId }, eigKantoor)).status, 200);
  const review = async () => {
    const r = await api(base, '/api/office/beleidsmotor/review', { reden: REDEN }, eigKantoor);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    return r.body.houders.find(h => h.key === key);
  };
  const voor = await review();
  assert.equal(voor.werkverband.stand, 'geen', 'aangewezen, nog niet in dienst');
  const deurenVoor = JSON.stringify(voor.deuren);

  const u = (await api(base, '/api/concern/uitnodigen', { entiteit: entId, rol: 'Ledenbalie' }, eigLid)).body;
  assert.ok(u.code, JSON.stringify(u).slice(0, 200));
  const acc = await api(base, '/api/concern/uitnodiging/accepteer', { code: u.code }, b.token);
  assert.equal(acc.status, 200, JSON.stringify(acc.body).slice(0, 200));

  const na = await review();
  assert.deepEqual(na.werkverband, { stand: 'loopt', rollen: ['Ledenbalie'] },
    'een zelf aangenomen uitnodiging is een lopend dienstverband bij RTG');
  assert.equal(JSON.stringify(na.deuren), deurenVoor, 'schaduw: de deuren besluiten hetzelfde als ervoor');
});

test('5. /api/concern/mag leest alleen werkrelaties bij de eigen entiteit', async () => {
  const base = srv.base;
  const a = (await api(base, '/api/concern/entiteit/nieuw', { naam: 'Werkgever A', land: 'NL' }, eigLid)).body;
  assert.ok(a.ok);
  const mens = await nieuwLid(base, 'm');
  const u = (await api(base, '/api/concern/uitnodigen', { entiteit: a.entiteit.id, rol: 'Geheime Functie' }, eigLid)).body;
  assert.equal((await api(base, '/api/concern/uitnodiging/accepteer', { code: u.code }, mens.token)).status, 200);
  const key = 'user-' + mens.state.user.id;

  // een andere ondernemer met een eigen entiteit
  const b = await nieuwLid(base, 'o');
  const entB = (await api(base, '/api/concern/entiteit/nieuw', { naam: 'Werkgever B', land: 'NL' }, b.token)).body;
  assert.ok(entB.ok, JSON.stringify(entB).slice(0, 200));
  for (const persoon of [key, mens.state.user.codename]) {
    const r = await api(base, '/api/concern/mag', { entiteit: entB.entiteit.id, persoon, recht: 'project' }, b.token);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.ok, false);
    assert.equal(r.body.reden, 'geen-werkrelatie', 'bij B heeft deze mens niets: ' + JSON.stringify(r.body));
    assert.equal(JSON.stringify(r.body).includes('Geheime Functie'), false, 'de rol bij A lekt niet naar B');
  }
  // bij de eigen entiteit werkt de vraag gewoon
  const eigen = await api(base, '/api/concern/mag', { entiteit: a.entiteit.id, persoon: key, recht: 'project' }, eigLid);
  assert.notEqual(eigen.body.reden, 'geen-werkrelatie', JSON.stringify(eigen.body));
});
