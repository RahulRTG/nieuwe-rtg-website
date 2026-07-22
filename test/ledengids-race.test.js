/* Structurele regressietest voor de member_dir-race (de GELD-fout uit de 100M-
   beproeving). De klasse: een lid staat BUITEN het RAM als geindexeerde rij in
   Postgres; de schrijf naar member_dir is fire-and-forget (dirTouch awa't hem
   niet), terwijl een lezer (p2p-betalen, uitnodigen, bellen) het lid meteen op
   codenaam wil vinden. Tussen de schrijf en het landen van de rij is het lid via
   een kale Postgres-lezing onvindbaar -> een p2p-betaling 404't en het geld blijft
   bij de zender.

   De oplossing is een SYNCHRONE omgekeerde cache (ledenRev) die ledenGidsZet
   meteen vult, zodat ledenGidsExact het net actieve lid teruggeeft ook al is de
   INSERT nog onderweg. Deze test bewijst dat invariant met een neppe pool die de
   landings-vertraging modelleert -- geen echte Postgres nodig, draait in de
   standaardsuite. Valt de sync-cache ooit weg, dan valt deze test om. */
const test = require('node:test');
const assert = require('node:assert/strict');
const gidsen = require('../server/db/gidsen');

// Neppe pool: de INSERT bevestigt meteen (zoals een write-ahead), maar de rij
// wordt pas na `landDelay` ms ZICHTBAAR voor een SELECT -- precies het gat waarin
// de race bijt. Zo kunnen we lezen terwijl Postgres het lid nog niet teruggeeft.
function maakNepPool(landDelay) {
  const geland = new Map();      // codename_lower -> { key, codename, tier }  (pas na landing zichtbaar)
  const query = (sql, params) => {
    params = params || [];
    if (/^\s*(CREATE|DO)\b/i.test(sql)) return Promise.resolve({ rows: [] });
    if (/count\(\*\)/i.test(sql)) return Promise.resolve({ rows: [{ c: String(geland.size) }] });
    if (/^\s*INSERT/i.test(sql)) {
      const [key, codename, tier, lower] = params;
      // bevestig meteen, maar maak zichtbaar NA de vertraging (visibility-lag).
      // unref: de timer mag het proces nooit openhouden -- de eerste test leest
      // juist BINNEN dit venster en heeft de landing niet nodig.
      setTimeout(() => geland.set(lower, { key, codename, tier }), landDelay).unref();
      return Promise.resolve({ rows: [{ nieuw: true }] });
    }
    if (/WHERE\s+codename_lower\s*=\s*\$1/i.test(sql)) {
      const r = geland.get(params[0]);
      return Promise.resolve({ rows: r ? [r] : [] });
    }
    if (/WHERE\s+key\s*=\s*\$1/i.test(sql)) {
      for (const r of geland.values()) if (r.key === params[0]) return Promise.resolve({ rows: [{ codename: r.codename, tier: r.tier }] });
      return Promise.resolve({ rows: [] });
    }
    if (/LIKE\s+\$1/i.test(sql)) {
      const naald = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const rows = [...geland.values()].filter(r => r.codename.toLowerCase().includes(naald));
      return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  };
  return { query, _geland: geland };
}

test('member_dir-race: een net actief lid is meteen op codenaam vindbaar, ook voor de INSERT landt', async () => {
  const pool = maakNepPool(10000);   // landing duurt 10 s: ruim voorbij de leesmomenten
  await gidsen.init(pool);
  assert.equal(gidsen.ledenGidsActief(), true, 'de ledengids draait op de (neppe) pool');

  // BASISLIJN: onbekende codenaam -> niets in de cache, niets geland -> null.
  // Dit is het gedrag zonder de sync-cache: een kale Postgres-lezing mist.
  assert.equal(await gidsen.ledenGidsExact('amber-fox-12'), null, 'onbekende codenaam geeft null');

  // Zet het lid neer zoals dirTouch: NIET awaiten (fire-and-forget). De sync-kant
  // (ledenRev + ledenCache) is meteen gevuld; de INSERT landt pas over 10 s.
  gidsen.ledenGidsZet('k1', 'Amber-Fox-12', 'rtg');

  // HET HETE PAD: meteen opzoeken. De rij is NOG NIET geland (pool._geland leeg),
  // dus dit kan alleen slagen via de synchrone omgekeerde cache.
  assert.equal(pool._geland.size, 0, 'de INSERT is nog niet geland (race-venster)');
  const hit = await gidsen.ledenGidsExact('amber-fox-12');
  assert.ok(hit, 'het net actieve lid is vindbaar ondanks dat Postgres de rij nog niet teruggeeft');
  assert.equal(hit.key, 'k1');
  assert.equal(hit.tier, 'rtg');

  // Hoofdletter-ongevoelig (de codenaam wordt genormaliseerd naar kleine letters).
  const hit2 = await gidsen.ledenGidsExact('AMBER-FOX-12');
  assert.equal(hit2 && hit2.key, 'k1', 'exacte opzoeking is hoofdletter-ongevoelig');

  // Het substring-vangnet in ledenGidsZoek moet het net actieve lid ook meenemen
  // als de trigram-index (hier: de neppe LIKE over lege landing) nog niets geeft.
  const zoek = await gidsen.ledenGidsZoek('amber-fox-12', 20);
  assert.ok(zoek.some(r => r.key === 'k1'), 'ledenGidsZoek bevat het net actieve lid via het vangnet');
});

test('member_dir: na het landen blijft de exacte opzoeking werken via de btree-lezing', async () => {
  const pool = maakNepPool(20);   // landt snel
  await gidsen.init(pool);
  gidsen.ledenGidsZet('k2', 'Zilver-Haas-07', 'business');
  await new Promise(r => setTimeout(r, 60));   // laat de INSERT landen
  assert.equal(pool._geland.size, 1, 'de rij is nu geland in de (neppe) Postgres');
  const hit = await gidsen.ledenGidsExact('zilver-haas-07');
  assert.equal(hit && hit.key, 'k2', 'het lid blijft vindbaar na landing');
});
