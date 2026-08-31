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

/* Vermoede EN al bevestigde paren, en dat tweede is geen luxe: HERSTEL.json
   leidt zijn graad uit deze uitslag af, dus een bevestiging die niet opnieuw
   wordt beproefd verdwijnt bij de volgende ronde uit het register. Een
   bevestiging die zichzelf opheft is erger dan geen. */
test('1. vermoede en bevestigde paren worden beproefd, onbepaalde niet', () => {
  const p = parenUit({ per: {
    '/api/a/maak': { graad: 'vermoed', tegenhanger: '/api/a/weg' },
    '/api/b/weg': { graad: 'onbepaald', kandidaten: ['/api/b/maak', '/api/b/bewaar'] },
    '/api/c/maak': { graad: 'bevestigd', tegenhanger: '/api/c/weg' }
  } }, { '/api/c/maak': 'supplier' });
  assert.deepStrictEqual(p, [
    { heen: '/api/a/maak', terug: '/api/a/weg', rol: 'member' },
    { heen: '/api/c/maak', terug: '/api/c/weg', rol: 'supplier' }
  ]);
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
  assert.strictEqual(g.exact + g.compensatie + g.geenHerstel + g.nietBeproefd + g.wereldOntbreekt, g.paren,
    'de uitslagen tellen niet op tot het aantal paren: er valt er een tussenuit');
  assert.ok(!('hersteld' in g), 'exact en compensatie mogen nooit tot een getal worden samengevoegd');
});

/* DE RATEL OP HERSTELPROEF.json. `exact` en `compensatie` worden nergens
   samengeteld, dus staan er twee grondwaarden en niet een. */
test('9. de bewezen paren worden niet minder', () => {
  const b = path.join(__dirname, '..', 'HERSTELPROEF.json');
  if (!fs.existsSync(b)) return;
  const g = JSON.parse(fs.readFileSync(b, 'utf8')).gemeten;
  assert.ok(g.exact >= 13, 'exact: ' + g.exact + ' < 13');
  assert.ok(g.compensatie >= 30, 'compensatie: ' + g.compensatie + ' < 30');
  /* NUL, en dat is de grondwaarde. Elk paar draagt een uitslag: uitgevoerd, of
     met de reden waarom zijn wereld hier niet bestaat. Een paar dat terugvalt
     naar "niet beproefd" is een proef die iets kwijt is. */
  assert.strictEqual(g.nietBeproefd, 0,
    'er staan weer paren op `nietBeproefd`; elk paar hoort een uitslag te dragen of een ' +
    'uitgeschreven reden waarom zijn wereld hier niet bestaat');
  assert.ok(g.wereldOntbreekt <= 46, 'wereldOntbreekt: ' + g.wereldOntbreekt + ' > 46');
});

/* De wereldlijst is een lijst BESLUITEN en geen prullenbak: wie een route hier
   neerzet, sluit hem uit van de meting. Dat mag, mits er staat WAT er zou
   moeten bestaan -- anders is het een manier om een lastig paar weg te
   schrijven. */
test('10. elke uitgesloten route zegt welke wereld hij vraagt', () => {
  const wereld = require('../scripts/lib/herstelwereld');
  for (const [pad, reden] of Object.entries(wereld.ONBEREIKBAAR)) {
    assert.match(pad, /^\/api\//, pad + ': geen route');
    assert.ok(reden && reden.length > 15, pad + ': uitgesloten zonder te zeggen wat er zou moeten bestaan');
  }
  /* En een route mag niet TEGELIJK worden uitgesloten en voorzien: dan zou de
     proef hem klaarzetten en er daarna niets mee doen. */
  for (const pad of Object.keys(wereld.VOORZIENINGEN))
    assert.ok(!wereld.ONBEREIKBAAR[pad], pad + ' is zowel uitgesloten als voorzien');
});

test('11. een voorziening wijst naar een route en nooit naar zichzelf', () => {
  const wereld = require('../scripts/lib/herstelwereld');
  for (const [pad, via] of Object.entries(wereld.VOORZIENINGEN)) {
    const keten = Array.isArray(via) ? via : [via];
    for (const v of keten) {
      assert.match(v, /^\/api\//, pad + ': voorziening is geen route');
      assert.notStrictEqual(v, pad, pad + ': voorziening wijst naar zichzelf; dan draait de heenweg twee keer');
    }
  }
});

test('12. het wereldlijf wint van wat er meereist', () => {
  const wereld = require('../scripts/lib/herstelwereld');
  /* Het adres van een vorige publicatie reisde mee als sleutel en overschreef
     het verse adres, waarna publiceren 409 gaf op zijn eigen vorige ronde.
     Twee opeenvolgende aanroepen horen dus een ANDER adres te geven. */
  const a = wereld.lijfVoor('/api/site/publiceer', {});
  const b = wereld.lijfVoor('/api/site/publiceer', {});
  assert.notStrictEqual(a.adres, b.adres, 'het adres is niet vers per poging');
  /* En een lijf dat van de wereld afhangt, gebruikt die wereld ook echt. */
  const tk = wereld.lijfVoor('/api/bank/terugkerend/zet', { iban: 'NL00A', naarIban: 'NL00B' });
  assert.strictEqual(tk.vanIban, 'NL00A');
  assert.strictEqual(tk.naarIban, 'NL00B');
});

/* MUTATIE DIE NIET BEET. Toets 5 hierboven laat een terugweg niets doen, maar
   in die nepwereld antwoordt de heenweg met een id op het hoogste niveau -- een
   ZEKERE sleutel. Haalde je de `uitLijst`-rem weg, dan bleef alles groen. Deze
   toets laat de heenweg met een LIJST antwoorden, precies zoals /api/agenda/
   toevoegen doet, en eist dat de proef dan geen oordeel velt. */
test('13. een terugweg die niets doet op een GERADEN sleutel is geen beschuldiging', async () => {
  const os = require('os');
  const { DatabaseSync } = require('node:sqlite');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstelproef-gok-'));
  const db = new DatabaseSync(path.join(map, 'store.db'));
  db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  let items = [];
  const echt = global.fetch;
  global.fetch = async (url, opties) => {
    const pad = String(url).replace(/^http:\/\/nep/, '');
    if (pad === '/api/x/maak') {
      items = items.concat(['i' + items.length]);
      db.exec("INSERT INTO kv (key,val,ver) VALUES ('dingen','" + JSON.stringify(items) +
        "',1) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=kv.ver+1");
      /* een lijst, en het nieuwe item staat NIET achteraan */
      return { status: 200, json: async () => ({ ok: true, items: [...items].reverse().map(id => ({ id })) }) };
    }
    return { status: 200, json: async () => ({ ok: true }) };   // de terugweg doet niets
  };
  try {
    const u = await beproefPaar({ basis: 'http://nep', datamap: map }, 't', { heen: '/api/x/maak', terug: '/api/x/weg' });
    assert.strictEqual(u.uitslag, 'nietBeproefd',
      'de sleutel kwam uit een lijst en is dus geraden; daarop "deze terugweg doet niets" zeggen ' +
      'is een beschuldiging op een gok');
    assert.match(u.reden, /GERADEN/);
  } finally {
    global.fetch = echt; try { db.close(); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
});
