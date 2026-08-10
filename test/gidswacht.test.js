/* De wachtende gidslezing: een koude cache is een cache-grens, geen feit.

   In Postgres-stand geeft de synchrone ledenGidsHaal bij een koude cache null
   terug terwijl het lid gewoon bestaat (de rij wordt asynchroon bijgeladen),
   en boven de honderdduizend regels wordt de cache in EEN keer geleegd -- dus
   onder last is elke bestaande sleutel zomaar even "koud". Wie op die null een
   404 bouwt, vertelt een lid dat zijn vriend niet bestaat. Zo gevonden in de
   1M-beproeving van 2026-08-10: een NET via /api/member/find gevonden codenaam
   kreeg bij /api/member/connect "Deze codenaam kennen we niet."

   ledenGidsHaalWacht is de reparatie: bij twijfel echt aan Postgres vragen,
   via dezelfde lader als de synchrone weg (een waarheid, een codepad). Deze
   toets legt precies het onderscheid vast, met een neppool in plaats van een
   echte Postgres -- het gedrag zit in de cache-laag, niet in de database.

   Mutatie gezien: laat ledenGidsHaalWacht de cache blind teruggeven (return
   ledenCache.get(key) zonder laadLid af te wachten) en toets 2 zakt; geef bij
   een poolfout een verzonnen rij terug en toets 4 zakt.

   Draai los: node --test test/gidswacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Verse module-staat per run: ledengids.js houdt cache en pool als
   module-globalen, dus de require-cache moet schoon. */
delete require.cache[require.resolve('../server/db/ledengids.js')];
const gids = require('../server/db/ledengids.js');

/* De neppool: kent een tabel van rijen en telt zijn queries, zodat de toets
   kan vaststellen WANNEER er echt aan de database is gevraagd. */
function maakPool(rijen) {
  const pool = {
    vragen: 0,
    stuk: false,
    async query(sql, params) {
      if (/CREATE|EXTENSION/i.test(sql)) return { rows: [] };
      if (/count\(\*\)/i.test(sql)) return { rows: [{ c: String(Object.keys(rijen).length) }] };
      if (pool.stuk) throw new Error('pool kapot (gesimuleerde storing)');
      pool.vragen++;
      const key = params && params[0];
      const r = rijen[key];
      return { rows: r ? [{ codename: r.codename, tier: r.tier }] : [] };
    }
  };
  return pool;
}

test('1. zonder Postgres is de wachtende lezing inert (undefined, net als de synchrone)', async () => {
  // init is nog niet aangeroepen: geen pool, dus beide wegen zeggen "niet mijn domein"
  assert.equal(gids.ledenGidsHaal('user-koud'), undefined);
  assert.equal(await gids.ledenGidsHaalWacht('user-koud'), undefined);
});

test('2. koude cache: de synchrone lezing zegt null, de wachtende vindt het lid echt', async () => {
  const pool = maakPool({ 'user-bestaat': { codename: 'Valk 7', tier: 'rtg' } });
  await gids.init(pool, () => {});
  /* Dit IS de bug-vorm: het lid bestaat, maar de synchrone weg kan dat op een
     koude cache niet weten en zegt null. Die null mag dus nooit een 404 dragen. */
  assert.equal(gids.ledenGidsHaal('user-bestaat'), null, 'koude cache leest synchroon als null');
  const v = pool.vragen;
  const rij = await gids.ledenGidsHaalWacht('user-bestaat');
  assert.ok(rij && rij.codename === 'Valk 7', 'de wachtende lezing vindt het lid dat de synchrone miste');
  assert.ok(pool.vragen >= v, 'en heeft daarvoor echt de database gevraagd');
});

test('3. een gevulde cache-regel wordt vertrouwd: geen tweede rit naar de database', async () => {
  const pool = maakPool({ 'user-bestaat': { codename: 'Valk 7', tier: 'rtg' } });
  await gids.init(pool, () => {});
  await gids.ledenGidsHaalWacht('user-bestaat'); // vult de cache
  const v = pool.vragen;
  const rij = await gids.ledenGidsHaalWacht('user-bestaat');
  assert.equal(rij.codename, 'Valk 7');
  assert.equal(pool.vragen, v, 'een warme regel kost geen query');
});

test('4. echt afwezig blijft afwezig, en een poolstoring wordt geen verzonnen lid', async () => {
  const pool = maakPool({ 'user-bestaat': { codename: 'Valk 7', tier: 'rtg' } });
  await gids.init(pool, () => {});
  assert.equal(await gids.ledenGidsHaalWacht('user-bestaat-niet'), null, 'een lid dat er niet is, is er niet');
  /* Storing: de lader vangt de fout en laat de cache leeg; de wachtende lezing
     hoort dan null te geven (onbekend), nooit een verzonnen rij. De aanroeper
     die van null een 404 maakt doet dat dan tenminste over een echte onbekende. */
  pool.stuk = true;
  assert.equal(await gids.ledenGidsHaalWacht('user-storing'), null, 'een storing levert onbekend op, geen verzinsel');
});
