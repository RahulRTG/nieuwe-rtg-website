/* ============================================================================
   DE SNELLE RIJSTROOK STELDE ZICHZELF UIT.

   server/pg/sync.js kent twee remmen op GROTE collecties (>512 kB): hooguit
   eens per PG_GROOT_FLUSH_MS echt wegschrijven, en bij een gelijk aantal items
   de dure JSON.stringify overslaan. Allebei terecht -- de stringify van een
   venster van tienduizenden orders bij elke flush-cyclus van 150 ms blokkeert
   de event-loop structureel.

   Maar diezelfde flush() draait ook de VOORRANG-strook: de idempotentie-boeken
   van RTG Pay en RTG Bank (`alleen`). Die strook bestaat juist omdat die
   sleutels NU weg moeten -- nog niet gedeeld is daar het verschil tussen een
   keer en twee keer afschrijven. De remmen keken alleen naar grootte, dus
   zodra payIdem over 512 kB groeide -- precies onder de drukte waarvoor de
   strook bedoeld is -- stelde de snelle strook zichzelf uit en was de winst
   weg.

   Deze toets draait flush() rechtstreeks met een nagemaakte pool: geen
   Postgres nodig, want wat hier bewezen wordt is de BESLISSING om te schrijven,
   niet het schrijven zelf.

   Draai los: node --test test/pgsync-voorrang.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Een pool die net genoeg doet om flush() te laten lopen: elke schrijf landt in
   `geschreven`, zodat we kunnen zien WELKE collecties echt weggingen. */
function maakCtx() {
  const geschreven = [];
  let ver = 0;
  const client = {
    query: async (sql, args) => {
      if (/^SELECT val, ver FROM kv/.test(sql)) return { rows: [] };
      if (/nextval/.test(sql)) return { rows: [{ v: ++ver }] };
      if (/^INSERT INTO kv/.test(sql)) { geschreven.push(args[0]); return { rows: [] }; }
      return { rows: [] };
    },
    release: () => {}
  };
  const ctx = {
    pool: { connect: async () => client },
    merge3: (a, b) => b,
    uitStore: v => v, naarStore: v => v,
    vlag: { uitgesteld: false },
    toegepast: new Map(), laatsteJson: new Map(), laatsteGrootte: new Map(),
    laatsteLengte: new Map(), laatsteCheck: new Map()
  };
  const { flush, VOORRANG } = require('../server/pg/sync')(ctx);
  return { ctx, flush, VOORRANG, geschreven };
}

// Een collectie die zeker boven de 512 kB uitkomt, met een instelbaar aantal items.
function grootBoek(n, merk) {
  const uit = {};
  for (let i = 0; i < n; i++) uit['k' + i] = { i, merk, vul: 'x'.repeat(600) };
  return uit;
}

test('1. de gewone flush remt een grote collectie -- dat blijft zo', async () => {
  const { flush, geschreven, ctx } = maakCtx();
  const data = { orders: grootBoek(1000, 'a') };

  assert.equal(await flush(data), 1, 'de eerste ronde schrijft hem gewoon weg');
  assert.ok(geschreven.includes('orders'));
  assert.ok(ctx.laatsteGrootte.get('orders') > 512 * 1024, 'en hij telt als GROOT');

  // meteen daarna nog een ronde met echt gewijzigde inhoud: die wordt uitgesteld
  geschreven.length = 0;
  data.orders = grootBoek(1000, 'b');
  assert.equal(await flush(data), 0, 'binnen PG_GROOT_FLUSH_MS gaat hij niet nog eens');
  assert.equal(ctx.vlag.uitgesteld, true, 'en dat wordt gemeld, zodat de schrijver vuil blijft');
});

/* DE BEWERING DIE ERTOE DOET. Zelfde collectie, zelfde grootte, zelfde moment
   -- maar nu via de VOORRANG-strook. Die kent geen uitstel. */
test('2. de snelle rijstrook stelt niet uit, ook niet als de sleutel groot is', async () => {
  const { flush, geschreven, ctx } = maakCtx();
  const alleen = new Set(['payIdem']);
  const data = { payIdem: grootBoek(1000, 'a') };

  assert.equal(await flush(data, false, alleen), 1, 'de eerste ronde schrijft weg');
  assert.ok(ctx.laatsteGrootte.get('payIdem') > 512 * 1024, 'payIdem is hier echt GROOT');

  geschreven.length = 0;
  data.payIdem = grootBoek(1000, 'b');
  assert.equal(await flush(data, false, alleen), 1,
    'en de volgende ronde OOK -- geld wacht niet op een venster van vijf seconden');
  assert.deepEqual(geschreven, ['payIdem']);
  assert.equal(ctx.vlag.uitgesteld, false, 'de strook zet de uitstel-vlag niet: er is niets uitgesteld');
});

/* De tweede rem: bij een gelijk AANTAL items de dure stringify overslaan. Voor
   de idem-boeken is dat precies verkeerd -- een sleutel die van "bezig" naar
   "klaar" gaat verandert het aantal niet, en juist die overgang moet weg. */
test('3. een wijziging-op-zijn-plaats gaat op de snelle strook meteen mee', async () => {
  const { flush, geschreven, ctx } = maakCtx();
  const alleen = new Set(['payIdem']);
  const boek = grootBoek(1000, 'a');
  const data = { payIdem: boek };
  await flush(data, false, alleen);

  geschreven.length = 0;
  boek.k0.status = 'klaar';            // zelfde aantal items, andere inhoud
  assert.equal(await flush(data, false, alleen), 1,
    'gelijk aantal is geen reden om een idem-sleutel te laten liggen');
  assert.equal(ctx.laatsteLengte.get('payIdem'), 1000, 'het aantal is inderdaad niet veranderd');
});

test('4. de twee stroken blijven uit elkaars sleutels: geen dubbel werk', async () => {
  const { flush, geschreven, VOORRANG } = maakCtx();
  assert.ok(VOORRANG.has('payIdem') && VOORRANG.has('bankIdem'), 'de geld-sleutels zitten in de strook');
  const data = { payIdem: { a: 1 }, orders: [{ id: 1 }] };

  await flush(data, false, new Set(['payIdem']));
  assert.deepEqual(geschreven, ['payIdem'], 'de strook schrijft alleen haar eigen sleutels');

  geschreven.length = 0;
  await flush(data);
  assert.deepEqual(geschreven, ['orders'], 'en de gewone flush slaat die juist over');
});
