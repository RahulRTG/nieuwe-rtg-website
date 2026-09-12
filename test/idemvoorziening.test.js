/* DE VOORZIENING -- een VERS onderwerp vlak voor de meting.

   Waarom deze laag bestaat staat in scripts/lib/idemwereld.js, en het is geen
   ontbrekende fixture: de idempotentieproef doet voor elke ledenroute eerst een
   pasladder-ijkoproep, en die DOET ECHT WERK. Op een route die zijn onderwerp
   opmaakt (een pas sluiten, een verzoek intrekken) is dat onderwerp daarna weg,
   en dan meet A een 404 en heet de route voor altijd `ongemeten`.

   De toetsen hieronder bewaken de drie dingen die daarbij fout kunnen gaan, en
   alle drie zijn ze hier echt fout gegaan:

     1. de voorziening draait op de VERKEERDE PLEK (voor de ijkoproep, of
        helemaal niet) -- dan is het onderwerp alsnog op;
     2. zij LIEGT als zij faalt -- dan telt een route als gemeten terwijl er
        niets stond;
     3. zij vraagt niet om een NIEUW ding -- dan geeft de idem-poort haar het
        vorige onderwerp terug, met `herhaald: true`, en denkt zij dat het vers is. */
const test = require('node:test');
const assert = require('node:assert');
const { draaiIdemproef } = require('../scripts/lib/idemproef.js');
const { voorzieningVoor, VOORZIENINGEN } = require('../scripts/lib/idemwereld.js');

/* Een server die alleen onthoudt wat hem is gevraagd. */
function nepServer(antwoord) {
  const gezien = [];
  const post = async (pad, lijf, tok) => {
    gezien.push({ pad, lijf, tok });
    return antwoord(pad, lijf, tok) || { status: 200, data: { ok: true } };
  };
  return { post, gezien };
}
const ROUTE = [{ methode: 'POST', pad: '/api/proef/opmaak', rol: 'member' }];
const draai = (opties) => draaiIdemproef(Object.assign({
  routes: ROUTE, tokenVoor: (r) => 'tok-' + r, lijfVoor: () => ({ id: 'oud' }),
  rolVoor: (r) => r.rol, pasladder: ['member', 'lid-lifestyle']
}, opties));

test('de voorziening draait NA de pasladder-ijkoproep en VOOR de eerste meting', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  await draai({ post: s.post,
    voorzieningVoor: (pad) => pad === '/api/proef/opmaak'
      ? async ({ post }) => { await post('/api/voorziening/maak', {}, 'tok-member'); return { id: 'vers' }; }
      : null });
  const paden = s.gezien.map(g => g.pad);
  const ijk = paden.indexOf('/api/proef/opmaak');
  const vz = paden.indexOf('/api/voorziening/maak');
  assert.ok(vz > ijk, 'de voorziening hoort NA de ijkoproep te draaien');
  /* En de gemeten oproepen daarna dragen het VERSE onderwerp. De ijkoproep
     draagt nog het oude -- dat hoort, want die is de kalibratie en geen meting. */
  const gemeten = s.gezien.filter(g => g.pad === '/api/proef/opmaak' && g.lijf.idem);
  assert.equal(gemeten.length >= 3, true, 'A, B en C horen te draaien');
  for (const g of gemeten) assert.equal(g.lijf.id, 'vers', 'elke gemeten oproep draagt het verse onderwerp');
});

test('zonder voorziening verandert er niets aan het lijf', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draai({ post: s.post });
  const gemeten = s.gezien.filter(g => g.pad === '/api/proef/opmaak' && g.lijf.idem);
  for (const g of gemeten) assert.equal(g.lijf.id, 'oud');
  assert.equal(uit.perRoute['POST /api/proef/opmaak'].voorziening, undefined,
    'geen voorziening betekent ook geen regel erover in het register');
});

/* EEN MISLUKTE VOORZIENING MAG NOOIT ALS GELUKT LEZEN. Dit is de gevaarlijkste
   faalvorm van deze laag: een route die "gemeten" heet terwijl er niets stond. */
test('een mislukte voorziening laat het lijf ongemoeid en staat in het register', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draai({ post: s.post,
    voorzieningVoor: () => async () => ({ fout: 'de rekening ontbrak' }) });
  const gemeten = s.gezien.filter(g => g.pad === '/api/proef/opmaak' && g.lijf.idem);
  for (const g of gemeten) assert.equal(g.lijf.id, 'oud', 'een mislukte voorziening verandert niets');
  const v = uit.perRoute['POST /api/proef/opmaak'].voorziening;
  assert.equal(v.stand, 'mislukt');
  assert.match(v.reden, /de rekening ontbrak/);
});

