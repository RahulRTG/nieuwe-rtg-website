/* B21 (deur partnerkanaal.personeels_en_partnercode): de oude, zelfgekozen
   `partner.staff.code` wordt bij de opslagstart uit de opslag gewist, met een
   telling in het log en een stempel op de partner, nooit met de code zelf.
   Toets 1-3 op de module, toets 4 tegen een echte server die drie keer op
   dezelfde JSON-opslag start (de code erin, eruit, en een herhaling doet niets).
   PostgreSQL (twee instances, en een echte server): test/partnerpersoneelscode.pg.test.js.
   Draai los: node --test test/partnerpersoneelscode-migratie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const maak = require('../server/kern/partnerpersoneelscode-migratie');

const OUD = 'ATLAS-KANTOOR-2024';
// dezelfde vorm als de lokale bewerkCollectie (db/collectie-bewerken.js)
function lokaal(data) {
  let schrijf = 0;
  const bewerkCollectie = (sleutel, werk) => {
    const w = JSON.parse(JSON.stringify(data[sleutel] == null ? {} : data[sleutel]));
    const voor = JSON.stringify(w);
    const uit = werk(w);
    if (JSON.stringify(w) !== voor) { data[sleutel] = w; schrijf++; }
    return uit;
  };
  return { bewerkCollectie, schrijf: () => schrijf };
}
const partners = () => [
  { code: 'NOVA', name: 'Nova', share: 0.4 },
  { code: 'ATLAS', name: 'Atlas', share: 0.35, staff: { serviceRate: 0, code: OUD } },
  { code: 'ORION', name: 'Orion', staff: { serviceRate: 0.02, code: '' } }
];

test('1. de oude code gaat weg, het tarief blijft, en de partner krijgt een stempel', () => {
  const data = { partners: partners() };
  const regels = [];
  const m = maak({ bewerkCollectie: lokaal(data).bewerkCollectie, nu: () => Date.UTC(2026, 9, 4),
    log: (msg, v) => regels.push(msg + ' ' + JSON.stringify(v)) });
  const r = m.migreerOudeCodes();
  assert.deepEqual(r, { ok: true, gewist: 2, partners: 3 });
  assert.ok(!JSON.stringify(data).includes(OUD), 'de code staat nergens meer in de opslag');
  for (const p of data.partners.filter(x => x.staff)) {
    assert.ok(!('code' in p.staff), p.code + ': geen veld code meer');
    assert.equal(p.staff.oude_code_gewist_at, '2026-10-04T00:00:00.000Z');
  }
  assert.equal(data.partners[1].staff.serviceRate, 0, 'het personeelstarief blijft');
  assert.deepEqual(data.partners[0], { code: 'NOVA', name: 'Nova', share: 0.4 }, 'een partner zonder kanaal blijft onaangeroerd');
  assert.equal(regels.length, 1);
  assert.match(regels[0], /"partners":2/, 'het spoor is een telling');
  assert.ok(!regels[0].includes(OUD), 'en draagt nooit de code');
});

test('2. herhalen doet niets: geen schrijfactie, geen nieuwe stempel, geen logregel', () => {
  const data = { partners: partners() };
  const l = lokaal(data);
  const regels = [];
  let t = Date.UTC(2026, 9, 4);
  const m = maak({ bewerkCollectie: l.bewerkCollectie, nu: () => t, log: x => regels.push(x) });
  m.migreerOudeCodes();
  const na = JSON.stringify(data);
  t += 86400000;
  assert.deepEqual(m.migreerOudeCodes(), { ok: true, gewist: 0, partners: 3 });
  assert.equal(JSON.stringify(data), na, 'de tweede ronde verandert niets, ook de stempel niet');
  assert.equal(l.schrijf(), 1, 'en schrijft dus niets');
  assert.equal(regels.length, 1);
});

test('3. fail-closed: zonder collectietransactie of op een vreemde vorm weigert hij; PG-vorm geeft een Promise', async () => {
  assert.throws(() => maak({}).migreerOudeCodes(), /collectietransactie/);
  assert.throws(() => maak({ bewerkCollectie: lokaal({ partners: 'x' }).bewerkCollectie }).migreerOudeCodes(),
    /lijst/);
  assert.deepEqual(maak({ bewerkCollectie: lokaal({}).bewerkCollectie }).migreerOudeCodes(),
    { ok: true, gewist: 0, partners: 0 }, 'geen partners: niets te doen');
  const data = { partners: partners() };
  const l = lokaal(data);
  const regels = [];
  const p = maak({ bewerkCollectie: (s, w) => Promise.resolve().then(() => l.bewerkCollectie(s, w)),
    log: x => regels.push(x) }).migreerOudeCodes();
  assert.equal(typeof p.then, 'function', 'op PostgreSQL wacht server.js op de commit');
  assert.equal((await p).gewist, 2);
  assert.equal(regels.length, 1, 'het spoor volgt na de commit');
});

test('4. echte server: bij de opslagstart is de oude code weg, het kantoor ziet wanneer, en een herstart doet niets',
  { timeout: 240000 }, async () => {
    const { startServer, stopNet, kantoorAlsPersoon } = require('./helper');
    const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-b21-'));
    const env = { SMTP_URL: '', RTG_DATA_DIR: map, RTG_STORE: 'json', OFFICE_CODE: 'B21-KANTOOR' };
    const DB = path.join(map, 'db.json');
    let srv;
    const overzicht = async () => {
      const eig = await kantoorAlsPersoon(srv.base, 'B21-KANTOOR');
      const r = await fetch(srv.base + '/api/office/partnerkanaal/personeelscodes', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + eig },
        body: JSON.stringify({ partner: 'ATLAS' }) });
      assert.equal(r.status, 200);
      return r.json();
    };
    try {
      srv = await startServer({ env });
      await stopNet(srv.child);
      const data = JSON.parse(fs.readFileSync(DB, 'utf8'));
      const atlas = data.partners.find(p => p.code === 'ATLAS');
      atlas.staff.code = OUD;
      fs.writeFileSync(DB, JSON.stringify(data));

      srv = await startServer({ env });
      const o = await overzicht();
      assert.equal(o.oudeKaleCode, false, 'na de start staat er geen oude code meer');
      assert.match(String(o.oudeCodeGewistOp), /^\d{4}-\d\d-\d\dT/, 'en het kantoor ziet wanneer hij gewist is');
      const staff = await fetch(srv.base + '/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffCode: OUD }) });
      assert.equal(staff.status, 404, 'de oude code opent niets');
      await stopNet(srv.child);
      const na = fs.readFileSync(DB, 'utf8');
      assert.ok(!na.includes(OUD), 'de oude code staat niet meer in db.json');
      const stempel = JSON.parse(na).partners.find(p => p.code === 'ATLAS').staff.oude_code_gewist_at;
      assert.equal(stempel, o.oudeCodeGewistOp);

      srv = await startServer({ env });
      assert.equal((await overzicht()).oudeCodeGewistOp, stempel, 'een herhaalde start zet geen nieuwe stempel');
    } finally {
      if (srv) await stopNet(srv.child);
      try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
    }
  });

