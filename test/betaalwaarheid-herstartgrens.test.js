'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { fork } = require('node:child_process');
const BASIS = Date.parse('2026-11-13T10:00:00.000Z'), uur = 3600000;

function fixture(t) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bw-herstart-'));
  const children = [], cache = new Map(), posts = [], gets = [];
  let tijd = BASIS, charges = 0, verlies = false, pending = false;
  t.after(async () => {
    await Promise.all(children.map(p => new Promise(resolve => {
      if (p.exitCode !== null || p.signalCode) return resolve();
      p.once('exit', resolve); p.kill('SIGKILL');
    })));
    fs.rmSync(map, { recursive: true, force: true });
  });
  async function worker() {
    const p = fork(path.join(__dirname, 'lib/betaalwaarheid-herstartkind.cjs'), [], {
      env: { ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: map, DATABASE_URL: '', PG_URL: '',
        RTG_STORE: 'sqlite', RTG_SECRET_KEY: '17'.repeat(32), RTG_VAULT_KEY: '29'.repeat(32), RTG_VAULT_RING: '' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.push(p); let nr = 0, fout = ''; const wacht = new Map();
    p.stderr.on('data', x => { fout += x; }); p.stdout.resume();
    const klaar = new Promise((resolve, reject) => {
      p.on('error', reject); p.once('exit', n => {
        const e = Error('SQLite-testworker stopte: ' + n + ' ' + fout);
        reject(e); for (const x of wacht.values()) x.reject(e);
      });
      p.on('message', m => {
        if (m.ready) return resolve();
        if (m.provider) {
          let result;
          if (m.soort === 'post') {
            posts.push(m.args); const k = m.args.idempotentieSleutel, oud = cache.get(k);
            // Protocolmodel van Stripe API v1: na >=24 uur MAG de sleutel weg.
            if (oud && tijd - oud.at < 24 * uur) result = oud.result;
            else {
              result = { id: 'pi_attempt_' + (++charges), aanbieder: 'stripe', status: pending ? 'processing' : 'succeeded',
                bedrag: m.args.bedrag, valuta: m.args.valuta, referentie: m.args.referentie };
              cache.set(k, { at: tijd, result });
            }
          } else {
            gets.push(m.args); result = [...cache.values()].find(x => x.result.id === m.args.id)?.result;
            if (result) result = { ...result, status: 'succeeded' };
          }
          p.send({ provider: m.provider, result, error: verlies && m.soort === 'post' ? 'Antwoord na providercommit weg' : undefined });
          return;
        }
        const x = wacht.get(m.nr); if (!x) return; wacht.delete(m.nr);
        if (m.error) x.reject(Object.assign(Error(m.error.message), { code: m.error.code })); else x.resolve(m.result);
      });
    });
    await klaar;
    return (op, args = {}) => new Promise((resolve, reject) => {
      const id = ++nr; wacht.set(id, { resolve, reject }); p.send({ nr: id, op, at: new Date(tijd).toISOString(), ...args });
    });
  }
  return { worker, posts, gets, charges: () => charges, at: n => { tijd = BASIS + n * uur; },
    verlies: x => { verlies = x; }, pending: x => { pending = x; } };
}

test('oude SQLite-worker leest bevestiging vóór globale ronde/start na 25 uur: geen tweede POST', async t => {
  const f = fixture(t), a = await f.worker(), r = await a('prepare'), b = await f.worker();
  assert.equal((await b('snapshot', { id: r.id })).r.providerId, null);
  await a('begin', { id: r.id }); f.at(25);
  await b('round'); await b('begin', { id: r.id });
  assert.equal(f.posts.length, 1); assert.equal(f.charges(), 1);
  assert.equal((await b('snapshot', { id: r.id })).r.providerId, 'pi_attempt_1');
});

test('onbekende providercommit na 25 uur: controle nodig zonder tweede POST', async t => {
  const f = fixture(t), a = await f.worker(), r = await a('prepare'), b = await f.worker();
  f.verlies(true); await assert.rejects(a('begin', { id: r.id })); f.at(25); f.verlies(false);
  await b('round'); const s = await b('snapshot', { id: r.id });
  assert.equal(f.posts.length, 1); assert.equal(f.charges(), 1);
  assert.equal(s.r.status, 'CONTROLE_NODIG'); assert.equal(s.r.providerId, null);
  assert.equal(s.open.controleNodig, 1);
  await assert.rejects(b('begin', { id: r.id }), { code: 'BETAAL_PROVIDER_HERSTART_ONZEKER' });
  assert.equal(f.posts.length, 1);
});

test('oude SQLite-worker binnen 23 uur herhaalt exact dezelfde opdracht/sleutel', async t => {
  const f = fixture(t), a = await f.worker(), r = await a('prepare'), b = await f.worker();
  f.verlies(true); await assert.rejects(a('begin', { id: r.id })); f.at(22); f.verlies(false);
  await b('round');
  assert.equal(f.posts.length, 2); assert.deepEqual(f.posts[1], f.posts[0]); assert.equal(f.charges(), 1);
  assert.equal((await b('snapshot', { id: r.id })).r.status, 'BEVESTIGD');
});

test('bekende PI na 25 uur blijft via GET herstelbaar', async t => {
  const f = fixture(t), a = await f.worker(), r = await a('prepare'); f.pending(true);
  await a('begin', { id: r.id }); f.at(25); await a('begin', { id: r.id });
  assert.equal(f.posts.length, 1); assert.equal(f.gets.length, 1); assert.equal(f.charges(), 1);
  assert.equal((await a('snapshot', { id: r.id })).r.status, 'BEVESTIGD');
});

test('herhaalde PROVIDER_START reset de eerste horizon niet', async t => {
  const f = fixture(t), a = await f.worker(), r = await a('prepare'); f.verlies(true);
  await assert.rejects(a('begin', { id: r.id })); f.at(22);
  await assert.rejects(a('begin', { id: r.id })); f.at(24.5); f.verlies(false);
  await assert.rejects(a('begin', { id: r.id }), { code: 'BETAAL_PROVIDER_HERSTART_ONZEKER' });
  assert.equal(f.posts.length, 2); assert.equal(f.charges(), 1);
});

test('recurring zonder betrouwbare eerste starttijd weigert; exact 23 uur blijft dicht', () => {
  const { STATUS } = require('../server/kern/betaalwaarheid/staten');
  const grens = require('../server/kern/betaalwaarheid/herstartgrens')({ STATUS,
    nuIso: () => new Date(BASIS + 23 * uur).toISOString(), save() {}, naar: (r, s) => { r.status = s; } });
  for (const at of [null, 'ongeldig', new Date(BASIS).toISOString(), new Date(BASIS + 24 * uur).toISOString()]) {
    const r = { status: STATUS.AANGEMAAKT, start: { aanbieder: 'stripe', terugkerend: { modus: 'innen' } },
      gebeurtenissen: at === null ? [] : [{ soort: 'PROVIDER_START', at }] };
    assert.throws(() => grens(r, false), { code: 'BETAAL_PROVIDER_HERSTART_ONZEKER' });
    assert.equal(r.status, STATUS.CONTROLE_NODIG);
  }
  const r = { status: STATUS.AANGEMAAKT, start: { aanbieder: 'stripe', terugkerend: { modus: 'vastleggen' } },
    gebeurtenissen: [{ soort: 'PROVIDER_START', at: new Date(BASIS + 1).toISOString() }] };
  assert.doesNotThrow(() => grens(r, false), 'één milliseconde binnen de horizon');
  r.status = STATUS.CONTROLE_NODIG;
  assert.throws(() => grens(r, false), { code: 'BETAAL_PROVIDER_HERSTART_ONZEKER' });
});

test('verse lezing weigert vóór provider-I/O; dubbele gelijktijdige begin deelt ook de lezing', async () => {
  const data = {}, crypto = require('node:crypto'); let posts = 0, reads = 0, vrij;
  const gate = new Promise(resolve => { vrij = resolve; }); let fout = false;
  const bw = require('../server/kern/betaalwaarheid')({ d: () => data, save() {}, crypto,
    ververs: async () => { reads++; await gate; if (fout) throw Error('Collectieopslag niet beschikbaar'); },
    betaal: { async maakBetaling() { posts++; return { id: 'pi_gedeeld', aanbieder: 'stripe', status: 'processing' }; } } });
  const r = bw.maak({ actor: 'acc:1', idem: 'gedeeld', soort: 'factuur', bronRef: 'INV-1', centen: 1200 });
  const a = bw.begin(r.id, { aanbieder: 'stripe' }), b = bw.begin(r.id, { aanbieder: 'stripe' });
  assert.equal(reads, 1); vrij(); await Promise.all([a, b]); assert.equal(posts, 1);
  fout = true;
  await assert.rejects(bw.begin(r.id), /Collectieopslag/); assert.equal(posts, 1);
  assert.equal(r.gebeurtenissen.filter(g => g.soort === 'PROVIDER_FOUT').length, 0);
});

test('verse achtergrondlezing neemt geen PG-HTTP-requestvak over of stil weg', async () => {
  const context = require('../server/db/verzoekcontext'), raw = {}, crypto = require('node:crypto');
  const db = { get data() { return context.dataVoor(raw); } }; let reads = 0, posts = 0;
  const { betaalWaarheid: bw } = require('../server/opzet/betaalketen')({ db,
    save: () => context.noteerSave(), crypto, env: {},
    bewerkCollectie() { reads++; throw Error('Mag niet in open PG-context'); },
    betaal: { async maakBetaling() { posts++; return { id: 'pi_request', aanbieder: 'stripe', status: 'processing' }; } } });
  const ctx = context.nieuw();
  await context.voer(ctx, async () => {
    const r = bw.maak({ actor: 'acc:1', idem: 'eigenrequest', soort: 'factuur', bronRef: 'INV-1', centen: 1200 });
    await bw.begin(r.id, { aanbieder: 'stripe' });
    assert.equal(bw.van(r.id).providerId, 'pi_request');
    assert.ok(ctx.vakken.has('betaalWaarheid')); assert.equal(context.wijzigingen(ctx).length, 2);
  });
  assert.equal(reads, 0); assert.equal(posts, 1); assert.deepEqual(raw, {});
});
