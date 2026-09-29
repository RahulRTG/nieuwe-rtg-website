'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), { randomUUID } = require('node:crypto');
const { Pool } = require('../server/pgwire');
const { startServer, stopHard } = require('./helper');
const bewijs = require('./operationeel-journaal');
const bron = process.env.DATABASE_URL || process.env.PG_URL;
const pauze = ms => new Promise(r => setTimeout(r, ms));

// Het netwerk houdt één echt antwoord vast. De bronserver heeft dan gecommit,
// maar de aanvrager heeft niets ontvangen. Geen nagemaakte bron of succescode.
async function verliesAntwoord(base) {
  let ontvangen, fout;
  const antwoord = new Promise((r, e) => { ontvangen = r; fout = e; });
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const uit = http.request(base + req.url, { method: req.method, headers: { ...req.headers, 'accept-encoding': 'identity' } }, terug => {
      const delen = []; terug.on('data', b => delen.push(b));
      terug.on('end', () => {
        try { ontvangen({ status: terug.statusCode, body: JSON.parse(Buffer.concat(delen).toString()) }); }
        catch (e) { fout(e); }
      });
    });
    uit.on('error', e => { fout(e); res.destroy(e); }); req.pipe(uit);
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: 'http://127.0.0.1:' + server.address().port, antwoord,
    sluit: async () => { for (const s of sockets) s.destroy(); await new Promise(r => server.close(r)); } };
}

