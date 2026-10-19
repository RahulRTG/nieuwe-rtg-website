/* Bellen: de meeleesregel komt aan (signaal `tekst`).

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). Tijdens een gesprek stuurt
   de meeleesbaan (app-main-10.js, csBaan) elke getypte of lokaal herkende regel
   als `kind:'tekst'` naar /api/member/call, en app-main-11.js toont hem bij de
   ander. De lijst met signalen in routes/social/leden.js kende `tekst` niet en
   gaf 400; de client slikte die fout. De regel kwam dus nooit aan.

   Draai los: node --test test/bellen-tekst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beltekst-'));
let srv, base;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
const lid = async () => (await api('/api/auth/register', { name: 'Beller ' + n, email: 'bt' + Date.now() + (n++) + '@x.nl',
  password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;

/* Een live-verbinding zoals het scherm hem opent; geeft de ontvangen oproepsignalen. */
async function luister(tok) {
  const t = (await api('/api/stroom/ticket', { stroom: 'lid' }, tok)).body.ticket;
  const ac = new AbortController(), ev = [];
  const r = await fetch(base + '/api/stream?ticket=' + encodeURIComponent(t), { signal: ac.signal });
  (async () => {
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    try {
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const blok = buf.slice(0, i); buf = buf.slice(i + 2);
          const e = (blok.match(/^event: (.*)$/m) || [])[1], d = (blok.match(/^data: (.*)$/m) || [])[1];
          if (e === 'call' && d) ev.push(JSON.parse(d));
        }
      }
    } catch (e) { /* gestopt */ }
  })();
  await new Promise((r2) => setTimeout(r2, 150));
  return { ev, stop: () => ac.abort() };
}

let A, B, keyA, keyB;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await lid(); B = await lid();
  const ca = (await api('/api/member/connections', {}, A)).body, cb = (await api('/api/member/connections', {}, B)).body;
  keyA = ca.me; keyB = cb.me;
  const doel = ((await api('/api/member/find', { q: cb.codename }, A)).body.results || []).find((x) => x.codename === cb.codename);
  assert.equal((await api('/api/member/connect', { key: doel.key }, A)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: keyA, action: 'accept' }, B)).status, 200);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een meeleesregel tijdens een gesprek komt aan bij de ander', async () => {
  const l = await luister(B);
  try {
    const r = await api('/api/member/call', { toKey: keyB, kind: 'tekst', payload: { r: { tekst: 'Hoor je mij?' } } }, A);
    assert.equal(r.status, 200, 'het signaal tekst hoort bij een gesprek: ' + JSON.stringify(r.body));
    const eind = Date.now() + 3000;
    while (Date.now() < eind && !l.ev.some((x) => x.kind === 'tekst')) await new Promise((r2) => setTimeout(r2, 50));
    const t = l.ev.find((x) => x.kind === 'tekst');
    assert.ok(t, 'de ander ontving de regel');
    assert.equal(t.payload.r.tekst, 'Hoor je mij?');
    assert.equal(t.from, keyA);
  } finally { l.stop(); }
});

test('een onbekend signaal blijft 400', async () => {
  assert.equal((await api('/api/member/call', { toKey: keyB, kind: 'iets', payload: null }, A)).status, 400);
});
