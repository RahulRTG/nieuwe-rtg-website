/* ============================================================================
   MIJN RTG blok 2 -- de sessielijst en het sluiten.

   DE BEWERING DIE ERTOE DOET staat in toets 2: sluiten werkt ECHT. Dat is geen
   vanzelfsprekendheid maar precies de fout die dit huis al een keer heeft
   gemaakt -- /api/logout antwoordde { ok: true } terwijl het token daarna nog
   dertig dagen werkte (aanvalsronde 2, punt 14). Een knop die niets doet is bij
   beveiliging erger dan een knop die er niet is: de eerste laat iemand denken
   dat hij veilig is.

   En toets 3: een sid is geen geheim. Hij reist in een token dat een ander
   draagt, dus zonder eigendomscontrole kan ieder lid de sessie van een ander
   sluiten. Dat is een denial of service met twee regels curl.

   Draai los: node --test test/mijnsessies.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');

const nu = Date.now();
const hk = (m) => ({ bron: 'toets', methode: m, vastgesteldOp: new Date(nu).toISOString(), regelversie: 'v1' });
const register = () => maakSessieregister({ db: { data: {} }, save() {} });

/* De route bouwen op een nagemaakte app: we willen de HANDLERS toetsen, niet
   HTTP. Elke app.post legt zijn handler in een kaart; de toets roept hem aan
   met een verzoek en een antwoord die alleen kunnen wat hier nodig is. */
function bouwRoutes({ reg, ingetrokken }) {
  const routes = {};
  const app = { post: (pad, auth, fn) => { routes[pad] = fn; } };
  const accounts = {
    trekInSessie: (sid) => { ingetrokken.add(sid); return true; },
    sessieIngetrokken: (sid) => ingetrokken.has(sid)
  };
  require('../server/routes/member/sessies')({ app, auth: null, accounts, sessieregister: reg });
  return routes;
}
const antwoord = () => {
  const r = { code: 200, data: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (d) => { r.data = d; return r; };
  return r;
};
const verzoek = (sess, body) => ({ session: sess, body: body || {} });

test('1. de lijst toont per veld een graad, en nooit een verzonnen toestelnaam', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken: new Set() });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'aaaaaaaaaaaa' }), res);
  const s = res.data.sessies[0];
  assert.equal(s.stand.authenticator.graad, 'bewezen');
  assert.equal(s.stand.toestel.graad, 'onbekend', 'nooit vastgesteld hoort onbekend te zijn');
  assert.ok(s.stand.toestel.reden, 'en het hoort te zeggen waarom');
  assert.equal(JSON.stringify(s).includes('iPhone'), false);
  assert.equal(res.data.huidige, 'aaaaaaaaaaaa');
});

test('2. sluiten trekt de sessie ECHT in -- geen ok:true zonder gevolg', () => {
  const reg = register();
  const ingetrokken = new Set();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken });
  const res = antwoord();
  routes['/api/mijn/sessies/sluit'](
    verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'bbbbbbbbbbbb' }, { sid: 'aaaaaaaaaaaa' }), res);
  assert.equal(res.data.ok, true);
  assert.ok(ingetrokken.has('aaaaaaaaaaaa'), 'het token hoort op de intreklijst te staan, anders werkt het gewoon door');
  assert.equal(reg.lees('aaaaaaaaaaaa'), null, 'en de sessie hoort uit het register te zijn');
});

test('3. een sid is geen geheim: je sluit nooit de sessie van een ander', () => {
  const reg = register();
  const ingetrokken = new Set();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken });
  const res = antwoord();
  routes['/api/mijn/sessies/sluit'](
    verzoek({ tier: 'rtg', key: 'user-2', account: {}, sid: 'cccccccccccc' }, { sid: 'aaaaaaaaaaaa' }), res);
  assert.equal(res.code, 404);
  assert.equal(ingetrokken.size, 0, 'er mag niets zijn ingetrokken');
  assert.ok(reg.lees('aaaaaaaaaaaa'), 'en de sessie van de ander hoort nog te bestaan');
});

test('3b. "bestaat niet" en "niet van u" geven hetzelfde antwoord', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken: new Set() });
  const vanAnder = antwoord(), bestaatNiet = antwoord();
  routes['/api/mijn/sessies/sluit'](verzoek({ tier: 'rtg', key: 'user-2', account: {} }, { sid: 'aaaaaaaaaaaa' }), vanAnder);
  routes['/api/mijn/sessies/sluit'](verzoek({ tier: 'rtg', key: 'user-2', account: {} }, { sid: 'zzzzzzzzzzzz' }), bestaatNiet);
  assert.deepEqual(vanAnder.data, bestaatNiet.data,
    'een verschil hier maakt dit een manier om te ontdekken welke sessies bestaan');
});

test('4. "sluit alle andere" laat de eigen sessie met rust', () => {
  const reg = register();
  const ingetrokken = new Set();
  for (const sid of ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc']) {
    reg.open(sid, 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  }
  const routes = bouwRoutes({ reg, ingetrokken });
  const res = antwoord();
  routes['/api/mijn/sessies/sluit-overige'](verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'bbbbbbbbbbbb' }), res);
  assert.equal(res.data.aantal, 2);
  assert.equal(ingetrokken.has('bbbbbbbbbbbb'), false, 'wie dit doet, hoort niet zichzelf buiten te zetten');
  assert.ok(reg.lees('bbbbbbbbbbbb'), 'de eigen sessie blijft bestaan');
  assert.ok(res.data.nietGeraakt, 'en het antwoord zegt wat er NIET geraakt is');
});

test('4b. en raakt nooit de sessies van een ander lid', () => {
  const reg = register();
  const ingetrokken = new Set();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  reg.open('dddddddddddd', 'user-9', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken });
  routes['/api/mijn/sessies/sluit-overige'](verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'zzzzzzzzzzzz' }), antwoord());
  assert.equal(ingetrokken.has('dddddddddddd'), false);
  assert.ok(reg.lees('dddddddddddd'));
});

test('5. een sessie zonder identiteit wordt gemeld en niet verzwegen', () => {
  const reg = register();
  const routes = bouwRoutes({ reg, ingetrokken: new Set() });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {} }), res); // geen sid
  assert.ok(res.data.nietGetoond, 'een lijst die niet compleet is, hoort dat te zeggen');
  assert.match(res.data.nietGetoond, /niet in de lijst/);
});

test('6. een gast heeft hier niets te zoeken', () => {
  const routes = bouwRoutes({ reg: register(), ingetrokken: new Set() });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'guest', key: 'guest-1' }), res);
  assert.equal(res.code, 403);
});
