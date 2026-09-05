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
function bouwRoutes({ reg, ingetrokken, findSupplier }) {
  const routes = {};
  const app = { post: (pad, auth, fn) => { routes[pad] = fn; } };
  const accounts = {
    trekInSessie: (sid) => { ingetrokken.add(sid); return true; },
    sessieIngetrokken: (sid) => ingetrokken.has(sid)
  };
  require('../server/routes/member/sessies')({ app, auth: null, accounts, sessieregister: reg, findSupplier });
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

test('2. sluiten trekt de sessie ECHT in -- geen ok:true zonder gevolg', async () => {
  const reg = register();
  const ingetrokken = new Set();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken });
  const res = antwoord();
  await routes['/api/mijn/sessies/sluit'](
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

test('4. "sluit alle andere" laat de eigen sessie met rust', async () => {
  const reg = register();
  const ingetrokken = new Set();
  for (const sid of ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc']) {
    reg.open(sid, 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  }
  const routes = bouwRoutes({ reg, ingetrokken });
  const res = antwoord();
  await routes['/api/mijn/sessies/sluit-overige'](verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'bbbbbbbbbbbb' }), res);
  assert.equal(res.data.aantal, 2);
  assert.equal(ingetrokken.has('bbbbbbbbbbbb'), false, 'wie dit doet, hoort niet zichzelf buiten te zetten');
  assert.ok(reg.lees('bbbbbbbbbbbb'), 'de eigen sessie blijft bestaan');
  assert.ok(res.data.nietGeraakt, 'en het antwoord zegt wat er NIET geraakt is');
});

test('4b. en raakt nooit de sessies van een ander lid', async () => {
  const reg = register();
  const ingetrokken = new Set();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  reg.open('dddddddddddd', 'user-9', { authenticator: { type: 'passkey', authenticatorId: 'c', herkomst: hk('cryptografisch') } });
  const routes = bouwRoutes({ reg, ingetrokken });
  await routes['/api/mijn/sessies/sluit-overige'](verzoek({ tier: 'rtg', key: 'user-1', account: {}, sid: 'zzzzzzzzzzzz' }), antwoord());
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

/* ---------------------------------------------------------------------------
   DE SOORT EN DE GRAAD ZIJN TWEE DINGEN. De soort zegt WAT het was, de graad
   hoe zeker wij dat weten. Het scherm raadde de soort eerst uit de graad
   ("bewezen dus een passkey"), en dat klopt precies zolang er twee manieren van
   inloggen zijn. Er zijn er inmiddels vier.
   ------------------------------------------------------------------------- */
test('5e. de lijst geeft de soort mee, los van de graad', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'sleutelwoorden', herkomst: hk('gemeten') } });
  reg.open('bbbbbbbbbbbb', 'user-1', { authenticator: { type: 'overdracht', herkomst: hk('afgeleid') } });
  const routes = bouwRoutes({ reg, ingetrokken: new Set() });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {} }), res);
  const per = Object.fromEntries(res.data.sessies.map(s => [s.soort, s.stand.authenticator.graad]));
  assert.equal(per.sleutelwoorden, 'gemeten');
  assert.equal(per.overdracht, 'vermoed', 'een overgedragen sessie is nooit zelf gezien; afgeleid geeft vermoed');
  assert.ok('sleutelwoorden' in per && 'overdracht' in per,
    'zonder soort moet een scherm hem uit de graad raden, en dat gaat stuk zodra er een derde manier bij komt');
});

/* ---------------------------------------------------------------------------
   NAMENS WIE. Twee dingen die niet mogen schuiven: de sessie draagt een CODE en
   nooit een naam (zelfde reden als bij het toestel -- zij repliceert over een
   bus), en een naam die niet meer op te zoeken is wordt null en geen gok.
   ------------------------------------------------------------------------- */
test('5f. de sessie draagt de contextcode, de naam komt van de bron', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { context: { contextId: 'ZAAK7', contextSoort: 'zaak', contextVersie: 1,
    herkomst: hk('gemeten') } });
  const rauw = JSON.stringify(reg.lees('aaaaaaaaaaaa'));
  assert.equal(rauw.includes('Bloomingdale'), false, 'een bedrijfsnaam hoort niet in de sessie');

  const routes = bouwRoutes({ reg, ingetrokken: new Set(),
    findSupplier: (code) => (code === 'ZAAK7' ? { code, naam: 'Bloomingdale' } : null) });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {} }), res);
  assert.equal(res.data.sessies[0].contextNaam, 'Bloomingdale');
  assert.equal(res.data.sessies[0].contextId, 'ZAAK7');
});

