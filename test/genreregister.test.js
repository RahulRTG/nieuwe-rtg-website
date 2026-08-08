/* ============================================================================
   HET GENRE-REGISTER: EEN PLEK, EN DAT MOET ZO BLIJVEN.

   WAAROM DIT BESTAAT

   De 73 genres stonden verspreid over tien initdata-delen en zes kernmodules,
   elk met een eigen `if (!db.data.supplierTypes.x) ... = { label, icon, caps }`.
   Dezelfde waarheid op zestien plekken, en die lopen uit elkaar -- LAT-regel 4.
   Dat gebeurde ook: de opruimlijst van de demozaken liep vijftien zaken achter
   op wat er werkelijk gezaaid werd, en dat kostte een productiecatalogus zonder
   hotel maar met tandarts.

   Een register dat op een plek staat is een belofte in tekst (regel 6), en die
   verouderen zonder dat iets klaagt. Dit bestand is de machine eronder: het
   zakt zodra iemand een genre ergens anders definieert.

   WAT ER WORDT VASTGELEGD

   1. Niemand definieert een genre buiten het register.
   2. Elk genre heeft een sector, en die sector bestaat.
   3. Het register komt ook echt in de database terecht, met sector.
   4. Velden buiten label/icon/caps overleven de reis (de `besloten`-vlag op
      special forces en defensie viel er bij het bouwen van het register een
      keer stilletjes af; deze toets is de reden dat dat niet nog eens gebeurt).
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');
const register = require('../server/seed/genres');

const SERVER = path.join(__dirname, '..', 'server');
const REGISTERBESTANDEN = ['seed/genres.js', 'seed/genres-lijst.js'];

function alleJs(map) {
  const uit = [];
  for (const item of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, item.name);
    if (item.isDirectory()) uit.push(...alleJs(p));
    else if (item.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

test('niemand definieert een genre buiten het register', () => {
  /* De vorm om op te letten: een toekenning van een heel genre-object aan
     db.data.supplierTypes. Een module die een BESTAAND genre aanpast (een cap
     erbij migreren) mag wel -- dat is geen tweede definitie. */
  const patroon = /supplierTypes(\.[a-zA-Z_$][\w$]*|\[['"][^'"]+['"]\])\s*=\s*\{/g;
  const overtreders = [];
  for (const bestand of alleJs(SERVER)) {
    const rel = path.relative(SERVER, bestand).split(path.sep).join('/');
    if (REGISTERBESTANDEN.includes(rel)) continue;
    const bron = fs.readFileSync(bestand, 'utf8');
    for (const m of bron.matchAll(patroon)) {
      const regel = bron.slice(0, m.index).split('\n').length;
      overtreders.push(rel + ':' + regel);
    }
  }
  assert.deepEqual(overtreders, [],
    'genres horen alleen in server/seed/genres-lijst.js te staan; hier staat er nog een definitie: ' +
    overtreders.join(', '));
});

test('elk genre heeft een sector die bestaat, en elke sector heeft genres', () => {
  const { GENRES, SECTOREN } = register;
  assert.ok(Object.keys(GENRES).length >= 73, 'het register hoort de genres te bevatten');
  for (const [id, def] of Object.entries(GENRES)) {
    assert.ok(def.industry, id + ' heeft geen sector');
    assert.ok(SECTOREN[def.industry], id + ' wijst naar een sector die niet bestaat: ' + def.industry);
    assert.ok(def.label, id + ' heeft geen label');
    assert.ok(Array.isArray(def.caps), id + ' heeft geen caps');
  }
  for (const sector of Object.keys(SECTOREN))
    assert.ok(register.genresVan(sector).length > 0, 'sector zonder genres: ' + sector);
});

test('zetRegister geeft losse kopieën, geen gedeelde objecten', () => {
  /* Zou de database het register-object zelf krijgen, dan schrijft een migratie
     die een cap toevoegt door naar ELKE database in dit proces -- en in de
     toetsen naar de volgende toets. */
  const a = { data: {} }, b = { data: {} };
  register.zetRegister(a); register.zetRegister(b);
  a.data.supplierTypes.hotel.caps.push('gehaktbal');
  assert.equal(b.data.supplierTypes.hotel.caps.includes('gehaktbal'), false,
    'twee databases delen hetzelfde caps-array');
  assert.equal(register.GENRES.hotel.caps.includes('gehaktbal'), false,
    'de database schrijft door naar het register zelf');
});

test('het register belandt in de database, met sector en met de besloten-vlag', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genreregister-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const db = new DatabaseSync(path.join(TMP, 'store.db'), { readOnly: true });
    const types = JSON.parse(db.prepare("SELECT val FROM kv WHERE key = 'supplierTypes'").get().val);
    db.close();

    for (const [id, def] of Object.entries(register.GENRES)) {
      assert.ok(types[id], 'genre ontbreekt in de database: ' + id);
      assert.equal(types[id].industry, def.industry, 'sector klopt niet voor ' + id);
    }
    assert.equal(types.specials.besloten, true, 'special forces hoort besloten te blijven');
    assert.equal(types.defensie.besloten, true, 'defensie hoort besloten te blijven');
  } finally {
    await stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een database van voor het register krijgt zijn sectoren alsnog', async () => {
  /* Bestaande databases dragen genres zonder sector. zetRegister vult die bij
     elke start aan; zonder die aanvulling zou de sectorlaag alleen op verse
     installaties bestaan. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genreregister-oud-'));
  try {
    const eerste = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    await stop(eerste);

    const db = new DatabaseSync(path.join(TMP, 'store.db'));
    const types = JSON.parse(db.prepare("SELECT val FROM kv WHERE key = 'supplierTypes'").get().val);
    let gestript = 0;
    for (const t of Object.values(types)) if (t.industry) { delete t.industry; gestript++; }
    db.prepare("UPDATE kv SET val = ? WHERE key = 'supplierTypes'").run(JSON.stringify(types));
    db.close();
    assert.ok(gestript > 0, 'er moesten sectoren te strippen zijn, anders toetst dit niets');

    const tweede = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    try {
      const db2 = new DatabaseSync(path.join(TMP, 'store.db'), { readOnly: true });
      const na = JSON.parse(db2.prepare("SELECT val FROM kv WHERE key = 'supplierTypes'").get().val);
      db2.close();
      for (const [id, def] of Object.entries(register.GENRES))
        assert.equal(na[id] && na[id].industry, def.industry, 'sector niet aangevuld voor ' + id);
    } finally { await stop(tweede); }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
