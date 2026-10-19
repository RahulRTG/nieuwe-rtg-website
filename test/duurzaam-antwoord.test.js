/* vastleggen.antwoord() -- de derde vorm van server/lib/duurzaam.js.

   Een synchrone schrijver in het huispatroon (muteren, save(), en `{ ok }` of
   `{ status, error }` teruggeven) moet vanuit een ROUTE duurzaam kunnen worden
   omsloten zonder dat hij zelf async wordt; anders breekt elke binnenste
   aanroeper. Deze toets houdt de vier regels van die omsluiting vast, met een
   nagemaakte bundel zodat hij niets over de opslag zelf hoeft te weten -- wat
   de bundel werkelijk doet, bewijst test/saveduurzaam.test.js.

   Draai los: node --test test/duurzaam-antwoord.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakVastleggen = require('../server/lib/duurzaam');

/* Een bundel die werkt, en een die de commit niet kan bevestigen. */
const eerlijk = () => {
  const saves = [];
  return { saves, v: maakVastleggen({ bron: 'toets', store: 'json', save: () => saves.push(1),
    bijeen: async (fn) => { await fn(); } }) };
};
const liegend = () => maakVastleggen({ bron: 'toets', store: 'json', save: () => {},
  bijeen: async (fn) => { await fn(); throw new Error('niet vastgelegd (toets)'); } });

test('1. het antwoord van de schrijver komt terug als de opslag bevestigt', async () => {
  const { v, saves } = eerlijk();
  const uit = await v.antwoord(() => ({ ok: true, id: 'x1' }));
  assert.deepEqual(uit, { ok: true, id: 'x1' });
  assert.equal(saves.length, 1, 'de mutatie is binnen de bundel opgeslagen');
});

test('2. bevestigt de opslag niet, dan wint haar oordeel: 503', async () => {
  const uit = await liegend().antwoord(() => ({ ok: true, id: 'x1' }));
  assert.equal(uit.status, 503, 'een 2xx over een onbevestigde commit is een vals succes');
});

test('3. een weigering van de schrijver blijft zijn eigen weigering', async () => {
  const uit = await liegend().antwoord(() => ({ status: 404, error: 'Bestaat niet.' }));
  assert.equal(uit.status, 404, 'er viel niets vast te leggen; "probeer het zo nog eens" zou een lege belofte zijn');
});

test('4. een fout IN de schrijver gaat als fout omhoog, niet als opslagstoring', async () => {
  const { v } = eerlijk();
  await assert.rejects(v.antwoord(() => { throw new Error('programmeerfout'); }), /programmeerfout/);
});

test('5. een async schrijver wordt geweigerd: hij zou na de commit pas muteren', async () => {
  const { v } = eerlijk();
  await assert.rejects(v.antwoord(async () => ({ ok: true })), /SYNCHRONE schrijver/);
});