/* DEZE TOETS KWAM UIT DE MUTATIEPROEF. 5f keek alleen naar wat er OPGESLAGEN
   ligt, dus een naam die het register in zijn projectie verzon bleef groen. De
   scherpere regel is structureel: het register levert geen contextNaam, punt.
   Dat opzoeken is het werk van de route, bij de partij die de naam bezit. */
test('5f2. het register levert GEEN naam -- dat is werk van de route', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { context: { contextId: 'ZAAK7', contextSoort: 'zaak', contextVersie: 1,
    herkomst: hk('gemeten') } });
  const rij = reg.vanLid('user-1')[0];
  assert.equal('contextNaam' in rij, false,
    'zou het register een naam leveren, dan heeft hij een tweede bron voor iets dat elders al bestaat');
  assert.equal('toestelNaam' in rij, false);
  assert.equal(rij.contextId, 'ZAAK7');
});

test('5g. een zaak die niet meer bestaat geeft null, nooit een gok', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { context: { contextId: 'WEG', contextSoort: 'zaak', contextVersie: 1,
    herkomst: hk('gemeten') } });
  const routes = bouwRoutes({ reg, ingetrokken: new Set(), findSupplier: () => null });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {} }), res);
  assert.equal(res.data.sessies[0].contextNaam, null,
    'een verkeerde bedrijfsnaam naast "sluit deze sessie" is een dure vergissing');
});

test('5h. persoonlijk heet Uzelf en heeft geen bron nodig', () => {
  const reg = register();
  reg.open('aaaaaaaaaaaa', 'user-1', { context: { contextId: 'persoonlijk', contextSoort: 'persoonlijk',
    contextVersie: 1, herkomst: hk('gemeten') } });
  const routes = bouwRoutes({ reg, ingetrokken: new Set(), findSupplier: () => { throw new Error('niet opzoeken'); } });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'rtg', key: 'user-1', account: {} }), res);
  assert.equal(res.data.sessies[0].contextNaam, 'Uzelf');
});

/* OOK UIT DE MUTATIEPROEF: dat een werksessie een sid krijgt, stond nergens
   vast. Zonder sid staat een werkplek-inlog niet in "waar ben ik aanwezig" en
   is hij dus ook niet te sluiten -- terwijl een kassa op een gedeelde computer
   juist de sessie is die je wilt kunnen afsluiten. */
test('5i. ook een werksessie krijgt een sessie-identiteit', () => {
  const { maakSessies } = require('../server/kern/sessies');
  const crypto = require('crypto');
  const S = maakSessies({ db: { data: {} }, save() {}, crypto });
  const sess = { role: 'supplier', code: 'ZAAK7', lidKey: 'user-1' };
  S.rememberSession('tok-abc', sess);
  assert.match(String(sess.sid), /^[A-Za-z0-9_-]{12}$/, 'zonder sid is deze sessie niet aanwijsbaar en dus niet te sluiten');
  assert.equal(S.sessionFor('tok-abc').sid, sess.sid);
});

test('5j. en een intrekking op de sid werkt ook op een werksessie', () => {
  const { maakSessies } = require('../server/kern/sessies');
  const crypto = require('crypto');
  const buiten = new Set();
  const S = maakSessies({ db: { data: {} }, save() {}, crypto, sessieIngetrokken: (sid) => buiten.has(sid) });
  const sess = { role: 'supplier', code: 'ZAAK7', lidKey: 'user-1' };
  S.rememberSession('tok-abc', sess);
  assert.ok(S.sessionFor('tok-abc'), 'eerst gewoon geldig');
  buiten.add(sess.sid);
  assert.equal(S.sessionFor('tok-abc'), null,
    'een knop die op de ene soort sessie werkt en op de andere niet, is erger dan geen knop');
});

test('6. een gast heeft hier niets te zoeken', () => {
  const routes = bouwRoutes({ reg: register(), ingetrokken: new Set() });
  const res = antwoord();
  routes['/api/mijn/sessies'](verzoek({ tier: 'guest', key: 'guest-1' }), res);
  assert.equal(res.code, 403);
});
