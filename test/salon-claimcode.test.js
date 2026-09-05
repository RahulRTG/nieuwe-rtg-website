/* Salon-claimcredential: de kale code verschijnt eenmaal; opslag, rotatie,
   intrekking en verzilvering delen een autoritatief collectieslot. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const POST = id => ({ id, partnerCode: 'ZAAK', deal: {
  titel: 'Chefsmenu', geldigTot: '2027-12-31', claims: [] } });

function opstelling(posts = [POST(41)]) {
  const db = { data: { posts } };
  let rij = Promise.resolve();
  const bewerkCollectie = (sleutel, werk) => {
    assert.equal(sleutel, 'posts');
    const uitvoering = rij.then(() => {
      const concept = structuredClone(db.data.posts);
      const antwoord = werk(concept);
      assert.equal(antwoord && typeof antwoord.then, 'undefined');
      db.data.posts = concept;
      return antwoord;
    });
    rij = uitvoering.catch(() => {});
    return uitvoering;
  };
  const kern = require('../server/kern/salon-claimcode')({
    db, save() {}, bewerkCollectie, crypto,
    nu: () => Date.parse('2026-09-05T09:00:00.000Z')
  });
  return { db, kern };
}

const uitgifte = (kern, extra = {}) => kern.uitgeven({ postId: 41,
  key: 'user-7', codename: 'Kobalt',
  idempotentieSleutel: 'salon-uitgifte-00000001', ...extra });

test('uitgifte is 128-bit, eenmalig en hash-only opgeslagen', async () => {
  const { db, kern } = opstelling();
  assert.equal((await kern.uitgeven({ postId: 41, key: 'user-7' })).status, 400);
  const eerste = await uitgifte(kern);
  assert.equal(eerste.status, 200);
  assert.match(eerste.code, /^SAL\.[A-F0-9]{32}$/);
  assert.equal(eerste.eenmalig, true);

  const herhaald = await uitgifte(kern);
  assert.equal(herhaald.status, 409);
  assert.equal(herhaald.herhaald, true);
  assert.equal('code' in herhaald, false);
  assert.equal(db.data.posts[0].deal.claims.length, 1);
  const bewaard = JSON.stringify(db.data.posts);
  assert.equal(bewaard.includes(eerste.code), false);
  assert.match(db.data.posts[0].deal.claims[0].toegang.code_hash, /^[a-f0-9]{64}$/);
});

test('rotatie sluit de oude code en heronthult een retry niet', async () => {
  const { kern } = opstelling();
  const eerste = await uitgifte(kern);
  const nieuw = await kern.roteer({ postId: 41, key: 'user-7',
    idempotentieSleutel: 'salon-rotatie-000000001' });
  assert.equal(nieuw.status, 200);
  assert.match(nieuw.code, /^SAL\.[A-F0-9]{32}$/);
  assert.notEqual(nieuw.code, eerste.code);
  const retry = await kern.roteer({ postId: 41, key: 'user-7',
    idempotentieSleutel: 'salon-rotatie-000000001' });
  assert.equal(retry.status, 409);
  assert.equal(retry.herhaald, true);
  assert.equal('code' in retry, false);
  assert.equal((await kern.verzilver({ code: eerste.code, partnerCode: 'ZAAK',
    actor: 'kassa-1', idempotentieSleutel: 'salon-innen-oud-000001' })).status, 404);
  assert.equal((await kern.verzilver({ code: nieuw.code, partnerCode: 'ZAAK',
    actor: 'kassa-1', idempotentieSleutel: 'salon-innen-nieuw-0001' })).status, 200);
});

test('verzilvering is partnergebonden, atomair en exact herhaalbaar', async () => {
  const { db, kern } = opstelling();
  const eerste = await uitgifte(kern);
  assert.equal((await kern.verzilver({ code: eerste.code, partnerCode: 'BUUR',
    actor: 'kassa-2', idempotentieSleutel: 'salon-buur-0000000001' })).status, 404);
  const innen = { code: eerste.code, partnerCode: 'ZAAK', actor: 'kassa-1',
    idempotentieSleutel: 'salon-innen-000000001' };
  const een = await kern.verzilver(innen);
  assert.equal(een.status, 200);
  assert.equal(een.herhaald, undefined);
  const twee = await kern.verzilver(innen);
  assert.equal(twee.status, 200);
  assert.equal(twee.herhaald, true);
  assert.equal(db.data.posts[0].deal.claims[0].toegang.gebruik, 1);
  assert.equal((await kern.verzilver({ ...innen,
    idempotentieSleutel: 'salon-innen-anders-0001' })).status, 409);
});

test('intrekken sluit server-side en is veilig herhaalbaar', async () => {
  const { kern } = opstelling();
  const eerste = await uitgifte(kern);
  const invoer = { postId: 41, key: 'user-7',
    idempotentieSleutel: 'salon-intrek-000000001' };
  assert.equal((await kern.intrekken(invoer)).status, 200);
  const retry = await kern.intrekken(invoer);
  assert.equal(retry.status, 200);
  assert.equal(retry.herhaald, true);
  assert.equal((await kern.verzilver({ code: eerste.code, partnerCode: 'ZAAK',
    actor: 'kassa-1', idempotentieSleutel: 'salon-innen-na-intrek-1' })).status, 404);
});

test('oude kale codes worden duurzaam verwijderd en hard gesloten', async () => {
  const oud = POST(41);
  oud.deal.claims.push({ code: 'RTG-D-A1B2C3', key: 'user-7',
    codename: 'Kobalt', at: '2026-01-01T00:00:00.000Z', used: false });
  const { db, kern } = opstelling([oud]);
  const migratie = await kern.migreerAlles();
  assert.equal(migratie.gewijzigd, true);
  const rij = db.data.posts[0].deal.claims[0];
  assert.equal('code' in rij, false);
  assert.equal('used' in rij, false);
  assert.equal(rij.status, 'legacy-gesloten');
  assert.match(rij.toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(db.data.posts).includes('RTG-D-A1B2C3'), false);
  assert.equal((await kern.verzilver({ code: 'RTG-D-A1B2C3', partnerCode: 'ZAAK',
    actor: 'kassa', idempotentieSleutel: 'salon-legacy-innen-0001' })).status, 404);
  assert.equal((await kern.migreerAlles()).gewijzigd, false);
});

test('antwoordcaches en de leden-UI respecteren eenmalige uitgifte', () => {
  const eenmalig = require('../server/lib/eenmalig-geheim-routes').ROUTES;
  const nooit = require('../server/lib/idemsleutels-nooit').NOOIT;
  assert.ok(eenmalig.has('POST /api/salon/deal/claim'));
  assert.ok(eenmalig.has('POST /api/salon/deal/claim/roteer'));
  assert.match(nooit['POST /api/salon/deal/claim'], /eenmalige Salon/);
  assert.match(nooit['POST /api/salon/deal/claim/roteer'], /nooit/);
  const map = path.join(__dirname, '..', 'public', 'apps', 'app-main');
  const bron = ['app-main-56c.js', 'app-main-56d.js', 'app-main-57.js', 'app-main-58.js']
    .map(n => fs.readFileSync(path.join(map, n), 'utf8')).join('\n');
  assert.doesNotMatch(bron, /mijnCode/);
  assert.match(bron, /mijnClaim/);
  assert.match(bron, /RTGIdem\('salon-claim'\)/);
  assert.match(bron, /salon\/deal\/claim\/roteer/);
  assert.match(bron, /salon\/deal\/claim\/intrek/);
  assert.match(bron, /nooit in app-state/);
});

test('startup houdt verkeer dicht tot de autoritatieve migratie committe', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
  assert.match(bron, /opslagKlaar:\s*opslagMotorKlaar/);
  assert.match(bron, /opslagMotorKlaar\(\) && salonMigratieKlaar/);
  assert.match(bron, /salonMigratieKlaar = false/);
  assert.match(bron, /salonClaimcode\.migreerAlles\(\)/);
  assert.match(bron, /salonMigratieKlaar = true/);
  assert.match(bron, /startPostgres:\s*startPostgresMetSalon/);
});
