/* HET OORDEEL VAN DE IDEMPOTENTIEPROEF, los van een server.

   De ronde zelf (scripts/idemproef-route.js) heeft een echte server nodig en
   muteert onderweg; het oordeel is puur en hoort hier. Zelfde opzet als
   test/rolproef.test.js en test/invoerproef.test.js.

   WAT HIER HET ZWAARST WEEGT: de derde oproep. Zonder die ijking zou "de
   herhaling gaf hetzelfde antwoord" groen zijn voor elke route die sowieso
   altijd hetzelfde antwoordt -- duizenden routes die niets bewijzen. De toets
   die dat vasthoudt is de derde hieronder, en die is met een mutatie
   nagetrokken: haal de ijkvergelijking eruit en hij zakt.

   Draai los: node --test test/idemproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { weegHerhaling, gelijk, normaliseer, draaiIdemproef } = require('../scripts/lib/idemproef');

const ok = (data) => ({ status: 200, data });

/* ---------- het oordeel ---------- */

test('geen werk in de eerste oproep: dan valt er geen herhaling te beoordelen', () => {
  const o = weegHerhaling({ status: 400, data: { error: 'nee' } }, ok({}), ok({}));
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /geen werk/);
});

test('herhaald:true is het sterkste bewijs -- de server zegt het zelf', () => {
  const o = weegHerhaling(ok({ ok: true, id: 'a' }), ok({ ok: true, id: 'a', herhaald: true }), ok({ ok: true, id: 'b' }));
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /herhaald/);
});

test('DE IJKING: een antwoord dat niet op een nieuwe oproep reageert, bewijst niets', () => {
  /* A en C zijn gelijk, dus deze route antwoordt hetzelfde wat je ook doet.
     Dat B er ook gelijk aan is, zegt dan niets -- en zonder deze regel zou dat
     als bewijs tellen. Dit is de kern van de hele proef. */
  const zelfde = { ok: true, stand: 'ongewijzigd' };
  const o = weegHerhaling(ok(zelfde), ok(zelfde), ok(zelfde));
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /verandert niet per oproep/);
});

test('gelijk aan A terwijl C verschilt: dat is wel bewijs', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x1' }), ok({ id: 'x2' }));
  assert.equal(o.stand, 'beschermd');
});

test('de herhaling gaf een ander antwoord: hij deed het opnieuw', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x2' }), ok({ id: 'x3' }));
  assert.equal(o.stand, 'onbeschermd');
});

test('een geweigerde herhaling is ook geen tweede effect, maar wel een ander mechanisme', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), { status: 409, data: { error: 'al gebruikt' } }, ok({ id: 'x2' }));
  assert.equal(o.stand, 'beschermd');
  assert.match(o.reden, /geweigerd/);
});

test('zonder geslaagde ijkoproep wordt er niet geoordeeld', () => {
  const o = weegHerhaling(ok({ id: 'x1' }), ok({ id: 'x1' }), { status: 429, data: {} });
  assert.equal(o.stand, 'ongemeten');
  assert.match(o.reden, /ijkoproep/);
});

test('een tijdstempel in het antwoord maakt de proef scherper, niet valser', () => {
  /* De idempotentielaag geeft het BEWAARDE antwoord terug, dus met dezelfde
     klokwaarde. Een route die opnieuw rekent, verraadt zich juist. */
  assert.equal(weegHerhaling(ok({ t: '10:00', id: 1 }), ok({ t: '10:00', id: 1 }), ok({ t: '10:01', id: 2 })).stand, 'beschermd');
  assert.equal(weegHerhaling(ok({ t: '10:00', id: 1 }), ok({ t: '10:01', id: 2 }), ok({ t: '10:02', id: 3 })).stand, 'onbeschermd');
});

test('de vergelijking kijkt naar de hele inhoud, niet naar de sleutelvolgorde', () => {
  assert.equal(gelijk({ a: 1, b: [2, { c: 3 }] }, { b: [2, { c: 3 }], a: 1 }), true);
  assert.equal(gelijk({ a: 1 }, { a: 2 }), false);
  /* Diep verstopt telt ook mee: elk veld dat je zou uitzonderen is een plek waar
     een tweede effect zich kan verbergen. */
  assert.equal(gelijk({ x: { y: { z: [1] } } }, { x: { y: { z: [1, 1] } } }), false);
  assert.match(normaliseer({ b: 1, a: 2 }), /^\{"a"/);
});

/* ---------- de ronde ---------- */

test('drie oproepen per route, en de sleutel van de derde is een andere', async () => {
  const gezien = [];
  const post = async (pad, lijf) => { gezien.push(lijf.idem); return ok({ id: gezien.length }); };
  const uit = await draaiIdemproef({ post, routes: [{ method: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({ naam: 'proef' }) });
  assert.equal(gezien.length, 3);
  assert.equal(gezien[0], gezien[1], 'de eerste twee delen een sleutel');
  assert.notEqual(gezien[1], gezien[2], 'de derde is de ijking en heeft een verse sleutel');
  assert.equal(uit.perRoute['POST /api/x'].idempotentie, 'onbeschermd');
});

test('de ronde oordeelt NIET als geen enkele route een gevoelig antwoord gaf', async () => {
  const uit = await draaiIdemproef({ post: async () => ok({ stil: true }),
    routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }, { method: 'POST', pad: '/api/b', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({}) });
  assert.ok(uit.meterStuk, 'nul beoordeelde routes hoort een blinde ronde te zijn');
  assert.equal(uit.telling.ongemeten, 2);
});

test('een dood token wordt hernieuwd in plaats van als ongemeten geteld', async () => {
  let beurt = 0;
  const post = async () => (++beurt === 1 ? { status: 401, data: {} } : ok({ id: beurt }));
  const uit = await draaiIdemproef({ post, routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({}), hernieuw: async () => true });
  assert.equal(uit.hernieuwd, 1);
  assert.notEqual(uit.perRoute['POST /api/a'].idempotentie, 'ongemeten');
});
