/* ============================================================================
   HET AUDITSPOOR IN POSTGRESQL, TEGEN EEN ECHTE SERVER EN EEN ECHTE DATABASE
   (audit P0-1, P1-2, P1-3, P1-4).

   1. ATOMAIR. Een trigger laat UITSLUITEND de auditschrijf falen (kv-rijen
      handelingLog en apiSpoor). De kascode is een collectietransactie die
      midden in het verzoek commit; vroeger stond hij daarna vast terwijl het
      verzoek 503 gaf en het handelingLog niet veranderde. Nu: geen 2xx, geen
      kascode, geen regel -- het spoor gaat mee in dezelfde transactie
      (server/db/verzoekspoor.js).
   2. VERVALSEN. Een regel midden in het spoor wijzigen, zijn hash weghalen of
      een regel wissen: de volgende schrijfhandeling krijgt 503 met de reden
      `auditspoor-gebroken` (geen stille 409), de mutatie staat niet vast, en
      het ALARM `auditspoor-gebroken` staat actief in PostgreSQL.
   3. ANKER. De kop afknippen of het hele spoor herberekenen (elke hash weer
      geldig) valt lokaal niet op, tegen het getekende anker wel.

   MUTATIES GEZIEN ZAKKEN (zie het commitbericht): zonder `spoor` in
   pg/collectietransactie.js zakt 1 ("de kascode staat NIET vast"); met de oude
   `conflict()` voor een gebroken keten in pg/verzoeksporen.js zakt 2 (409).
   Zonder DATABASE_URL slaat hij zichzelf over, zoals elke pg-proef.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('auditspoor in PostgreSQL: atomair met de mutatie, vervalsing wordt 503 + alarm, anker ziet herschrijving',
  { skip: OVERSLAAN, timeout: 180000 }, async (t) => {
    const { startServer, stop, verwachtServerfout } = require('./helper');
    /* De geinjecteerde triggerfout is een echte opslagstoring van de
       collectietransactie en hoort als zodanig in het log. */
    verwachtServerfout(/audit-schrijfactie faalt \(geinjecteerd\)/, 'de trigger van toets 1b laat de auditschrijf falen');
    const { Pool } = require('../server/pgwire');
    const kluis = require('../server/kluis');
    const keten = require('../server/lib/keten');
    const { maakAnkerdienst } = require('../server/lib/ankerdienst');
    const pool = new Pool({ connectionString: URL, max: 2 });
    const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-auditpg-'));
    const env = { DATABASE_URL: URL, PG_URL: '', RTG_STORE: 'postgres', SMTP_URL: '', RTG_AI_UIT: '1',
      RTG_PUSH_UIT: '1', RTG_ENC_KEY: '', RTG_SECRET_KEY: 'audit-pg-proef-sleutel-'.repeat(3),
      RTG_VAULT_KEY: 'v'.repeat(64), RTG_DATA_DIR: map };
    const A = await startServer({ env });
    const api = async (pad, body, token) => {
      const r = await fetch(A.base + pad, { method: 'POST', headers: { 'content-type': 'application/json',
        authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { http: r.status, ...(j || {}) };
    };
    const lees = async k => {
      const r = await pool.query('SELECT val FROM kv WHERE key=$1 AND NOT weg', [k]);
      return r.rows[0] ? JSON.parse(kluis.ontsleutel(r.rows[0].val)) : undefined;
    };
    const ruw = async k => { const r = await pool.query('SELECT ver FROM kv WHERE key=$1', [k]); return r.rows[0] ? String(r.rows[0].ver) : null; };
    const schrijf = async (k, v) => {
      await pool.query("UPDATE kv SET val=$2, ver=nextval('kv_ver_seq') WHERE key=$1", [k, kluis.versleutel(JSON.stringify(v))]);
      await pool.query("SELECT pg_notify('rtg_kv', $1)", [k]).catch(() => {});
    };
    const wacht = ms => new Promise(r => setTimeout(r, ms));
    const verwijderTrigger = () => pool.query('DROP TRIGGER IF EXISTS weiger_audit ON kv').catch(() => {});
    try {
      const reg = await api('/api/auth/register', { name: 'Audit Proef', email: 'auditpg@example.test',
        password: 'geheim123', phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' });
      const token = reg.token;
      assert.ok(token, JSON.stringify(reg));

      await t.test('1a. controle: een kascode laat in DEZELFDE commit een regel `vastgelegd` achter', async () => {
        const k = await api('/api/pay/kascode', { maxCenten: 1000, idem: 'k0' }, token);
        assert.equal(k.http, 200, JSON.stringify(k));
        const h = await lees('handelingLog');
        const v = h.find(r => r.pad === '/api/pay/kascode' && r.stand === 'vastgelegd' && /payKasToegang/.test(r.collecties || ''));
        assert.ok(v, 'regel vastgelegd: ' + JSON.stringify(h.slice(0, 4)));
        assert.match(v.collecties, /payKasToegang/);
        assert.ok(v.verzoek, 'met het verzoek-id (P2-7)');
        assert.ok(h.some(r => r.pad === '/api/pay/kascode' && r.status === 200), 'en de eindregel');
        assert.equal(keten.verifieer(h).ok, true);
      });

      await t.test('1b. faalt UITSLUITEND de auditschrijf, dan geen 2xx en geen vastgelegde kascode', async () => {
        const kasVoor = await ruw('payKasToegang'), hVoor = JSON.stringify(await lees('handelingLog'));
        await pool.query(`CREATE OR REPLACE FUNCTION weiger_audit() RETURNS trigger AS $$
          BEGIN RAISE EXCEPTION 'audit-schrijfactie faalt (geinjecteerd)'; END $$ LANGUAGE plpgsql`);
        await verwijderTrigger();
        await pool.query(`CREATE TRIGGER weiger_audit BEFORE UPDATE ON kv FOR EACH ROW
          WHEN (NEW.key IN ('handelingLog','apiSpoor')) EXECUTE FUNCTION weiger_audit()`);
        const k = await api('/api/pay/kascode', { maxCenten: 2000, idem: 'k1' }, token);
        await verwijderTrigger();
        assert.ok(k.http < 200 || k.http >= 300, 'geen 2xx: ' + k.http + ' ' + JSON.stringify(k));
        assert.equal(await ruw('payKasToegang'), kasVoor, 'de kascode staat NIET vast');
        assert.equal(JSON.stringify(await lees('handelingLog')), hVoor, 'en het spoor is ongemoeid');
      });

      /* Een paar gewone handelingen erbij, zodat er een midden is. */
      for (let i = 0; i < 3; i++) {
        await wacht(300);
        const k = await api('/api/pay/kascode', { maxCenten: 3000 + i, idem: 'v' + i }, token);
        assert.equal(k.http, 200, 'na de storing loopt het weer: ' + JSON.stringify(k));
      }
      const goed = await lees('handelingLog');
      assert.equal(keten.verifieer(goed).ok, true);
      const anker = maakAnkerdienst({ db: { data: { handelingLog: goed } }, sleutel: () => Buffer.alloc(32, 1), omgeving: {} });
      const buiten = anker.blok();

      const vervalsing = async (naam, maak) => {
        await t.test('2. ' + naam + ': 503 met de reden, geen mutatie, en een actief alarm', async () => {
          await schrijf('handelingLog', maak(JSON.parse(JSON.stringify(goed))));
          await wacht(1500);
          const kasVoor = await ruw('payKasToegang');
          const k = await api('/api/pay/kascode', { maxCenten: 4000, idem: 'na-' + naam }, token);
          assert.equal(k.http, 503, 'geen stille 409: ' + JSON.stringify(k));
          assert.equal(k.reden, 'auditspoor-gebroken');
          assert.equal(k.journaal, 'handelingLog');
          assert.equal(await ruw('payKasToegang'), kasVoor, 'de mutatie staat niet vast');
          let alarm = null;
          for (let i = 0; i < 40 && !(alarm && alarm.actief); i++) {
            await wacht(250);
            alarm = ((await lees('commandAlarmen')) || {})['auditspoor-gebroken'];
          }
          assert.ok(alarm && alarm.actief, 'het alarm staat actief in PostgreSQL: ' + JSON.stringify(alarm));
          assert.equal(alarm.ernst, 'hoog');
          assert.match(alarm.wat, /handelingLog/);
        });
      };
      await vervalsing('midden gewijzigd', l => { l[2] = { ...l[2], wie: 'iemand-anders' }; return l; });
      await vervalsing('midden gewijzigd en hash weggehaald', l => { const r = { ...l[2], wie: 'iemand-anders' }; delete r.hash; l[2] = r; return l; });
      await vervalsing('regel gewist', l => { l.splice(2, 1); return l; });

      await t.test('3. kop afknippen en volledig herberekenen: lokaal heel, tegen het getekende anker niet', async () => {
        const kop = goed.slice(2);
        await schrijf('handelingLog', kop);
        assert.equal(keten.verifieer(await lees('handelingLog')).ok, true, 'de afgeknipte keten klopt lokaal');
        const r1 = maakAnkerdienst({ db: { data: { handelingLog: await lees('handelingLog') } }, sleutel: () => Buffer.alloc(32, 1), omgeving: {} }).reken(buiten);
        assert.equal(r1.ok, false); assert.equal(r1.perJournaal.handelingLog.ingekort, true);
        const nieuw = [];
        for (const r of goed.slice().reverse()) {
          const { hash, vorige, nr, ...kern } = r;
          if (r === goed[goed.length - 1]) kern.wie = 'herschreven';
          keten.noteerIn(nieuw, kern, 50000);
        }
        await schrijf('handelingLog', nieuw);
        const terug = await lees('handelingLog');
        assert.equal(keten.verifieer(terug).ok, true, 'elke hash is weer geldig');
        const r2 = maakAnkerdienst({ db: { data: { handelingLog: terug } }, sleutel: () => Buffer.alloc(32, 1), omgeving: {} }).reken(buiten);
        assert.equal(r2.ok, false); assert.equal(r2.perJournaal.handelingLog.herschreven, true);
        assert.equal(r2.ondertekend, true, 'het anker zelf is van ons getekend');
      });
    } finally {
      await verwijderTrigger();
      stop(A);
      await pool.end();
      try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
    }
  });