test('een voorziening die omvalt, laat de meting doorlopen', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draai({ post: s.post,
    voorzieningVoor: () => async () => { throw new Error('de wereld brak'); } });
  const v = uit.perRoute['POST /api/proef/opmaak'].voorziening;
  assert.equal(v.stand, 'mislukt');
  assert.match(v.reden, /de wereld brak/);
  assert.ok(uit.perRoute['POST /api/proef/opmaak'].statussen, 'de route is toch gemeten');
});

/* EEN GELUKTE VOORZIENING KOMT OOK IN HET REGISTER. Een route die alleen
   meetbaar is doordat de proef er een vers onderwerp voor maakte, is een ander
   feit dan een die het uit zichzelf was. */
test('een gelukte voorziening staat met zijn velden in het register', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  const uit = await draai({ post: s.post,
    voorzieningVoor: () => async () => ({ id: 'vers', room: 'K1' }) });
  const v = uit.perRoute['POST /api/proef/opmaak'].voorziening;
  assert.equal(v.stand, 'gelukt');
  assert.deepEqual(v.velden, ['id', 'room']);
});

/* DE VOORZIENING KRIJGT ELKE ROL, en niet die van de route. Een zaak kan pas
   iets oormerken nadat een LID haar heeft betaald; met het token van de route
   gaf die ledenoproep 401. */
test('de voorziening kan elk rol-token opvragen, niet alleen dat van de route', async () => {
  const s = nepServer(() => ({ status: 200, data: { ok: true } }));
  let gezien = null;
  await draai({ post: s.post, routes: [{ methode: 'POST', pad: '/api/supplier/iets', rol: 'supplier' }],
    voorzieningVoor: () => async ({ tokenVoor }) => { gezien = tokenVoor('member'); return { id: 'x' }; } });
  assert.equal(gezien, 'tok-member', 'ook op een leveranciersroute is het ledentoken te krijgen');
});

/* ---- de zes voorzieningen zelf ---- */

test('elk van de zes geblokkeerde geldpaden heeft een voorziening', () => {
  for (const pad of ['/api/bank/pas/sluit', '/api/bank/pas/betaal', '/api/geld/beleid/weg',
    '/api/pay/verzoek/intrek', '/api/supplier/pos/checkout', '/api/supplier/pay/treasury/apart'])
    assert.equal(typeof voorzieningVoor(pad), 'function', pad + ' heeft er geen');
  assert.equal(voorzieningVoor('/api/iets/anders'), null, 'en de rest krijgt er geen');
});

/* ELKE VOORZIENING VRAAGT OM EEN NIEUW DING. Zonder unieke sleutel geeft de
   idem-poort het VORIGE onderwerp terug (`herhaald: true`) -- precies wat er
   met het betaalverzoek gebeurde: de voorziening dacht dat zij iets verses had
   gemaakt en gaf het klompje terug dat de ijkoproep net had ingetrokken. */
test('elke voorziening stuurt een UNIEKE sleutel mee bij wat zij aanmaakt', async () => {
  const sleutels = [];
  const post = async (pad, lijf) => {
    if (lijf && lijf.idem) sleutels.push(lijf.idem);
    return { status: 200, data: { ok: true, pas: { id: 'P' }, verzoeken: [{ id: 'V' }],
      regels: [{ id: 'R' }], code: 'KAS123' } };
  };
  const w = { iban: 'NL00', cn2: 'Gouden Ibis' };
  const tokenVoor = (r) => 'tok-' + r;
  for (const maak of Object.values(VOORZIENINGEN)) await maak({ post, tokenVoor, w });
  assert.ok(sleutels.length >= 6, 'elke voorziening hoort iets aan te maken met een sleutel');
  assert.equal(new Set(sleutels).size, sleutels.length, 'geen twee voorzieningen delen een sleutel');
  /* En twee rondes geven ook onderling andere sleutels: een teller die per
     proces vastligt zou bij een tweede ronde hetzelfde onderwerp teruggeven. */
  const eersteRonde = sleutels.slice();
  sleutels.length = 0;
  for (const maak of Object.values(VOORZIENINGEN)) await maak({ post, tokenVoor, w });
  for (const s of sleutels) assert.equal(eersteRonde.includes(s), false, 'een tweede ronde hergebruikt een sleutel');
});

/* EEN VOORZIENING ZONDER HAAR VOORWAARDE ZEGT DAT, EN VERZINT NIETS. */
test('een voorziening zonder haar voorwaarde geeft een fout en geen half onderwerp', async () => {
  const post = async () => ({ status: 200, data: { ok: true } });
  const tokenVoor = () => 'tok';
  const zonderRekening = await VOORZIENINGEN['/api/bank/pas/sluit']({ post, tokenVoor, w: {} });
  assert.match(zonderRekening.fout, /geen rekening/);
  const zonderCodenaam = await VOORZIENINGEN['/api/pay/verzoek/intrek']({ post, tokenVoor, w: {} });
  assert.match(zonderCodenaam.fout, /codenaam/);
});
