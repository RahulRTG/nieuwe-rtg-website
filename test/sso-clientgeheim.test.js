/* HET SSO-CLIENTGEHEIM, VERSLEUTELD PER TENANT (besluit B16, deur
   identity.sso_client_secret in CODECREDENTIALS.json).

   Wat hier vastligt, elk met een eigen toets:
     1. op schijf staat het kale geheim nergens (rij, database, WAL);
     2. de sleutel hoort bij de organisatie: een blob naar een andere org
        verplaatst gaat niet open, en een opgerekte datum ook niet;
     3. roteren laat het vorige geheim een begrensde tijd meelopen, niet langer;
     4. een geheim vervalt;
     5. zonder sleutel weigert zetten (ook in productie zonder RTG_VAULT_KEY) en
        is de inlog dicht met de reden;
     6. een geheim uit de oude opslag wordt bij het laden herzegeld;
     7. de ruil probeert het oude geheim alleen na invalid_client.

   Draai los: node --test test/sso-clientgeheim.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssogeheim-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
require('../server/sso').zorgTabel();
const S = require('../server/accounts/state');
const kluis = require('../server/accounts/kluis');
const koppelingen = require('../server/sso/koppelingen');
const cg = require('../server/sso/clientgeheim');
const rotatie = require('../server/sso/clientgeheim-rotatie');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const DAG = 86400000;
const NU = Date.parse('2026-09-29T12:00:00Z');
let n = 0;
const nieuweOrg = (geheim) => {
  const org = 'org' + (++n);
  koppelingen.zet({ org, naam: org, issuer: 'https://idp.' + org + '.test', clientId: 'c-' + org,
    clientSecret: geheim, domeinen: org + '.test' });
  return org;
};
const rij = (org) => S.db.prepare('SELECT enc_client_secret AS w FROM sso_koppelingen WHERE org = ?').get(org).w;
const zetRij = (org, w) => S.db.prepare('UPDATE sso_koppelingen SET enc_client_secret = ? WHERE org = ?').run(w, org);

test('1. het kale geheim staat nergens op schijf, alleen de vingerafdruk en de tijden', () => {
  const GEHEIM = 'kaal-' + crypto.randomBytes(12).toString('hex');
  const org = nieuweOrg(GEHEIM);
  const w = rij(org);
  assert.ok(w.startsWith(cg.MERK), 'de nieuwe vorm');
  assert.equal(w.includes(GEHEIM), false, 'niet in de rij');
  const j = JSON.parse(w.slice(cg.MERK.length));
  assert.equal(j.sloten.length, 1);
  assert.deepEqual(Object.keys(j.sloten[0]).sort(), ['c', 'gemigreerd', 'gezet', 'tot', 'vervalt', 'vf']);
  accounts.checkpoint();
  for (const f of fs.readdirSync(TMP).filter(x => x.startsWith('rtg.db')))
    assert.equal(fs.readFileSync(path.join(TMP, f)).includes(GEHEIM), false, 'niet in ' + f);
  const stand = koppelingen.geheimStand(org);
  assert.equal(JSON.stringify(stand).includes(GEHEIM), false, 'en niet in de stand');
  assert.match(stand.vingerafdruk, /^hmac:[0-9a-f]{16}$/);
  assert.equal(stand.bruikbaar, true);
  assert.deepEqual(koppelingen.geheimenVoorRuil(org).geheimen, [GEHEIM], 'alleen de ruil krijgt hem');
});

test('2. een sleutel per tenant: verplaatst naar een andere org gaat niets open, opgerekt ook niet', () => {
  const a = nieuweOrg('geheim-a'), b = nieuweOrg('geheim-b');
  assert.notEqual(cg.vingerafdruk(a, 'x'), cg.vingerafdruk(b, 'x'), 'ook de vingerafdruk is per tenant');
  const wa = rij(a);
  /* De SLEUTEL zelf verschilt per org, los van de AAD: het slot van A gaat met de
     afgeleide sleutel van A open en met die van B niet, ook met de AAD van A. */
  const slot = JSON.parse(wa.slice(cg.MERK.length)).sloten[0];
  const open = (sleutel) => { try {
    const buf = Buffer.from(slot.c, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', sleutel, buf.subarray(0, 12));
    d.setAAD(cg.aad(a, slot)); d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; } };
  assert.equal(open(cg.tenantSleutel(S.VAULT, a)), 'geheim-a', 'de sleutel van A opent het slot van A');
  assert.equal(open(cg.tenantSleutel(S.VAULT, b)), null, 'de sleutel van B niet');
  assert.equal(open(S.VAULT), null, 'en de gedeelde kluissleutel ook niet');
  zetRij(b, wa);
  const r = koppelingen.geheimenVoorRuil(b);
  assert.deepEqual(r.geheimen, []);
  assert.equal(r.code, 'ONLEESBAAR', 'het blob van A opent niet onder de sleutel van B');
  // een datum oprekken in de database maakt het slot onleesbaar, niet langer geldig
  const j = JSON.parse(wa.slice(cg.MERK.length));
  j.sloten[0].vervalt = new Date(Date.parse(j.sloten[0].vervalt) + 400 * DAG).toISOString();
  zetRij(a, cg.MERK + JSON.stringify(j));
  assert.equal(koppelingen.geheimenVoorRuil(a).code, 'ONLEESBAAR');
});

