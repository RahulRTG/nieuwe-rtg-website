/* B27 (deur identity.sso_client_secret): de uitrollijst van
   scripts/ssogeheim-ouderdom.js.

   Een seed met een OUD slot (gezet 120 dagen voor de uitrol, eigen verval ver
   weg), een VERS slot en een GEMIGREERD slot (geen gezet). De lijst noemt precies
   de oude organisatie als treffer, toont gezet en het verval na de afkapping,
   en de uitvoer draagt geen geheim, geen blob en geen vingerafdruk. Het script
   leest alleen: de database is na afloop byte voor byte gelijk. Exitcode 0, ook
   met een treffer -- het is een lijst en geen poort.

   Draai los: node --test test/ssogeheim-ouderdom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssoouderdom-'));
process.env.RTG_DATA_DIR = TMP;
require('../server/accounts').init();
require('../server/sso').zorgTabel();
const S = require('../server/accounts/state');
const cg = require('../server/sso/clientgeheim');
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const DAG = 86400000;
const OP = Date.parse('2026-10-15T00:00:00Z');
const iso = t => new Date(t).toISOString();
const GEHEIM = { oud: 'HERKENBAAR-OUD-7f3a91', vers: 'HERKENBAAR-VERS-2b8c44', gem: 'HERKENBAAR-GEM-90d1e5' };

function rij(org, naam, slot) {
  S.db.prepare(`INSERT INTO sso_koppelingen (org, naam, issuer, client_id, enc_client_secret, domeinen, actief, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)`).run(org, naam, 'https://idp.' + org + '.test', 'c', cg.schrijf([slot]),
    org + '.test', iso(OP));
  return slot;
}
const sloten = [
  rij('oudklant', 'Oude Klant', cg.zegelSlot('oudklant', GEHEIM.oud, { gezet: iso(OP - 120 * DAG), vervalt: iso(OP + 200 * DAG) })),
  rij('versklant', 'Verse Klant', cg.zegelSlot('versklant', GEHEIM.vers, { gezet: iso(OP - 10 * DAG), vervalt: iso(OP + 20 * DAG) })),
  rij('gemklant', 'Gemigreerde Klant', cg.zegelSlot('gemklant', GEHEIM.gem, { vervalt: iso(OP + 60 * DAG), gemigreerd: true }))
];
S.db.prepare(`INSERT INTO sso_koppelingen (org, naam, issuer, client_id, enc_client_secret, domeinen, actief, created_at)
  VALUES ('leegklant', 'Lege Klant', 'https://idp.leeg.test', 'c', NULL, 'leeg.test', 1, ?)`).run(iso(OP));

const draai = (...args) => spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'ssogeheim-ouderdom.js'), ...args],
  { env: { ...process.env, RTG_DATA_DIR: TMP }, encoding: 'utf8' });
// WAL-modus: een schrijfactie landt eerst in rtg.db-wal, dus die telt mee (-shm niet: die
// zet ook een lezer bij)
const hash = () => ['rtg.db', 'rtg.db-wal'].map(f => path.join(TMP, f)).filter(f => fs.existsSync(f))
  .reduce((h, f) => h.update(f).update(fs.readFileSync(f)), crypto.createHash('sha256')).digest('hex');

test('de uitrollijst noemt precies de oude organisatie, en nooit het geheim', () => {
  const voor = hash();
  const uit = draai('--op', '2026-10-15');
  assert.equal(uit.status, 0, 'een lijst, geen poort: ' + uit.stderr);
  const regels = uit.stdout.split('\n');
  const van = org => regels.find(r => r.trim().startsWith(org + ' ')) || '';
  assert.match(van('oudklant'), /Oude Klant\s+2026-06-17\s+2026-09-15\s+verloopt-bij-uitrol$/);
  assert.match(van('versklant'), /2026-10-05\s+2026-11-04\s+in-orde$/);
  assert.match(van('gemklant'), /-\s+2026-12-14\s+gemigreerd$/);
  assert.match(van('leegklant'), /geen-geheim$/);
  assert.match(uit.stdout, /1 organisatie\(s\) verlopen bij de uitrol: oudklant\./);

  const json = JSON.parse(draai('--op', '2026-10-15', '--json').stdout);
  assert.deepEqual(json.koppelingen.filter(k => k.treffer).map(k => k.org), ['oudklant']);
  assert.deepEqual(Object.keys(json.koppelingen[0]).sort(), ['gezet', 'naam', 'org', 'stand', 'treffer', 'vervaltNaAfkapping']);

  for (const tekst of [uit.stdout, JSON.stringify(json), uit.stderr]) {
    for (const g of Object.values(GEHEIM)) assert.equal(tekst.includes(g), false, 'het kale geheim staat in de uitvoer');
    for (const s of sloten) {
      assert.equal(tekst.includes(s.c.slice(0, 24)), false, 'het versleutelde blob staat in de uitvoer');
      assert.equal(tekst.includes(s.vf), false, 'de vingerafdruk staat in de uitvoer');
    }
  }
  assert.equal(hash(), voor, 'het script leest alleen');
});

test('een andere uitroldatum verschuift de lijst; een ongeldige datum zegt waarom', () => {
  // dertig dagen eerder is het oude geheim nog geen 90 dagen oud
  const eerder = JSON.parse(draai('--op', '2026-09-01', '--json').stdout);
  const oud = eerder.koppelingen.find(k => k.org === 'oudklant');
  assert.equal(oud.treffer, false);
  assert.equal(oud.stand, 'afgekapt');
  const fout = draai('--op', 'morgen');
  assert.equal(fout.status, 2);
  assert.match(fout.stderr, /--op 2026-10-15/);
});