// Uitgevoerd als verplichte deelproef van postgres-requestcommit.pg.test.js.
// Geen tweede zelfoverslaande test; de bestaande PG-draaier bezit de dienstgrens.
module.exports = async function bewijsMallPostgres() {
    assert.ok(bron, 'Deze deelproef vereist echte PostgreSQL.');
    const naam = 'rtg_operationeel_' + randomUUID().replace(/-/g, '');
    const beheer = new Pool({ connectionString: bron, max: 2 });
    const doel = new URL(bron); doel.pathname = '/' + naam;
    const pool = new Pool({ connectionString: doel.toString(), max: 3 });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mall-pg-'));
    let A, B, houder, proxy, gemaakt = false;
    const env = { DATABASE_URL: doel.toString(), PG_URL: '', RTG_STORE: 'postgres', SMTP_URL: '',
      RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1', RTG_ENC_KEY: '',
      RTG_SECRET_KEY: 'operationele-proef-'.repeat(4), RTG_VAULT_KEY: 'v'.repeat(64) };
    const api = async (base, pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
      return { http: r.status, ...await r.json() };
    };
    const klaar = async srv => {
      for (let n = 0; n < 100; n++) {
        if ((await fetch(srv.base + '/api/ready')).status === 200) return;
        await pauze(100);
      }
      assert.fail('instance herstelde niet binnen de proefgrens');
    };
    try {
      await beheer.query('CREATE DATABASE ' + naam); gemaakt = true;
      A = await startServer({ env: { ...env, RTG_DATA_DIR: path.join(tmp, 'a') } });
      const lid = (await api(A.base, '/api/auth/register', { name: 'PG Aanvraag', email: 'pg@example.test',
        password: 'geheim123', phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
      assert.ok(lid);
      const roster = await api(A.base, '/api/supplier/roster', { code: 'SERENA' });
      const zaak = (await api(A.base, '/api/supplier/login', { code: 'SERENA', pin: '1234',
        staffId: roster.staff.find(s => s.role === 'manager').id })).token;
      assert.ok(zaak);
      const invoer = { sleutel: 'pg-1', wat: 'Behandeling op zaterdag', plek: 'Ibiza', verdieping: 'beauty' };
      let a = (await api(A.base, '/api/mall/aanvraag', invoer, lid)).aanvraag; assert.ok(a?.id);
      a = (await api(A.base, '/api/supplier/mall/aanvraag/reageer', { id: a.id, versie: a.versie, tekst: 'Zaterdag kan' }, zaak)).aanvraag;
      a = (await api(A.base, '/api/mall/aanvraag/kies', { id: a.id, versie: a.versie, code: 'SERENA' }, lid)).aanvraag;
      a = (await api(A.base, '/api/supplier/mall/aanvraag/behandel', { id: a.id, versie: a.versie, actie: 'aanvaard' }, zaak)).aanvraag;
      assert.equal(a.status, 'in_behandeling');
      B = await startServer({ env: { ...env, RTG_DATA_DIR: path.join(tmp, 'b') } });
      const lees = async srv => {
        await klaar(srv);
        const d = await api(srv.base, '/api/mall/aanvragen/mijn', {}, lid);
        assert.equal(d.http, 200); return d.aanvragen.find(x => x.id === a.id);
      };
      assert.equal((await lees(B)).versie, a.versie);
      houder = await pool.connect(); await houder.query('BEGIN');
      await houder.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['mallAanvragen']);
      const opdracht = { id: a.id, versie: a.versie, actie: 'afronden', tekst: 'Antwoord duurzaam ontvangen uit PostgreSQL.' };
      let bevestigd = false;
      const poging = api(A.base, '/api/supplier/mall/aanvraag/behandel', opdracht, zaak).finally(() => { bevestigd = true; });
      let pid;
      for (let n = 0; n < 100 && !pid; n++) {
        const q = await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%' LIMIT 1", [naam]);
        pid = q.rows[0]?.pid; if (!pid) await pauze(30);
      }
      assert.ok(pid, 'de echte aanvraag bereikte haar opslagcommit');
      assert.equal(bevestigd, false, 'geen bevestiging vóór COMMIT');
      assert.equal((await pool.query('SELECT pg_terminate_backend($1) AS ok', [pid])).rows[0].ok, true);
      assert.equal((await poging).http, 503);
      await houder.query('ROLLBACK'); houder.release(); houder = null;
      const voor = await lees(B); assert.equal(voor.versie, a.versie); assert.equal(voor.resultaat, null);
      await klaar(A);
      proxy = await verliesAntwoord(A.base);
      const verloren = api(proxy.base, '/api/supplier/mall/aanvraag/behandel', opdracht, zaak).catch(e => e);
      const gezien = await Promise.race([proxy.antwoord, pauze(10000).then(() => { throw Error('geen gecommit antwoord'); })]);
      assert.equal(gezien.status, 200); assert.equal(gezien.body.aanvraag.versie, a.versie + 1);
      await stopHard(A.child); A = null; await proxy.sluit(); proxy = null;
      assert.ok(await verloren instanceof Error, 'aanvrager heeft geen bevestiging ontvangen');
      await klaar(B);
      const retry = await api(B.base, '/api/supplier/mall/aanvraag/behandel', opdracht, zaak);
      assert.equal(retry.http, 200); assert.equal(retry.aanvraag.versie, a.versie + 1);
      assert.equal(retry.aanvraag.verloop.filter(v => v.actie === 'afronden').length, 1);
      A = await startServer({ env: { ...env, RTG_DATA_DIR: path.join(tmp, 'a') } });
      assert.deepEqual((await lees(A)).resultaat, retry.aanvraag.resultaat);
      const heropen = { id: a.id, versie: retry.aanvraag.versie };
      const samen = await Promise.all([A, B].map(s => api(s.base, '/api/mall/aanvraag/heropen', heropen, lid)));
      assert.ok(samen.some(x => x.http === 200)); assert.ok(samen.every(x => [200, 409].includes(x.http)));
      await klaar(A); await klaar(B);
      const terug = await lees(A); assert.equal(terug.versie, heropen.versie + 1);
      assert.equal(terug.verloop.filter(v => v.actie === 'heropen').length, 1);
      const feed = await api(A.base, '/api/wereld/feed', { ervaring: 'saloon', bronnen: ['voortgang'], vorm: 'mijn', lens: 'all' }, lid);
      assert.equal(feed.http, 200); assert.equal(feed.items[0].bronversie, terug.versie);
      assert.ok(!feed.items.some(x => x.tekst === opdracht.tekst));
      bewijs('mall-postgres', ['STATE', 'FAILURE', 'RECOVERY', 'REPLAY'],
        { grens: 'Echte PostgreSQL, backend kill onder collectieslot, geen half resultaat, twee app-instances, verloren netwerkantwoord, SIGKILL/herstart en gelijktijdige identieke opdracht.' });
    } finally {
      if (houder) { await houder.query('ROLLBACK').catch(() => {}); houder.release(); }
      if (proxy) await proxy.sluit();
      if (A) await stopHard(A.child); if (B) await stopHard(B.child);
      await pool.end();
      if (gemaakt) await beheer.query('DROP DATABASE ' + naam + ' WITH (FORCE)');
      await beheer.end(); fs.rmSync(tmp, { recursive: true, force: true });
    }
};