test('3. roteren met overlap: nieuw eerst, het oude een begrensde tijd, dan weg', () => {
  const org = 'rot';
  let w = rotatie.roteer(org, 'eerste', null, {}, NU).waarde;
  const r2 = rotatie.roteer(org, 'tweede', w, { overlapDagen: 3 }, NU + DAG);
  assert.equal(r2.ongewijzigd, false);
  w = r2.waarde;
  assert.deepEqual(cg.geldige(org, w, NU + DAG).geheimen, ['tweede', 'eerste'], 'binnen de overlap allebei');
  assert.deepEqual(cg.geldige(org, w, NU + 5 * DAG).geheimen, ['tweede'], 'na de overlap alleen het nieuwe');
  const s = cg.stand(org, w, NU + DAG);
  assert.equal(s.overlap.tot, new Date(NU + 4 * DAG).toISOString());
  // hetzelfde geheim nog eens: geen overlap met zichzelf
  const zelfde = rotatie.roteer(org, 'tweede', w, { overlapDagen: 3 }, NU + 2 * DAG);
  assert.equal(zelfde.ongewijzigd, true);
  assert.equal(zelfde.waarde, w);
  // overlap 0: het vorige meteen weg
  const nul = rotatie.roteer(org, 'derde', w, { overlapDagen: 0 }, NU + 2 * DAG).waarde;
  assert.deepEqual(cg.geldige(org, nul, NU + 2 * DAG).geheimen, ['derde']);
  // de overlap eerder sluiten
  const dicht = rotatie.sluitOverlap(org, w, NU + DAG);
  assert.deepEqual(cg.geldige(org, dicht, NU + DAG).geheimen, ['tweede']);
  assert.throws(() => rotatie.sluitOverlap(org, dicht, NU + DAG), e => e.status === 409);
  assert.throws(() => rotatie.roteer(org, 'x', w, { overlapDagen: 31 }, NU), e => e.code === 'OVERLAP_ONGELDIG');
  // de overlap duurt nooit langer dan het verval van het oude geheim
  const kort = rotatie.roteer(org, 'a', null, { dagen: 2 }, NU).waarde;
  const verder = rotatie.roteer(org, 'b', kort, { overlapDagen: 30 }, NU).waarde;
  assert.equal(cg.stand(org, verder, NU).overlap.tot, new Date(NU + 2 * DAG).toISOString());
});

test('4. een geheim vervalt, en een vervaldatum is begrensd', () => {
  const org = 'verval';
  const w = rotatie.roteer(org, 'kort', null, { dagen: 1 }, NU).waarde;
  assert.deepEqual(cg.geldige(org, w, NU + DAG / 2).geheimen, ['kort']);
  const na = cg.geldige(org, w, NU + 2 * DAG);
  assert.deepEqual(na.geheimen, []);
  assert.equal(na.code, 'VERLOPEN');
  assert.equal(cg.stand(org, w, NU + 2 * DAG).bruikbaar, false);
  assert.equal(JSON.parse(w.slice(cg.MERK.length)).sloten[0].vervalt, new Date(NU + DAG).toISOString());
  assert.equal(cg.stand(org, rotatie.roteer(org, 's', null, {}, NU).waarde, NU).vervalt,
    new Date(NU + 365 * DAG).toISOString(), 'standaard 365 dagen');
  for (const o of [{ dagen: 731 }, { dagen: 0 }, { vervalt: new Date(NU - DAG).toISOString() },
    { vervalt: new Date(NU + 800 * DAG).toISOString() }])
    assert.throws(() => rotatie.roteer(org, 'x', null, o, NU), e => e.code === 'VERVAL_ONGELDIG', JSON.stringify(o));
});

