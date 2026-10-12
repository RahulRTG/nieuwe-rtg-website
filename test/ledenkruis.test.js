/* DE LEDENKRUIS -- het oordeel van bewijs 6 (bevoegd) aan de schermkant van een
   ledenscherm (scripts/lib/ledenkruis.js), zonder browser.

   De meting zelf loopt in een echte browser tegen een echte server
   (scripts/bevoegdronde.js); hier staat het OORDEEL vast, want daar zit de
   verleiding om iets groen te laten worden:

     1. Een merkteken van A in het antwoord aan een ander is een lek -- behalve
        als de ander dat woord zelf meestuurde.
     2. Een handeling van A die zonder sessie slaagt, is open; een andere
        sessie die 2xx krijgt zonder merkteken is "eigen" en geen lek.
     3. Een stand van A die na de pogingen van de anderen anders terugkomt, is
        aangetast; tijdstempels tellen daarbij niet, getallen wel.
     4. Geen onderwerp, geen uitslag: zonder iets van A op het scherm is
        "een ander zag niets" NIET_GETEST.
     5. Het eigen lid wel: een lezer of handeling die A zelf geweigerd kreeg,
        maakt de rij NIET_GETEST.
     6. De rem (429) is onbeslist en nooit geweigerd.
     7. De bevoegdronde laat de kruis het ROLPROEF-deel alleen vervangen voor
        de schrijfroutes die hij werkelijk raakte.
     8. Een handeling op een object van A die bij een ander slaagt, is een
        inbreuk (de tegenlezer, mutatie M1).
     9. De codenaam is een merkteken, behalve op de verklaarde gedeelde routes
        (de tegenlezer, mutatie M3b). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../scripts/lib/ledenkruis');
const R = require('../scripts/bevoegdronde');

const M = ['Kraan kruisproef abc'];
const alleGeweigerd = () => Object.fromEntries(K.ANDEREN.map((w) => [w, 'geweigerd']));
const paar = (soort, pad, a, anderen) => ({ soort, pad, a, anderen: Object.assign(alleGeweigerd(), anderen || {}) });

test('1. een merkteken van A bij een ander is een lek, tenzij hij het zelf meestuurde', () => {
  assert.equal(K.andersOordeel({ status: 200, tekst: '{"titel":"Kraan kruisproef abc"}' }, M, { wie: 'ander lid' }), 'lek');
  assert.equal(K.andersOordeel({ status: 200, tekst: '{"titel":"Kraan kruisproef abc"}' }, M,
    { wie: 'ander lid', verzoek: '/api/x {"titel":"Kraan kruisproef abc"}' }), 'eigen',
  'wie een woord zelf stuurt en het terugkrijgt, ziet zijn eigen woord');
  assert.equal(K.andersOordeel({ status: 200, tekst: '{"via":"scherm:kruisx"}' }, ['scherm:kruisx'],
    { wie: 'ander lid', verzoek: '{"bron":"kruisx"}' }), 'eigen', 'de herkomst die het lid zelf meegaf is zijn eigen woord');
  assert.equal(K.andersOordeel({ status: 403, tekst: 'Kraan kruisproef abc' }, M, { wie: 'zaak' }), 'geweigerd',
    'een weigering is geen lek, ook als de tekst toevallig klopt');
});

test('2. een handeling zonder sessie is open, een andere sessie die iets eigens krijgt niet', () => {
  assert.equal(K.andersOordeel({ status: 200, tekst: '{}' }, M, { handeling: true, wie: 'anoniem' }), 'open');
  assert.equal(K.andersOordeel({ status: 200, tekst: '{}' }, M, { handeling: true, wie: 'ander lid' }), 'eigen');
  assert.equal(K.andersOordeel({ status: 200, tekst: '{}' }, M, { handeling: false, wie: 'anoniem' }), 'eigen',
    'een openbare lezing zonder iets van A is geen defect');
});

test('3. aangetast is een stand die anders terugkomt; een tijdstempel telt niet', () => {
  assert.equal(K.vlak('{"gezienOp":"2026-10-11T20:48:55.283Z"}'), K.vlak('{"gezienOp":"2026-10-11T21:00:00.000Z"}'));
  assert.notEqual(K.vlak('{"n":1}'), K.vlak('{"n":2}'), 'een teller die verschuift is wel een verandering');
  const r = K.kruisOordeel({ paren: [paar('lezer', '/api/a', 200)], onderwerp: true, aangetast: ['/api/a'] });
  assert.equal(r.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(r.reden, /anders terug dan voor de pogingen van de anderen/);
  const wie = K.kruisOordeel({ paren: [paar('lezer', '/api/a', 200)], onderwerp: true, aangetast: [{ pad: '/api/a', na: 'ander lid' }] });
  assert.match(wie.reden, /\/api\/a \(anders na de pogingen van ander lid\)/,
    'het label zegt NA wiens pogingen, en beweert geen oorzaak');
});

test('4. zonder onderwerp geen uitslag', () => {
  const r = K.kruisOordeel({ paren: [paar('laden', '/api/a', 200)], onderwerp: false });
  assert.equal(r.status, 'NIET_GETEST');
  assert.match(r.reden, /geen uitslag/);
  const goed = K.kruisOordeel({ paren: [paar('laden', '/api/a', 200, { 'ander lid': 'eigen' })], onderwerp: true });
  assert.equal(goed.status, 'BEWEZEN');
  assert.deepEqual(goed.gekruist, ['/api/a']);
  assert.match(goed.reden, /merkteken van A/, 'de grens hoort in elke uitslag te staan');
});

test('5. het eigen lid hoort binnen te komen', () => {
  const r = K.kruisOordeel({ paren: [paar('lezer', '/api/a', 200), paar('handeling', '/api/a/zet', 403)], onderwerp: true });
  assert.equal(r.status, 'NIET_GETEST');
  assert.match(r.reden, /lid A kwam zelf niet binnen bij \/api\/a\/zet/);
  assert.deepEqual(r.gekruist, ['/api/a'], 'een paar zonder A telt niet als gekruist');
});

test('6. de rem is onbeslist, nooit geweigerd', () => {
  assert.equal(K.andersOordeel({ status: 429, tekst: '' }, M, { wie: 'anoniem' }), 'onbeslist');
  const r = K.kruisOordeel({ paren: [paar('laden', '/api/a', 200, { zaak: 'onbeslist' })], onderwerp: true });
  assert.equal(r.status, 'NIET_GETEST');
  assert.deepEqual(r.gekruist, [], 'een onbeslist paar is niet gekruist');
  const lek = K.kruisOordeel({ paren: [paar('laden', '/api/a', 200, { 'ander lid': 'lek' })], onderwerp: true });
  assert.equal(lek.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(lek.reden, /^ander lid kreeg \/api\/a/);
});

test('7. de kruis vervangt het ROLPROEF-deel alleen voor de routes die hij raakte', () => {
  const SR = { perScherm: [{ bestand: 'public/apps/a.html', exact: ['/api/a/lijst', '/api/a/zet'], voorvoegsels: [] }] };
  const lees = (f) => (f === 'public/apps/a.html' ? '<html></html>' : null);
  const reg = { idor: new Map([['/api/a/lijst', [{ staat: 'gescheiden' }]], ['/api/a/zet', [{ staat: 'gescheiden' }]]]),
    rol: new Map([['/api/a/zet', [{ acl: 'open', privacy: 'schoon' }]]]),
    vervallen: ['ROLPROEF.json: gemeten op commit x, die hier niet meer bestaat'] };
  const rij = { functie: 'link:a', ingang: '/apps/a.html' };
  const kruisOk = (gekruist) => ({ status: 'BEWEZEN', reden: 'kruis', gekruist });

  assert.equal(R.ledenOordeel(rij, reg, { schermroutes: SR, lees }).status, 'NIET_GETEST',
    'zonder kruis blijft een vervallen ROLPROEF de rij tegenhouden');
  const half = R.ledenOordeel(rij, reg, { schermroutes: SR, lees, kruis: kruisOk(['/api/a/lijst']) });
  assert.equal(half.status, 'NIET_GETEST');
  assert.match(half.reden, /\/api\/a\/zet/, 'de schrijfroute die de kruis niet raakte, staat er met naam');
  const heel = R.ledenOordeel(rij, reg, { schermroutes: SR, lees, kruis: kruisOk(['/api/a/lijst', '/api/a/zet']) });
  assert.equal(heel.status, 'BEWEZEN', 'een vervallen "open" in ROLPROEF is geen bewijs van een breuk');
  assert.match(heel.reden, /ROLPROEF\.json is vervallen en telt niet/);
  const defect = R.ledenOordeel(rij, reg, { schermroutes: SR, lees, kruis: { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'ander lid kreeg /api/a/lijst', gekruist: [] } });
  assert.equal(defect.status, 'GEBLOKKEERD_DOOR_DEFECT');
  const idorWeg = Object.assign({}, reg, { vervallen: ['IDOR.json: verouderd'] });
  assert.equal(R.ledenOordeel(rij, idorWeg, { schermroutes: SR, lees, kruis: kruisOk(['/api/a/lijst', '/api/a/zet']) }).status, 'NIET_GETEST',
    'IDOR blijft verplicht: de kruis verwisselt de sessie, IDOR het object');
});

test('8. M1: een ander die op A\'s object een handeling laat slagen, is een inbreuk', () => {
  /* De mutatie van de tegenlezer: deel() zocht in ALLE ledgers, dus een ander lid
     maakte een deelcode op A's feit. Het antwoord liet niets van A zien (een code
     en een datum), en de kruis bleef groen. */
  const antwoord = { status: 200, tekst: '{"status":200,"code":"RTGCL.x","tot":"2026-10-14T00:00:00Z"}' };
  assert.equal(K.andersOordeel(antwoord, M, { handeling: true, object: true, wie: 'ander lid' }), 'inbreuk');
  assert.equal(K.andersOordeel(antwoord, M, { handeling: true, object: false, wie: 'ander lid' }), 'eigen',
    'een handeling zonder object van A (een nieuwe melding) mag een ander voor zichzelf doen');
  assert.equal(K.andersOordeel({ status: 404, tekst: '' }, M, { handeling: true, object: true, wie: 'ander lid' }), 'geweigerd');
  const r = K.kruisOordeel({ paren: [paar('lezer', '/api/carriere/ledger/mijn', 200),
    paar('handeling', '/api/carriere/ledger/deel', 200, { 'ander lid': 'inbreuk' })], onderwerp: true });
  assert.equal(r.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(r.reden, /^ander lid kreeg 2xx op \/api\/carriere\/ledger\/deel, een handeling op een object van lid A/);
});

