/* De herstelproef beproefd op de vier oordelen die zij velt, en vooral op het
   onderscheid dat ze het makkelijkst kwijtraakt: `nietBeproefd` is geen
   `geen-herstel`, en `compensatie` is geen `exact`.

   De proef zelf draait een server op en kost een minuut; hier staat het oordeel
   los getoetst, met een nagebootste server. Dat is met opzet: het oordeel is
   het deel dat stil verkeerd kan gaan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parenUit, sleutelsUit, beproefPaar } = require('../scripts/herstelproef');

test('1. alleen vermoede paren met een tegenhanger worden beproefd', () => {
  const p = parenUit({ per: {
    '/api/a/maak': { graad: 'vermoed', tegenhanger: '/api/a/weg' },
    '/api/b/weg': { graad: 'onbepaald', kandidaten: ['/api/b/maak', '/api/b/bewaar'] },
    '/api/c/maak': { graad: 'bevestigd', tegenhanger: '/api/c/weg' }
  } });
  assert.deepStrictEqual(p, [{ heen: '/api/a/maak', terug: '/api/a/weg' }]);
});

test('2. de sleutel komt uit het antwoord, ook uit het laatste item van een lijst', () => {
  assert.deepStrictEqual(sleutelsUit({ ok: true, items: [{ id: 'a1' }, { id: 'a2' }] }), { id: 'a2' });
  assert.deepStrictEqual(sleutelsUit({ ok: true }), {});
  /* een boolean of een object onder `id` is geen sleutel */
  assert.deepStrictEqual(sleutelsUit({ id: { diep: 1 } }), {});
});

/* Een nagebootste server: hij houdt een collectie bij en antwoordt op twee
   paden. Zo is elk van de vier oordelen na te spelen zonder de echte routes. */
function nepwereld(gedrag) {
  const os = require('os');
  const { DatabaseSync } = require('node:sqlite');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstelproef-toets-'));
  const db = new DatabaseSync(path.join(map, 'store.db'));
  db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  let inhoud = [];
  const schrijf = () => {
    db.exec("INSERT INTO kv (key,val,ver) VALUES ('dingen','" + JSON.stringify(inhoud) +
      "',1) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=kv.ver+1");
  };
  const echt = global.fetch;
  global.fetch = async (url, opties) => {
    const pad = String(url).replace(/^http:\/\/nep/, '');
    const lijf = JSON.parse((opties && opties.body) || '{}');
    const a = gedrag(pad, lijf, inhoud);
    if (a.inhoud) { inhoud = a.inhoud; schrijf(); }
    return { status: a.status, json: async () => a.data || {} };
  };
  return { map, herstel: () => { global.fetch = echt; try { db.close(); } catch (e) {} fs.rmSync(map, { recursive: true, force: true }); } };
}

const srvVan = (w) => ({ basis: 'http://nep', datamap: w.map });

test('3. een echte omkering heet exact', async () => {
  const w = nepwereld((pad, lijf, inhoud) => {
    if (pad === '/api/x/maak') { const id = 'i' + inhoud.length; return { status: 200, data: { id }, inhoud: inhoud.concat([id]) }; }
    return { status: 200, data: { ok: true }, inhoud: inhoud.filter(x => x !== lijf.id) };
  });
  try {
    const u = await beproefPaar(srvVan(w), 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'exact', u.reden);
  } finally { w.herstel(); }
});

test('4. een terugweg die werk doet maar niet terugzet, heet compensatie en nooit exact', async () => {
  const w = nepwereld((pad, lijf, inhoud) => {
    if (pad === '/api/x/maak') { const id = 'i' + inhoud.length; return { status: 200, data: { id }, inhoud: inhoud.concat([id]) }; }
    /* geen verwijdering maar een aantekening: het ding blijft staan */
    return { status: 200, data: { ok: true }, inhoud: inhoud.map(x => x === lijf.id ? x + '-ingetrokken' : x) };
  });
  try {
    const u = await beproefPaar(srvVan(w), 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'compensatie', u.reden);
    assert.ok(u.nietTerug.length, 'compensatie zonder te zeggen wat er niet terugkwam');
  } finally { w.herstel(); }
});

test('5. een terugweg die niets doet, heet geen-herstel', async () => {
  const w = nepwereld((pad, lijf, inhoud) => {
    if (pad === '/api/x/maak') { const id = 'i' + inhoud.length; return { status: 200, data: { id }, inhoud: inhoud.concat([id]) }; }
    return { status: 200, data: { ok: true } };   // 200, en verder niets
  });
  try {
    const u = await beproefPaar(srvVan(w), 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'geen-herstel', u.reden);
  } finally { w.herstel(); }
});

/* DE BELANGRIJKSTE. Kwam de proef niet binnen, dan is er niets gemeten -- en
   dat mag nooit als een oordeel over het paar langskomen. Een `geen-herstel`
   hier zou 66 paren ten onrechte veroordelen. */
test('6. een heenweg die niet binnenkomt levert nietBeproefd, geen oordeel', async () => {
  const w = nepwereld(() => ({ status: 401, data: { error: 'nee' } }));
  try {
    const u = await beproefPaar(srvVan(w), 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'nietBeproefd');
    assert.match(u.reden, /401/);
  } finally { w.herstel(); }
});

test('7. ook een terugweg die niet binnenkomt is nietBeproefd en geen geen-herstel', async () => {
  const w = nepwereld((pad, lijf, inhoud) => {
    if (pad === '/api/x/maak') { const id = 'i' + inhoud.length; return { status: 200, data: { id }, inhoud: inhoud.concat([id]) }; }
    return { status: 404, data: { error: 'onbekend' } };
  });
  try {
    const u = await beproefPaar(srvVan(w), 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'nietBeproefd', 'een 404 op de terugweg zegt iets over de PROEF, niet over het paar');
  } finally { w.herstel(); }
});

test('8. de uitslag draagt zijn grenzen, en telt exact en compensatie nooit samen', () => {
  const b = path.join(__dirname, '..', 'HERSTELPROEF.json');
  if (!fs.existsSync(b)) return;
  const u = JSON.parse(fs.readFileSync(b, 'utf8'));
  assert.ok(u.grenzen.length >= 4);
  const g = u.gemeten;
  assert.strictEqual(g.exact + g.compensatie + g.geenHerstel + g.nietBeproefd, g.paren,
    'de uitslagen tellen niet op tot het aantal paren: er valt er een tussenuit');
  assert.ok(!('hersteld' in g), 'exact en compensatie mogen nooit tot een getal worden samengevoegd');
});
