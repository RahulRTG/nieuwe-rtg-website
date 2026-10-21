'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard } = require('./helper');
const { equal: eq, deepEqual: same, notEqual: anders, ok, match, doesNotMatch } = assert;
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = require('./infra').vereist('pg', !!URL, 'aanvraagontvangsten vereisen echte PostgreSQL-workers');
test('aanvraag: workers, ontvangst en herstel', { skip, timeout: 240000 }, async t => {
 const iso = await require('./lib/living-world-pg-database')(URL), workers = [];
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanmelding-workers-'));
 const { Pool } = require('../server/pgwire'), pool = new Pool({ connectionString: iso.url, max: 1 });
 const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres', RTG_ENC_KEY: '',
  RTG_VAULT_KEY: crypto.randomBytes(32).toString('hex'), RTG_SECRET_KEY: crypto.randomBytes(32).toString('hex'),
  RTG_OWNER_EMAIL: 'aanvraag-owner@fixture.test', DEMO_PASS: 'AanvraagFixture123!', SMTP_URL: '',
  STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
 async function start(naam, meer = {}) {
  const w = await startServer({ env: { ...env, ...meer, RTG_DATA_DIR: path.join(tmp, naam) } });
  workers.push(w); return w;
 }
 const sluit = w => stopHard(w.child);
 async function api(w, pad, body = {}, token) {
  const r = await fetch(w.base + '/api/' + pad, { method: 'POST',
   headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
   body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: await r.json() };
 }
 const maak = (meer = {}) => ({ idem: crypto.randomUUID(), pas: 'rtg', naam: 'Anonieme Aanvrager',
  contact: 'anon-aanvraag@fixture.test', ...meer });
 const pad = 'aanmelding/aanvraag';
 const vraag = (w, body, token) => api(w, pad, body, token);
 function goed(r) { eq(r.status, 200, JSON.stringify(r)); return r.body; }
 function compact(r) {
  same(Object.keys(r).sort(), ['ok', 'ontvangst']); eq(r.ok, true);
  same(Object.keys(r.ontvangst).sort(), ['aanvraagId', 'at', 'id', 'status']);
  eq(r.ontvangst.status, 'ontvangen'); ok(Number.isFinite(Date.parse(r.ontvangst.at)));
  for (const k of ['id', 'aanvraagId']) match(r.ontvangst[k], /^[a-f0-9-]{36}$/i);
 }
 async function lees() {
  const { rows } = await pool.query("SELECT key,val FROM kv WHERE key IN ('aanmeldingen','aanmeldingOntvangsten') AND NOT weg ORDER BY key");
  return Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.val)]));
 }
 const receipts = d => Object.values(d.aanmeldingOntvangsten.ontvangsten);
 const minimaal = { status: 410, code: 'AANVRAAG_INTENTIE_VERBRUIKT', ontvangst: { status: 'alVerwerkt' } };
 const verlopen = r => { eq(r.status, 410); same(r.body, minimaal); };
 try {
  const a = await start('a'), b = await start('b'), body = maak(); let eerste;
  await t.test('UUID en anonieme race: één commit', async () => {
   for (const idem of [undefined, 'vrije-sleutel', crypto.randomUUID().replace(/-/g, '')])
    eq((await vraag(a, { ...body, idem })).status, 400);
   const voor = await lees(); eq((voor.aanmeldingen || []).length, 0);
   const race = await Promise.all([vraag(a, body), vraag(b, body)]);
   eerste = goed(race[0]); compact(eerste); same(goed(race[1]), eerste);
   const d = await lees(); eq(d.aanmeldingen.length, 1); eq(receipts(d).length, 1);
   eq(d.aanmeldingen[0].id, eerste.ontvangst.aanvraagId);
   eq(d.aanmeldingen[0].accountId, null);
   same(receipts(d)[0].ontvangst, eerste.ontvangst);
   doesNotMatch(JSON.stringify(d.aanmeldingOntvangsten), /Anonieme Aanvrager|anon-aanvraag@|contact|naam/);
  });
  let owner, kantoor;
  await t.test('bevoegd dossier; exact compacte replay', async () => {
   owner = goed(await api(a, 'auth/login', { login: env.RTG_OWNER_EMAIL, password: env.DEMO_PASS })).token;
   ok(owner); goed(await api(a, 'auth/me', {}, owner));
   kantoor = goed(await api(a, 'account/start', { rol: 'kantoor' }, owner)).token; ok(kantoor);
   const id = eerste.ontvangst.aanvraagId, notitie = 'GEHEIME_KANTOOR_NOTITIE';
   const d = goed(await api(a, 'aanmelding/een', { id }, kantoor));
   eq(d.aanmelding.naam, body.naam);
   goed(await api(a, 'aanmelding/beslis', { id, besluit: 'afgewezen', notitie }, kantoor));
   const na = goed(await api(a, 'aanmelding/een', { id }, kantoor));
   eq(na.aanmelding.besluit.notitie, notitie);
   same(goed(await vraag(b, body)), eerste);
   eq((await vraag(b, { ...body, contact: 'andere@fixture.test' })).status, 409);
   const nieuw = goed(await vraag(a, { ...body, idem: crypto.randomUUID() })); compact(nieuw);
   anders(nieuw.ontvangst.aanvraagId, id);
   const eigen = goed(await vraag(a, body, owner)); anders(eigen.ontvangst.aanvraagId, id);
   same(goed(await vraag(b, { ...body, accountId: 123456789 })), eerste);
   const voor = await lees(); eq(voor.aanmeldingen.length, 3); eq(receipts(voor).length, 3);
   eq((await vraag(b, body, 'ongeldig-token')).status, 401);
   same(await lees(), voor, 'ongeldige auth blijft geweigerd');
  });
  await t.test('tweede write faalt: gezamenlijke rollback', async () => {
   const voor = await lees(), invoer = maak();
   await pool.query("CREATE FUNCTION aanvraag_weiger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key='aanmeldingOntvangsten' THEN RAISE EXCEPTION 'test ontvangstcommit geweigerd'; END IF; RETURN NEW; END $$");
   await pool.query('CREATE TRIGGER aanvraag_weiger BEFORE INSERT OR UPDATE ON kv FOR EACH ROW EXECUTE FUNCTION aanvraag_weiger()');
   try { eq((await vraag(b, invoer)).status, 503); }
   finally { await pool.query('DROP TRIGGER aanvraag_weiger ON kv'); await pool.query('DROP FUNCTION aanvraag_weiger()'); }
   same(await lees(), voor);
   const retry = goed(await vraag(a, invoer)); compact(retry);
   let gezond;
   for (const eind = Date.now() + 10000; Date.now() < eind;) {
    const r = await fetch(b.base + '/api/ready', { signal: AbortSignal.timeout(2000) });
    gezond = await r.json();
    if (r.status === 200 && gezond.ready && gezond.writeHealthy) break;
    await new Promise(r => setTimeout(r, 25));
   }
   ok(gezond?.ready && gezond.writeHealthy, JSON.stringify(gezond));
   same(goed(await vraag(b, invoer)), retry);
   const na = await lees(); eq(na.aanmeldingen.length, voor.aanmeldingen.length + 1);
   eq(receipts(na).length, receipts(voor).length + 1);
  });
  await sluit(a); await sluit(b);
  await t.test('sleutelwissel weigert; herstel bewaart bewijs', async () => {
   const voor = await lees(), ander = await start('andere-sleutel', { RTG_SECRET_KEY: crypto.randomBytes(32).toString('hex') });
   eq((await vraag(ander, body)).status, 503);
   eq((await vraag(ander, maak())).status, 503);
   same(await lees(), voor); await sluit(ander);
   const herstart = await start('herstart');
   same(goed(await vraag(herstart, body)), eerste); await sluit(herstart);
  });
  await t.test('5000-evictie en herstart hercreëren nooit', async () => {
   // Workers stil; HTTP veroorzaakt daarna de evictie.
   const d = await lees(), id = eerste.ontvangst.aanvraagId;
   const oud = d.aanmeldingen.find(x => x.id === id), rest = d.aanmeldingen.filter(x => x.id !== id);
   ok(oud);
   const vulling = Array.from({ length: 4999 - rest.length }, (_, i) => ({ id: 'venster-' + i }));
   await pool.query("UPDATE kv SET val=$1,ver=nextval('kv_ver_seq') WHERE key='aanmeldingen'", [JSON.stringify([...rest, ...vulling, oud])]);
   const w = await start('venster'), nieuw = goed(await vraag(w, maak())); compact(nieuw);
   let na = await lees(); eq(na.aanmeldingen.length, 5000);
   eq(na.aanmeldingen.some(x => x.id === id), false);
   verlopen(await vraag(w, body));
   na = await lees(); eq(receipts(na).filter(r => r.geredigeerd).length, 1);
   eq(receipts(na).some(r => r.ontvangst?.aanvraagId === id), false);
   await sluit(w); const vers = await start('na-venster');
   verlopen(await vraag(vers, { ...body, naam: 'Andere inhoud na opruiming' }));
   same(await lees(), na); await sluit(vers);
  });
  await t.test('accountwissing redigeert eigen en anonieme receipts', async () => {
   const w = await start('privacy'), email = 'vergeet-aanvraag@fixture.test';
   const reg = goed(await api(w, 'auth/register', { name: 'Wisbare Aanvrager', email, phone: '0612345678',
    password: 'VergeetFixture123!', geboortedatum: '1988-05-05', tier: 'rtg', pasApp: 'rtg' }));
   ok(reg.token); const me = goed(await api(w, 'auth/me', {}, reg.token)); ok(me.user.id);
   const eigenBody = maak({ contact: email, naam: 'Wisbare Aanvrager' });
   const anonBody = maak({ contact: email, naam: 'Wisbare Aanvrager' });
   const eigen = goed(await vraag(w, eigenBody, reg.token)), anon = goed(await vraag(w, anonBody));
   const ids = [eigen.ontvangst.aanvraagId, anon.ontvangst.aanvraagId];
   const voor = await lees(); eq(receipts(voor).filter(r => ids.includes(r.ontvangst?.aanvraagId)).length, 2);
   goed(await api(w, 'privacy/delete', {}, reg.token));
   const na = await lees();
   eq(receipts(na).some(r => ids.includes(r.ontvangst?.aanvraagId)), false);
   eq(receipts(na).filter(r => r.geredigeerd).length, receipts(voor).filter(r => r.geredigeerd).length + 2);
   for (const rij of na.aanmeldingen.filter(x => ids.includes(x.id))) {
    eq(rij.contact, ''); eq(rij.accountId, null); anders(rij.naam, 'Wisbare Aanvrager');
   }
   verlopen(await vraag(w, anonBody));
   const naWissing = await lees(); eq((await vraag(w, eigenBody, reg.token)).status, 401);
   same(await lees(), naWissing); await sluit(w);
   const vers = await start('na-privacy');
   verlopen(await vraag(vers, anonBody)); same(await lees(), naWissing);
  });
 } finally {
  for (const w of workers) await sluit(w);
  await pool.end(); await iso.close(); fs.rmSync(tmp, { recursive: true, force: true });
 }
});
