/* RTGStroom (public/shared/stroom.js) zonder browser: de ruil, het herverbinden
   met een VERS ticket, en het stoppen als de sessie zelf weg is.

   Een EventSource verbindt na een storing vanzelf opnieuw met HETZELFDE adres.
   Met een eenmalig ticket is dat adres dan op (401), dus de helper moet zelf
   sluiten en een nieuw ticket halen -- en met `since` verder waar hij was. De
   browserproef (test/sessiestroom.e2e.js) ziet alleen de eerste opening; deze
   toets ziet wat er daarna gebeurt, met een nagemaakte EventSource, fetch en
   klok in een eigen vm-context.

   Draai los: node --test test/stroom-client.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BRON = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'stroom.js'), 'utf8');

function wereld({ antwoorden }) {
  const bronnen = [], vragen = [], wekkers = [];
  class NepBron {
    constructor(url) { this.url = url; this.readyState = 0; this.luister = {}; bronnen.push(this); }
    addEventListener(naam, fn) { (this.luister[naam] = this.luister[naam] || []).push(fn); }
    close() { this.readyState = 2; this.dicht = true; }
    stuur(naam, data, id) { for (const fn of this.luister[naam] || []) fn({ data, lastEventId: id || '' }); }
  }
  const fetch = (url, opties) => {
    vragen.push({ url, opties });
    const a = antwoorden.shift() || { status: 500 };
    return Promise.resolve({ ok: a.status === 200, status: a.status, json: () => Promise.resolve(a.lijf || {}) });
  };
  const venster = { EventSource: NepBron, fetch, setTimeout: (fn, ms) => { wekkers.push({ fn, ms }); return wekkers.length; },
    clearTimeout: () => {} };
  venster.window = venster;
  vm.runInNewContext(BRON, Object.assign(venster, { JSON, encodeURIComponent, Promise }));
  const rust = () => new Promise(r => setImmediate(r));
  return { S: venster.RTGStroom, bronnen, vragen, wekkers, rust };
}

test('1. de sessie gaat in de kop naar de ruilplek, en alleen het ticket staat in het adres', async () => {
  const w = wereld({ antwoorden: [{ status: 200, lijf: { ticket: 'ST.A' } }] });
  w.S.open('/api/stream', { token: 'SESSIE-GEHEIM' });
  await w.rust(); await w.rust();
  assert.equal(w.vragen.length, 1);
  assert.equal(w.vragen[0].url, '/api/stroom/ticket');
  assert.equal(w.vragen[0].opties.headers.Authorization, 'Bearer SESSIE-GEHEIM');
  assert.deepEqual(JSON.parse(w.vragen[0].opties.body), { stroom: 'lid' });
  assert.equal(w.bronnen.length, 1);
  assert.equal(w.bronnen[0].url, '/api/stream?ticket=ST.A');
  assert.ok(!w.bronnen[0].url.includes('SESSIE-GEHEIM'), 'de sessie staat nooit in het adres');
});

test('2. na een storing: sluiten, een VERS ticket, en verder vanaf het laatste event', async () => {
  const w = wereld({ antwoorden: [{ status: 200, lijf: { ticket: 'ST.A' } }, { status: 200, lijf: { ticket: 'ST.B' } }] });
  const bron = w.S.open('/api/stream', { token: 'S' });
  const gezien = [];
  bron.addEventListener('notify', e => gezien.push(e.data));
  await w.rust(); await w.rust();
  w.bronnen[0].stuur('notify', 'eerste', '41');
  let fouten = 0; bron.onerror = () => { fouten++; };
  w.bronnen[0].onerror({});                       // de verbinding valt weg
  assert.equal(w.bronnen[0].dicht, true, 'het oude adres (met een gebruikt ticket) wordt gesloten, niet hergebruikt');
  assert.equal(fouten, 1, 'de aanroeper hoort van de storing');
  w.wekkers.pop().fn();                           // de wachttijd voor het herverbinden
  await w.rust(); await w.rust();
  assert.equal(w.vragen.length, 2, 'een nieuw ticket gevraagd');
  assert.equal(w.bronnen[1].url, '/api/stream?ticket=ST.B&since=41', 'met het verse ticket en verder vanaf event 41');
  w.bronnen[1].stuur('notify', 'tweede', '42');
  assert.deepEqual(gezien, ['eerste', 'tweede'], 'de luisteraars hangen ook aan de nieuwe verbinding');
});

test('3. weigert de ruilplek de sessie (401/403), dan stopt het en meldt het dat', async () => {
  for (const status of [401, 403]) {
    const w = wereld({ antwoorden: [{ status }] });
    const bron = w.S.open('/api/supplier/stream', { stroom: 'zaak', token: 'oud' });
    let fout = null; bron.onerror = e => { fout = e; };
    await w.rust(); await w.rust();
    assert.equal(w.bronnen.length, 0, 'geen stroom zonder ticket');
    assert.equal(bron.readyState, 2, 'gesloten');
    assert.equal(fout && fout.status, status);
    assert.equal(w.wekkers.length, 0, 'en geen nieuwe poging');
    assert.deepEqual(JSON.parse(w.vragen[0].opties.body), { stroom: 'zaak' });
  }
});

test('4. een eigen ruilplek (het schoolkanaal) en een kijkticket voor een video', async () => {
  const w = wereld({ antwoorden: [{ status: 200, lijf: { ticket: 'ST.K' } }, { status: 200, lijf: { ticket: 'ST.V' } }] });
  w.S.open('/api/foundation/school/belkanaal?klasCode=K1&code=G1', { sinds: false, token: 'GEZIN',
    ticketPad: '/api/foundation/school/belkanaal/ticket', lijf: { klasCode: 'K1', code: 'G1' } });
  await w.rust(); await w.rust();
  assert.equal(w.vragen[0].url, '/api/foundation/school/belkanaal/ticket');
  assert.deepEqual(JSON.parse(w.vragen[0].opties.body), { klasCode: 'K1', code: 'G1' });
  assert.equal(w.bronnen[0].url, '/api/foundation/school/belkanaal?klasCode=K1&code=G1&ticket=ST.K');
  const video = { attrs: {}, luister: {}, getAttribute(k) { return this.attrs[k]; },
    addEventListener(n, fn) { (this.luister[n] = this.luister[n] || []).push(fn); }, removeEventListener() {} };
  Object.defineProperty(video, 'src', { set(v) { this.attrs.src = v; }, get() { return this.attrs.src; } });
  await w.S.kijk(video, '/api/theater/kijk/v1', { stroom: 'theater-kijk', id: 'v1', token: 'LID' });
  assert.deepEqual(JSON.parse(w.vragen[1].opties.body), { stroom: 'theater-kijk', id: 'v1' });
  assert.equal(video.src, '/api/theater/kijk/v1?ticket=ST.V');
});
