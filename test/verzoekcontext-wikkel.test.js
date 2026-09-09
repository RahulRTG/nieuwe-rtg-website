/* ============================================================================
   DE WIKKEL VAN DE VERZOEKCONTEXT -- wat er in de opslag belandt, en wat niet.

   server/db/verzoekcontext.js geeft elk verzoek een eigen werkkopie: lezen gaat
   door een Proxy, schrijven landt in de kopie, en pas de requestcommit maakt er
   waarheid van. Twee dingen daaraan waren NIET getoetst, en dat bleek pas toen
   ze werden verbouwd:

     1. dat een WIKKEL die je in de opslag schrijft eerst wordt UITGEPAKT.
        Gebeurt dat niet, dan staat er een Proxy in de duurzame data die de hele
        verzoekcontext levend houdt. Een mutatie die losWaarde() uitschakelde
        liet op 9 september 2026 alle zeventien bestaande contexttoetsen groen.
     2. dat er per VAK een handler is en niet per object. Dat is geen
        smaakkwestie: per gewikkeld object werden er twaalf functieobjecten
        gebouwd, en dat was bij 100M leden de dominante allocatie van een
        leesverzoek -- gemeten 7,8 tot 30 seconden per ronde van 1500 verzoeken,
        met een heap die tussen 1,7 en 4,1 GB slingerde. Na de wijziging: 0,6
        seconde en een vlakke heap.

   De sleutel waarmee een wikkel zichzelf bekendmaakt is met opzet een
   module-PRIVÉ symbool. Toets 4 en 5 houden vast dat hij nergens uitlekt: wie
   hem kan zien, kan hem ook zetten.

   Draai los: node --test test/verzoekcontext-wikkel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const util = require('node:util');
const ctxmod = require('../server/db/verzoekcontext');

function bronMaken() {
  return { boeken: [{ id: 1, sub: { a: 1 } }, { id: 2, sub: { a: 2 } }], leden: [{ id: 9 }] };
}
/* Eén verzoek draaien en teruggeven wat er binnen gebeurde. */
function inVerzoek(bron, fn) {
  const ctx = ctxmod.nieuw({ method: 'POST', path: '/api/toets' });
  return ctxmod.voer(ctx, async () => {
    const uit = await fn(ctxmod.dataVoor(bron), ctx);
    return { uit, ctx };
  });
}

test('1. een wikkel die je in de opslag schrijft, wordt UITGEPAKT', async () => {
  const bron = bronMaken();
  const { ctx } = await inVerzoek(bron, (d) => {
    d.boeken[0].verwijzing = d.boeken[1];   // rechterkant is een wikkel
    ctxmod.noteerSave();
  });
  const vak = ctx.vakken.get('boeken');
  const opgeslagen = vak.waarde[0].verwijzing;
  assert.ok(!util.types.isProxy(opgeslagen),
    'er staat een Proxy in de werkkopie: die houdt de hele verzoekcontext levend');
  assert.equal(opgeslagen.id, 2, 'en het moet nog wel de juiste waarde zijn');
});

test('2. ook via defineProperty en via de wortel wordt er uitgepakt', async () => {
  const bron = bronMaken();
  const { ctx } = await inVerzoek(bron, (d) => {
    Object.defineProperty(d.boeken[0], 'viaDefine', { value: d.boeken[1], writable: true, enumerable: true, configurable: true });
    d.kopie = d.leden;                      // een wikkel op de WORTEL zetten
    ctxmod.noteerSave();
  });
  assert.ok(!util.types.isProxy(ctx.vakken.get('boeken').waarde[0].viaDefine), 'defineProperty pakte niet uit');
  assert.ok(!util.types.isProxy(ctx.vakken.get('kopie').waarde), 'de wortel pakte niet uit');
});

test('3. de gedeelde bron blijft onaangeroerd tot de commit', async () => {
  const bron = bronMaken();
  await inVerzoek(bron, (d) => { d.boeken[0].sub.a = 999; ctxmod.noteerSave(); });
  assert.equal(bron.boeken[0].sub.a, 1, 'het verzoek schreef rechtstreeks in de gedeelde data');
});

test('4. het herkenningssymbool lekt nergens uit', async () => {
  const bron = bronMaken();
  await inVerzoek(bron, (d) => {
    const rij = d.boeken[0];
    const symbolen = Object.getOwnPropertySymbols(rij);
    assert.deepEqual(symbolen, [], 'de wikkel toont een eigen symbool');
    assert.equal(Reflect.ownKeys(rij).length, Object.keys(bron.boeken[0]).length);
    assert.equal(JSON.stringify(rij), JSON.stringify(bron.boeken[0]),
      'de wikkel serialiseert anders dan het origineel');
  });
});

test('5. een gewoon object overleeft losWaarde ongeschonden', async () => {
  const bron = bronMaken();
  const vers = { nieuw: true, diep: { x: 1 } };
  const { ctx } = await inVerzoek(bron, (d) => { d.boeken[0].vers = vers; ctxmod.noteerSave(); });
  assert.equal(ctx.vakken.get('boeken').waarde[0].vers.diep.x, 1);
});

test('6. er is EEN handler per vak, niet een per object', async () => {
  const bron = bronMaken();
  /* Een collectie met veel rijen: zonder deze regel groeit het aantal
     handlers met het aantal gelezen objecten, en dat was de kostenpost. */
  bron.boeken = Array.from({ length: 200 }, (_, i) => ({ id: i, sub: { a: i } }));
  const { ctx } = await inVerzoek(bron, (d) => {
    let n = 0;
    for (const r of d.boeken) n += r.sub.a;
    return n;
  });
  assert.equal(ctx.handlers.size, 1,
    'er hoort één handler per vak te zijn, gevonden: ' + ctx.handlers.size);
});

test('7. twee verzoeken zien elkaars werkkopie niet', async () => {
  const bron = bronMaken();
  const a = ctxmod.nieuw({ method: 'POST', path: '/a' });
  const b = ctxmod.nieuw({ method: 'POST', path: '/b' });
  await ctxmod.voer(a, async () => {
    ctxmod.dataVoor(bron).boeken[0].sub.a = 111; ctxmod.noteerSave();
    await ctxmod.voer(b, async () => {
      assert.equal(ctxmod.dataVoor(bron).boeken[0].sub.a, 1,
        'verzoek B ziet de nog niet gecommitte wijziging van A');
    });
  });
});
