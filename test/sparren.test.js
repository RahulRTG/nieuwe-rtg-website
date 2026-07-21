/* Sparren: Rahul denkt mee (niet om zijn gelijk te halen) en komt op een
   geparkeerde gedachte terug als je rustig thuis bent met een lege agenda.
   Getoetst via de routes: parkeren + lijst + status, dat een spar-vraag in het
   gesprek de gedachte parkeert, en de kern-eenheid rustMoment/sweepVoor: wel
   aankaarten bij rust, niet als je onderweg bent of nog iets in je agenda hebt.
   Draai los: node --experimental-sqlite --test test/sparren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spar-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', {
    name: 'Spar Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body.token;
}

test('1. parkeren, lijst en status via de routes', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    // leeg om te beginnen
    const leeg = await api(base, '/api/spar/lijst', {}, lid);
    assert.equal(leeg.status, 200);
    assert.equal((leeg.body.spar || []).length, 0);
    assert.ok(leeg.body.houding && /beter te maken/i.test(leeg.body.houding), 'de sparhouding reist mee');

    // parkeer een gedachte
    const p1 = await api(base, '/api/spar/parkeer', { tekst: 'een pop-up-diner op het strand voor de vriendengroep' }, lid);
    assert.equal(p1.status, 200);
    assert.equal(p1.body.spar.length, 1);
    // idempotent: dezelfde tekst niet twee keer
    await api(base, '/api/spar/parkeer', { tekst: 'een pop-up-diner op het strand voor de vriendengroep' }, lid);
    const na = await api(base, '/api/spar/lijst', {}, lid);
    assert.equal(na.body.spar.length, 1, 'geen dubbele');

    // op besproken zetten haalt hem van de open lijst
    const id = na.body.spar[0].id;
    const st = await api(base, '/api/spar/status', { id, status: 'besproken' }, lid);
    assert.equal(st.status, 200);
    assert.equal(st.body.spar.length, 0);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. een spar-vraag in het gesprek parkeert de gedachte', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const g = await api(base, '/api/fluister', { q: 'spar met me over een verrassingsfeest voor Sam' }, lid);
    assert.equal(g.status, 200);
    assert.ok(/sparren|meedenk|beter/i.test(g.body.antwoord || ''), 'Rahul reageert in sparmodus');
    const lijst = await api(base, '/api/spar/lijst', {}, lid);
    assert.ok(lijst.body.spar.length >= 1, 'de gedachte is geparkeerd om er later op terug te komen');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

// de kern-eenheid direct: rustMoment en sweepVoor, deterministisch met een
// vaste tijd en geen echte push nodig
test('3. rustMoment/sweep: wel bij rust, niet onderweg of met agenda vandaag', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sparu-'));
  const db = { data: { fluister: {}, live: {}, agendas: {} } };
  const notities = [];
  const kern = require('../server/kern/fluister/sparren')({
    db, save: () => {}, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    notify: (key, m) => notities.push({ key, m }),
    van: (key) => db.data.fluister[key] || (db.data.fluister[key] = { weetjes: [] }),
    nu: () => new Date().toISOString()
  });
  const key = 'testkey'; // de rauwe sessiesleutel; de agenda hangt onder 'lid:'+key
  kern.parkeer(key, 'idee om later over te sparren', 'test');
  const avond = new Date(); avond.setHours(20, 0, 0, 0);   // rustig avondmoment
  const nacht = new Date(); nacht.setHours(3, 0, 0, 0);    // geen nachtelijke pings

  assert.equal(kern.rustMoment(key, nacht), false, "'s nachts komt hij er niet op terug");
  assert.equal(kern.rustMoment(key, avond), true, 'thuis en lege agenda: dit is een rustig moment');

  // onderweg (live actief) -> geen rustig thuis
  db.data.live[key] = { active: true, lat: 38.9, lng: 1.4 };
  assert.equal(kern.rustMoment(key, avond), false, 'onderweg is geen rustig thuis');
  db.data.live[key] = { active: false };

  // nog iets op de agenda vandaag -> niet aankaarten
  const dag = avond.toISOString().slice(0, 10);
  db.data.agendas['lid:' + key] = [{ id: 'a1', datum: dag, gedaan: false }];
  assert.equal(kern.rustMoment(key, avond), false, 'met iets in de agenda vandaag niet');
  db.data.agendas['lid:' + key] = [];

  // nu wel: de sweep kaart het aan met een melding
  const n = kern.sweepVoor(key, avond);
  assert.equal(n, 1, 'er is een onderwerp aangekaart');
  assert.equal(notities.length, 1);
  assert.ok(/sparren/i.test(notities[0].m.body), 'de melding nodigt uit om te sparren');

  // meteen nog eens binnen de koeling: niet opnieuw (geen gezeur)
  assert.equal(kern.sweepVoor(key, avond), 0, 'binnen de koeling komt hij niet nog eens');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});
