/* Inloggen bij een zaak: op een plek, met een teller die klopt.

   Deze module bestaat omdat er TWEE implementaties van dezelfde handeling
   stonden -- de genrewereld en de proefsleutels deden allebei rooster+login --
   en de tweede kostte een slot van een rem die maar dertig opvragingen per
   kwartier toestaat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { maakZaakinlog, MANAGER_PIN } = require('../scripts/lib/zaakinlog');

function nepPost(plan) {
  const gedaan = [];
  return {
    gedaan,
    post: async (pad, lijf) => {
      gedaan.push(pad);
      if (pad === '/api/supplier/roster') return plan.roster(lijf.code);
      if (pad === '/api/supplier/login') return plan.login(lijf);
      return { status: 404, data: {} };
    }
  };
}

const goedRooster = (code) => ({ status: 200,
  data: { supplier: { code, type: 'restaurant' }, staff: [{ id: 7, role: 'manager' }] } });

test('een geslaagde inlog geeft een token en het gemeten genre', async () => {
  const n = nepPost({ roster: goedRooster, login: () => ({ status: 200, data: { token: 'T' } }) });
  const b = maakZaakinlog({ post: n.post });
  const uit = await b.inlog('kikunoi');
  assert.equal(uit.token, 'T');
  assert.equal(uit.genre, 'restaurant');
  assert.equal(uit.waarom, null);
});

/* DE HELE REDEN VOOR DEZE MODULE: twee vragen om dezelfde zaak kosten een
   opvraging. Zonder cache liep de proef tegen de rem aan. */
test('dezelfde zaak twee keer kost een opvraging', async () => {
  const n = nepPost({ roster: goedRooster, login: () => ({ status: 200, data: { token: 'T' } }) });
  const b = maakZaakinlog({ post: n.post });
  await b.inlog('KIKUNOI');
  await b.inlog('kikunoi');
  assert.equal(b.verbruikt(), 1, 'de tweede vraag hoort uit de cache te komen');
  assert.equal(n.gedaan.filter(p => p === '/api/supplier/roster').length, 1);
});

test('de teller telt wat er werkelijk is opgevraagd', async () => {
  const n = nepPost({ roster: goedRooster, login: () => ({ status: 200, data: { token: 'T' } }) });
  const b = maakZaakinlog({ post: n.post });
  await b.inlog('EEN'); await b.inlog('TWEE'); await b.inlog('EEN');
  assert.equal(b.verbruikt(), 2);
  assert.deepEqual(b.gekend().sort(), ['EEN', 'TWEE']);
});

/* Een zaak die niet opengaat is een UITSLAG en geen storing: de aanroeper moet
   hem met reden kunnen melden in plaats van een uitzondering te vangen. */
test('een onbekende zaak gooit niet maar meldt', async () => {
  const n = nepPost({ roster: () => ({ status: 404, data: { error: 'Deze leverancierscode kennen we niet.' } }),
    login: () => ({ status: 200, data: {} }) });
  const b = maakZaakinlog({ post: n.post });
  const uit = await b.inlog('BESTAATNIET');
  assert.equal(uit.token, null);
  assert.match(uit.waarom, /kennen we niet/);
});

test('een zaak zonder manager meldt dat, en probeert geen login', async () => {
  const n = nepPost({ roster: (code) => ({ status: 200, data: { supplier: { code, type: 'x' }, staff: [{ id: 1, role: 'staff' }] } }),
    login: () => ({ status: 200, data: { token: 'T' } }) });
  const b = maakZaakinlog({ post: n.post });
  const uit = await b.inlog('GEENBAAS');
  assert.equal(uit.token, null);
  assert.match(uit.waarom, /geen manager/);
  assert.equal(n.gedaan.filter(p => p === '/api/supplier/login').length, 0);
});

/* De PIN is een demogegeven en hoort op een plek te staan. */
test('de manager-pin komt uit de seed en staat er een keer', () => {
  assert.equal(MANAGER_PIN, '1234');
});
