/* TWEE GRENZEN DIE IN DE VORM ZITTEN, NIET IN EEN CONTROLE.

   Deze twee lagen zijn allebei gebouwd rond iets wat ze NIET doen, en dat is
   precies wat hier wordt vastgelegd:

   HERKOMST (bedrijf/herkomst.js) -- werk dat uit een andere RTG-app komt.
   1. DE VERWIJSVORM IS DE BESTAANDE (`rtg://soort/id`); alles wat daar niet op
      past, wordt geweigerd. Er komt geen tweede vorm naast.
   2. DE VERWIJZING WORDT NOOIT OPGELOST. Er reist geen titel, status of ander
      veld van de RTG-kant mee -- een werkruimtelid is geen RTG-lid.
   3. EEN SOORT DIE DIT HUIS NIET KENT, WORDT BEWAARD EN NIET GEGOKT. Geen link
      naar de homepage, maar de reden erbij.

   MIJN WERK (bedrijf/mijnwerk.js) -- waar was ik gebleven.
   4. ER IS GEEN PARAMETER OM NAAR IEMAND ANDERS TE VRAGEN. Twee leden krijgen
      elk hun eigen werk, en een meegestuurd lidId verandert daar niets aan.
   5. HET BEHEER-TOKEN KOMT ER NIET IN. Dat draagt alle rechten -- precies
      daarom; anders leest een beheerder het werk van iedereen.

   Draai los: node --experimental-sqlite --test test/werkgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkgrens-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, SAM, PIA, TICKET;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  const mk = async (naam, rollen) => {
    const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
    await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
    await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
    return { cred: { werkruimte: W, lidToken: a.lidToken }, lidId: a.lidId, naam };
  };
  SAM = await mk('Sam', ['service']);
  PIA = await mk('Pia', ['projectleider', 'service']);

  TICKET = (await api('/ticket/maak', Object.assign({ onderwerp: 'Bus 28 rijdt niet',
    prioriteit: 'hoog', wie: 'Sam' }, SAM.cred))).body.ticket;
  await api('/ticket/maak', Object.assign({ onderwerp: 'Kassa hapert', wie: 'Pia' }, SAM.cred));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. alleen de bestaande verwijsvorm wordt geaccepteerd', async () => {
  for (const kaduuk of ['bus 28', 'https://rtg.nl/voertuig/28', 'rtg:/zaak/GLAS', 'rtg://ZAAK/GLAS']) {
    const uit = await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id, ref: kaduuk }, SAM.cred));
    assert.equal(uit.status, 400, 'geweigerd: ' + kaduuk);
    assert.match(uit.body.let, /geen tweede verwijsvorm/i);
  }
});

test('2. een geldige verwijzing wordt bewaard en NIET opgelost', async () => {
  const uit = await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://zaak/GLAS' }, SAM.cred));
  assert.equal(uit.status, 200);
  assert.equal(uit.body.herkomst.soort, 'zaak');
  assert.equal(uit.body.herkomst.id, 'GLAS');
  assert.ok(uit.body.herkomst.opent.app.includes('GLAS'), 'er staat WAAR je hem opent');

  /* De harde bewering: er reist geen enkel veld van de RTG-kant mee. Het
     antwoord draagt alleen de verwijzing zelf. */
  const sleutels = Object.keys(uit.body.herkomst).sort();
  assert.deepEqual(sleutels, ['id', 'let', 'opent', 'ref', 'soort'],
    'geen titel, geen status, geen enkel opgehaald veld');
  assert.match(uit.body.herkomst.let, /wordt NIET opgelost/i);
});

test('3. een soort die dit huis niet kent, wordt bewaard en niet gegokt', async () => {
  await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://voertuig/28' }, SAM.cred));
  const uit = (await api('/herkomst', Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred))).body;
  assert.equal(uit.herkomst.soort, 'voertuig', 'de verwijzing staat er gewoon');
  assert.equal(uit.herkomst.opent, null, 'maar er wordt geen pagina gegokt');
  assert.match(uit.herkomst.let, /geen app om heen te gaan/i, 'met de reden erbij');
  assert.equal(uit.herkomst.door, 'Sam', 'en wie hem legde');
});

test('4. er is geen parameter om naar het werk van een ander te vragen', async () => {
  const sam = (await api('/mijnwerk', SAM.cred)).body;
  const pia = (await api('/mijnwerk', PIA.cred)).body;
  assert.equal(sam.wie.naam, 'Sam');
  assert.equal(pia.wie.naam, 'Pia');
  assert.equal(sam.openstaand.aantallen.tickets, 1, 'ieder ziet zijn eigen ticket');
  assert.equal(pia.openstaand.aantallen.tickets, 1);
  assert.ok(!JSON.stringify(sam.openstaand).includes('Kassa hapert'), 'Sam ziet het werk van Pia niet');

  /* En een meegestuurd lidId verandert er niets aan: de route leest het niet. */
  const poging = (await api('/mijnwerk', Object.assign({ lidId: PIA.lidId }, SAM.cred))).body;
  assert.equal(poging.wie.naam, 'Sam', 'het meegestuurde lidId wordt niet gelezen');
  assert.ok(!JSON.stringify(poging.openstaand).includes('Kassa hapert'));
});

test('5. het beheer-token komt er niet in', async () => {
  const uit = await api('/mijnwerk', { werkruimte: W, beheerToken: B });
  assert.equal(uit.status, 403, 'directie leest hier niet mee');
  assert.match(uit.body.let, /leuze/i, 'met de reden waarom dat geen detail is');
});

test('6. wat op naam staat, draagt de naamgrens mee', async () => {
  const sam = (await api('/mijnwerk', SAM.cred)).body;
  assert.equal(sam.naamgrens.opNaam, true);
  assert.match(sam.naamgrens.let, /niet op een sleutel/i,
    'de lijst gaat op naam, en dat wordt gezegd in plaats van verzwegen');
});