test('9. M3b: de codenaam lekt buiten de verklaarde gedeelde routes', () => {
  const cn = { waarde: 'Zilveren Valk EE41', zichtbaarOp: Object.keys(K.CODENAAM_ZICHTBAAR) };
  /* De mutatie van de tegenlezer: /api/veiligheid/moment gaf een ander lid de
     lopende reizen van anderen -- codenaam, doel en eta, maar niet de titel. */
  const reizen = { status: 200, tekst: '{"momenten":[{"codenaam":"Zilveren Valk EE41","doel":"Bestemming kruisproef q1","eta":"eta-q2"}]}' };
  assert.equal(K.andersOordeel(reizen, [cn], { wie: 'ander lid', pad: '/api/veiligheid/moment' }), 'lek', 'de codenaam alleen is genoeg');
  assert.equal(K.andersOordeel(reizen, ['Bestemming kruisproef q1'], { wie: 'ander lid', pad: '/api/veiligheid/moment' }), 'lek',
    'en de gezaaide bestemming ook, zonder codenaam');
  assert.equal(K.andersOordeel(reizen, ['eta-q2'], { wie: 'ander lid', pad: '/api/veiligheid/moment' }), 'lek');
  /* In een gedeelde zaal is de codenaam met opzet zichtbaar. */
  assert.equal(K.andersOordeel({ status: 200, tekst: '{"aanwezig":["Zilveren Valk EE41"]}' }, [cn],
    { wie: 'ander lid', pad: '/api/residentie/betreed' }), 'eigen');
  for (const [route, reden] of Object.entries(K.CODENAAM_ZICHTBAAR)) {
    assert.ok(route.startsWith('/api/') && reden.length > 30, route + ' draagt geen reden waarom de codenaam daar zichtbaar mag zijn');
  }
});