test('5. fail-closed: zonder sleutel geen zetten en geen ruil, ook in productie zonder RTG_VAULT_KEY', () => {
  const org = nieuweOrg('voor-de-storing');
  const voor = rij(org);
  const vault = S.VAULT, ring = S.RING;
  S.VAULT = null; S.RING = null;
  try {
    assert.throws(() => koppelingen.zet({ org, naam: org, issuer: 'https://idp.' + org + '.test', clientId: 'c',
      clientSecret: 'nieuw', domeinen: org + '.test' }), e => e.code === 'SLEUTEL_ONTBREEKT' && e.status === 503);
    assert.equal(rij(org), voor, 'er is niets geschreven');
    const r = koppelingen.geheimenVoorRuil(org);
    assert.deepEqual(r.geheimen, []);
    assert.equal(r.code, 'SLEUTEL_ONTBREEKT');
  } finally { S.VAULT = vault; S.RING = ring; }
  const env = { ...process.env };
  process.env.NODE_ENV = 'production'; delete process.env.RTG_VAULT_KEY;
  try {
    assert.match(cg.sleutelProbleem(), /RTG_VAULT_KEY/);
    assert.throws(() => koppelingen.roteerGeheim(org, 'nieuw', {}), e => e.status === 503 && /RTG_VAULT_KEY/.test(e.message));
    assert.equal(koppelingen.geheimenVoorRuil(org).code, 'SLEUTEL_ONTBREEKT');
  } finally { process.env.NODE_ENV = env.NODE_ENV; if (env.RTG_VAULT_KEY) process.env.RTG_VAULT_KEY = env.RTG_VAULT_KEY; if (env.NODE_ENV === undefined) delete process.env.NODE_ENV; }
  assert.equal(cg.sleutelProbleem({ NODE_ENV: 'production', RTG_VAULT_KEY: 'x'.repeat(64) }), null);
  assert.deepEqual(koppelingen.geheimenVoorRuil(org).geheimen, ['voor-de-storing'], 'met sleutel weer open');
  // geen geheim gezet = dicht met de reden, geen lege ruil
  const leeg = 'leeg' + (++n);
  koppelingen.zet({ org: leeg, naam: leeg, issuer: 'https://idp.leeg.test', clientId: 'c', domeinen: leeg + '.test' });
  assert.equal(koppelingen.geheimenVoorRuil(leeg).code, 'GEEN_GEHEIM');
});

test('6. een geheim uit de oude opslag wordt bij het laden herzegeld; een onleesbaar blijft dicht', () => {
  const org = nieuweOrg('tijdelijk');
  zetRij(org, kluis.enc('uit-de-oude-opslag'));
  const r = koppelingen.geheimenVoorRuil(org);
  assert.deepEqual(r.geheimen, ['uit-de-oude-opslag']);
  const w = rij(org);
  assert.ok(w.startsWith(cg.MERK), 'herzegeld bij het laden');
  const s = koppelingen.geheimStand(org);
  assert.equal(s.gemigreerd, true);
  assert.ok(s.dagenOver >= 89 && s.dagenOver <= 90, 'vervalt over 90 dagen: ' + s.dagenOver);
  const kapot = nieuweOrg('tijdelijk2');
  zetRij(kapot, crypto.randomBytes(40).toString('base64'));
  assert.equal(koppelingen.geheimenVoorRuil(kapot).code, 'ONLEESBAAR');
  // en bij het eerste schrijven: een wijziging zonder nieuw geheim herzegelt ook
  const derde = nieuweOrg('tijdelijk3');
  zetRij(derde, kluis.enc('ook-oud'));
  koppelingen.zet({ org: derde, naam: 'nieuwe naam', issuer: 'https://idp.' + derde + '.test', clientId: 'c',
    domeinen: derde + '.test' });
  assert.ok(rij(derde).startsWith(cg.MERK));
  assert.deepEqual(koppelingen.geheimenVoorRuil(derde).geheimen, ['ook-oud']);
});

test('7. de ruil probeert het oude geheim alleen na invalid_client', async () => {
  const gezien = [];
  const ok = await cg.probeer(['nieuw', 'oud'], async (g) => {
    gezien.push(g);
    if (g === 'nieuw') throw new Error('De provider wees de tokenwissel af (invalid_client: onbekend).');
    return { claims: { sub: 'x' } };
  });
  assert.deepEqual(gezien, ['nieuw', 'oud']);
  assert.equal(ok.claims.sub, 'x');
  const ander = [];
  await assert.rejects(cg.probeer(['nieuw', 'oud'], async (g) => {
    ander.push(g); throw new Error('De provider wees de tokenwissel af (invalid_grant).');
  }), /invalid_grant/);
  assert.deepEqual(ander, ['nieuw'], 'een andere fout is geen reden om een ander geheim te proberen');
  await assert.rejects(cg.probeer([], async () => ({})), e => e.code === 'GEEN_GEHEIM');
});

test('8. na een rotatie van de kluisring gaat een oud slot nog open en zegelt een nieuw op de nieuwe sleutel', () => {
  const org = nieuweOrg('voor-de-ringrotatie');
  const ring = S.RING;
  S.RING = [crypto.randomBytes(32)].concat(ring);
  try {
    assert.deepEqual(koppelingen.geheimenVoorRuil(org).geheimen, ['voor-de-ringrotatie']);
    koppelingen.roteerGeheim(org, 'na-de-ringrotatie', { overlapDagen: 0 });
    assert.deepEqual(koppelingen.geheimenVoorRuil(org).geheimen, ['na-de-ringrotatie']);
  } finally { S.RING = ring; }
  assert.equal(koppelingen.geheimenVoorRuil(org).code, 'ONLEESBAAR', 'zonder de nieuwe sleutel gaat hij niet open');
});
