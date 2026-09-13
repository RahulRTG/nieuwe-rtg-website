/* HET LOGBOEK VAN EEN ZAAK IS TERUG TE LEZEN -- POST /api/supplier/activity.

   WAAROM DEZE TOETS BESTAAT. logActivity() (server/opzet/leverancierpoort.js)
   schrijft sinds jaar en dag elke handeling van een medewerker naar
   db.data.supplierActivity[code] en stuurt er een sync-signaal met scope 'team'
   achteraan. Er was alleen geen enkele route die die bak teruggaf -- niet aan de
   zaak, niet aan het kantoor. "Wie zette deze zaak online?" was daardoor niet te
   beantwoorden terwijl het antwoord al die tijd in de opslag stond. Een spoor
   dat nergens uitkomt is geen spoor.

   Gevonden door scripts/zaakliveproef.js (storing 6), die de hele keten van een
   goedgekeurde aanvraag naar een zichtbare zaak loopt. Die proef draait tegen
   een echte server; deze toets pakt de HANDLER zelf, want de drie dingen die
   hieronder vastliggen zijn eigenschappen van die twintig regels en niet van de
   keten eromheen.

   DRIE DINGEN DIE NIET MOGEN SNEUVELEN.

   1. DE ZAAK LEEST HAAR EIGEN BAK, EN ALLEEN DIE. De code komt uit de SESSIE
      (req.supplier.code) en nooit uit het lichaam. Zou hij uit het lichaam
      komen, dan is deze leesroute een sleutel op het logboek van elke andere
      zaak -- precies wat scripts/gluurronde.js elders opspoort.
   2. MANAGER-ONLY. Het logboek zet handelingen op NAAM van collega's, en dat is
      personeelsinformatie. Dezelfde regel als bij /api/supplier/finance.
   3. HIJ VERANDERT NIETS. De route draagt het mutatiecontract NOT_APPLICABLE
      (server/lib/mutatiecontracten-leest-zaak.js), en dat is een bewering die
      een toets hoort te dragen: geen save(), geen logActivity(), en de
      onderliggende lijst blijft ongemoeid -- slice() muteert niet.

   Draai los: node --test test/supplier-activity.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const PAD = '/api/supplier/activity';

/* De route-module wordt gemonteerd op een NAGEBOUWDE app zodat de echte handler
   draait. Geen server, geen database: dit gaat over wat die handler met zijn
   invoer doet. */
function monteer(db) {
  const routes = {};
  const geschreven = { save: 0, log: 0 };
  const kern = {
    app: { post: (pad, ...rest) => { routes[pad] = rest[rest.length - 1]; } },
    db,
    supplierAuth: (req, res, next) => next(),
    managerOnly: (req, res) => {
      if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; }
      return true;
    },
    save: () => { geschreven.save++; },
    logActivity: () => { geschreven.log++; },
    /* De rest van tafels-team.js pakt deze namen bij het monteren; ze worden
       door DEZE route niet gebruikt en hoeven dus alleen te bestaan. */
    TABLE_STATUSES: [], accounts: {}, broadcastSync: () => {}, crypto: require('crypto'),
    notifySupplier: () => {}, sseClients: {}, sseSend: () => {}, sseToOffice: () => {},
    sseToSupplier: () => {}
  };
  require('../server/routes/supplier/tafels-team')(kern);
  return { routes, geschreven };
}
function antwoord() {
  const uit = { code: 200, lijf: null };
  const res = { status: (c) => { uit.code = c; return res; }, json: (d) => { uit.lijf = d; return res; } };
  return { res, uit };
}
const wereld = (rijen) => ({ data: { supplierActivity: { MIJN: rijen, ANDER: [{ who: 'Vreemde', text: 'geheim' }] } } });
const rij = (n) => Array.from({ length: n }, (_, i) => ({ who: 'Medewerker', text: 'handeling ' + i, at: '2026-09-13T00:00:00Z' }));

test('1. de route bestaat en geeft het logboek van de eigen zaak terug', () => {
  const { routes } = monteer(wereld(rij(3)));
  const h = routes[PAD];
  assert.ok(h, PAD + ' is niet geregistreerd');
  const { res, uit } = antwoord();
  h({ supplier: { code: 'MIJN' }, actor: { manager: true }, body: {} }, res);
  assert.equal(uit.code, 200);
  assert.equal(uit.lijf.totaal, 3);
  assert.equal(uit.lijf.activity.length, 3);
});

test('2. de zaakcode komt uit de sessie en NOOIT uit het lichaam', () => {
  /* De scherpste regel van deze route. Zou het lichaam de code mogen zetten,
     dan leest elke zaak het logboek van elke andere. */
  const { routes } = monteer(wereld(rij(2)));
  const { res, uit } = antwoord();
  routes[PAD]({ supplier: { code: 'MIJN' }, actor: { manager: true }, body: { code: 'ANDER' } }, res);
  assert.equal(uit.lijf.totaal, 2, 'het lichaam mocht de zaak verleggen');
  assert.ok(!JSON.stringify(uit.lijf).includes('geheim'),
    'het logboek van een andere zaak lekte mee');
});

test('3. geen manager, geen logboek', () => {
  const { routes } = monteer(wereld(rij(3)));
  const { res, uit } = antwoord();
  routes[PAD]({ supplier: { code: 'MIJN' }, actor: { manager: false }, body: {} }, res);
  assert.equal(uit.code, 403);
  assert.equal(uit.lijf.activity, undefined);
});

test('4. het aantal wordt begrensd, ook bij onzin in het lichaam', () => {
  const { routes } = monteer(wereld(rij(80)));
  for (const [gevraagd, verwacht] of [[undefined, 40], [5, 5], [0, 40], [-3, 40], [500, 80], ['veel', 40]]) {
    const { res, uit } = antwoord();
    routes[PAD]({ supplier: { code: 'MIJN' }, actor: { manager: true }, body: { aantal: gevraagd } }, res);
    assert.equal(uit.lijf.activity.length, Math.min(verwacht, 80),
      'aantal=' + JSON.stringify(gevraagd) + ' gaf ' + uit.lijf.activity.length);
  }
});

test('5. hij verandert niets -- dat is wat NOT_APPLICABLE belooft', () => {
  const db = wereld(rij(4));
  const { routes, geschreven } = monteer(db);
  const voor = JSON.stringify(db.data.supplierActivity);
  const { res } = antwoord();
  routes[PAD]({ supplier: { code: 'MIJN' }, actor: { manager: true }, body: { aantal: 2 } }, res);
  assert.equal(geschreven.save, 0, 'de route riep save() aan');
  assert.equal(geschreven.log, 0, 'de route schreef zelf in het logboek dat hij leest');
  assert.equal(JSON.stringify(db.data.supplierActivity), voor, 'de onderliggende lijst is veranderd');
});

test('6. een zaak zonder enige handeling krijgt een lege lijst en geen fout', () => {
  /* Een verse zaak heeft nog geen spoor. Dat is een geldige toestand en geen
     storing -- een 404 hier zou een lege werkelijkheid als een defect tonen. */
  const { routes } = monteer({ data: {} });
  const { res, uit } = antwoord();
  routes[PAD]({ supplier: { code: 'VERS' }, actor: { manager: true }, body: {} }, res);
  assert.equal(uit.code, 200);
  assert.deepEqual(uit.lijf.activity, []);
  assert.equal(uit.lijf.totaal, 0);
});
