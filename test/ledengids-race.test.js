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
      setTimeout(() => {
        /* UPSERT OP `key`, niet op de codenaam. De echte tabel heeft
           ON CONFLICT(key), dus een lid houdt EEN rij en een hernoeming
           vervangt zijn codename_lower. Deze nep-pool bewaarde op codenaam en
           liet er bij een hernoeming dus twee staan -- een database die de
           echte niet is, en die het verschil tussen "de cache liegt" en "de rij
           staat er nog" onzichtbaar maakt. */
        for (const [l, r] of geland) if (r.key === key) geland.delete(l);
        geland.set(lower, { key, codename, tier });
      }, landDelay).unref();
      return Promise.resolve({ rows: [{ nieuw: true }] });
    }
    if (/WHERE\s+codename_lower\s*=\s*\$1/i.test(sql)) {
      const r = geland.get(params[0]);
      return Promise.resolve({ rows: r ? [r] : [] });
    }
    if (/^\s*DELETE/i.test(sql)) {
      /* De echte tabel geeft de gewiste codename_lower terug (RETURNING), en
         ledenGidsWeg gebruikt precies die waarde om de omgekeerde cache op te
         ruimen. Zonder deze tak zou de nep-pool altijd nul rijen melden en zou
         de vergeet-toets hieronder slagen om de verkeerde reden. */
      for (const [lower, r] of geland) if (r.key === params[0]) { geland.delete(lower); return Promise.resolve({ rows: [{ codename_lower: lower }] }); }
      return Promise.resolve({ rows: [] });
    }
    /* DEZE TAK STAAT BEWUST VOOR DIE HIERONDER. De DELETE-query bevat OOK
       "WHERE key = $1", dus de tak eronder ving hem af en gaf nul rijen terug --
       waarna ledenGidsWeg dacht dat er niets te wissen viel. Mijn eigen
       volgorde-fout, en hij liet de vergeet-toets zakken op de code in plaats
       van op de nep-pool. */
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
  /* WACHTEN TOT DE INSERT GELAND IS, en niet 60 ms gokken. De neppool laat hem
     na 20 ms zichtbaar worden, dus 60 was ruim -- maar "ruim" is geen teken, en
     op een drukke machine is ruim ineens krap. De landing zelf is af te lezen. */
  {
    const eind = Date.now() + 10000;
    while (pool._geland.size < 1) {
      if (Date.now() >= eind) throw new Error('de INSERT landde niet binnen 10 s in de neppool');
      await new Promise(r => setTimeout(r, 5));
    }
  }
  assert.equal(pool._geland.size, 1, 'de rij is nu geland in de (neppe) Postgres');
  const hit = await gidsen.ledenGidsExact('zilver-haas-07');
  assert.equal(hit && hit.key, 'k2', 'het lid blijft vindbaar na landing');
});

/* WAT DE TWEE TOETSEN HIERBOVEN NIET VRAGEN.

   Ze bewijzen dat de omgekeerde cache HELPT: een net actief lid is meteen
   vindbaar, ook voor de INSERT geland is. Dat is de snelheidskant, en die is
   goed gedekt.

   De cache kan echter ook LIEGEN, en daar was geen enkele bewering over. Twee
   gevallen, allebei met een garantie eraan vast:

     1. VERGETEN. ledenGidsWeg() haalt het lid uit member_dir en moet hem ook
        uit ledenRev halen (server/db/ledengids.js regel 88 en 91). Doet hij dat
        niet, dan blijft een gewist lid op codenaam vindbaar zolang het proces
        leeft -- een AVG-belofte die stukgaat zonder dat er iets omvalt, want de
        rij is echt weg en alleen het geheugen praat nog.

     2. HERNOEMEN. Krijgt een lid een nieuwe codenaam, dan mag de oude niet
        blijven wijzen. Anders is een lid onder twee namen te vinden, en die
        oude naam kan later aan iemand anders worden uitgegeven.

   Dat de mutatiemotor dit bestand zeventien mutaties lang liet overleven was
   dus terecht: het hete pad was gedekt, de tegenkant niet.

   MUTATIE-BEWIJS: haal de ledenRev.delete uit ledenGidsWeg en toets 3 zakt;
   laat ledenGidsZet de oude sleutel staan en toets 4 zakt. Beide geprobeerd. */
test('3. VERGETEN werkt ook in de cache: een gewist lid is niet meer op codenaam vindbaar', async () => {
  const pool = maakNepPool(20);
  await gidsen.init(pool);
  gidsen.ledenGidsZet('k3', 'Grijze-Reiger-33', 'rtg');
  await new Promise(r => setTimeout(r, 60));                 // laat de INSERT landen
  assert.ok(await gidsen.ledenGidsExact('grijze-reiger-33'), 'eerst is hij gewoon vindbaar');

  await gidsen.ledenGidsWeg('k3');
  assert.equal(pool._geland.size, 0, 'de rij is echt uit de tabel');
  assert.equal(await gidsen.ledenGidsExact('grijze-reiger-33'), null,
    'een gewist lid mag NIET uit de omgekeerde cache blijven komen -- de rij is weg, alleen het geheugen praat nog');
  const zoek = await gidsen.ledenGidsZoek('grijze-reiger', 20);
  assert.equal(zoek.some(r => r.key === 'k3'), false, 'en ook het zoek-vangnet noemt hem niet meer');
});

test('4. HERNOEMEN laat geen spook achter onder de oude codenaam', async () => {
  const pool = maakNepPool(20);
  await gidsen.init(pool);
  gidsen.ledenGidsZet('k4', 'Oude-Naam-01', 'rtg');
  await new Promise(r => setTimeout(r, 60));
  assert.ok(await gidsen.ledenGidsExact('oude-naam-01'), 'de oude naam werkt eerst');

  gidsen.ledenGidsZet('k4', 'Nieuwe-Naam-02', 'rtg');
  await new Promise(r => setTimeout(r, 60));
  const nieuw = await gidsen.ledenGidsExact('nieuwe-naam-02');
  assert.equal(nieuw && nieuw.key, 'k4', 'de nieuwe naam wijst naar hetzelfde lid');

  /* En de oude naam? Die mag niet nog steeds naar k4 wijzen. Wel is "hij bestaat
     niet meer" het juiste antwoord; wat NIET mag is dat hij k4 teruggeeft, want
     dan is een lid onder twee namen te vinden en kan de oude naam later aan een
     ander worden uitgegeven. */
  const oud = await gidsen.ledenGidsExact('oude-naam-01');
  assert.ok(!oud || oud.key !== 'k4',
    'de oude codenaam wijst nog steeds naar dit lid -- een spook in de omgekeerde cache');
});
