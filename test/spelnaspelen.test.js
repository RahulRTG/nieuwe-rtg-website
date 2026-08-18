/* Naspelen: een afgelopen partij zet voor zet herbouwen.

   De belofte die hier bewaakt wordt is niet "er komt een bord uit" maar "het
   is HETZELFDE bord". De server rekent de tussenstanden met de motor die de
   partij ook echt gespeeld heeft, juist zodat er geen tweede exemplaar van de
   schaakregels in de client hoeft te staan. Loopt dat uiteen, dan toont het
   scherm een stand die er nooit zo heeft gestaan -- en dat ziet er precies zo
   echt uit als een goede.

   Draai los: node --test test/spelnaspelen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');

function opstelling() {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const geseind = [];
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer: (naar) => geseind.push(naar),
    isGeblokkeerd: () => false, socialZoek: async () => [], sociaalRate: () => true,
    volwassen: () => true, sseClients: [], lidBoardUit: () => false });
  return { db, kern, geseind };
}

/* Een echte schaakpartij: vier zetten, met de borden onderweg bewaard zoals de
   LIVE partij ze toonde. Dat is de maatstaf waar het naspelen tegen moet. */
async function partij(o) {
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg' });
  o.kern.spelAntwoord('b', r.id, true);
  const zetten = [['a', 52, 36], ['b', 12, 28], ['a', 62, 45], ['b', 1, 18]];
  const borden = [o.kern.spelStaat('a', r.id).potje.staat.bord];
  for (const [wie, van, naar] of zetten) {
    o.kern.spelZet(wie, r.id, { van, naar });
    borden.push(o.kern.spelStaat('a', r.id).potje.staat.bord);
  }
  return { id: r.id, borden };
}

/* ---------- de kern van de zaak ---------- */

test('elk nagespeeld bord is gelijk aan wat er live stond', async () => {
  const o = await opstelling();
  const { id, borden } = await partij(o);
  o.kern.spelOpgeven('b', id);
  for (let stap = 0; stap < borden.length; stap++) {
    const r = o.kern.spelNaspelen('a', id, stap);
    assert.equal(r.status, 200, 'stap ' + stap);
    assert.equal(r.stap, stap);
    assert.equal(r.staat.bord, borden[stap], 'het bord op stap ' + stap + ' wijkt af van de echte partij');
  }
});

test('zonder stap krijg je het eind van de partij', async () => {
  const o = opstelling();
  const { id, borden } = await partij(o);
  o.kern.spelOpgeven('b', id);
  const r = o.kern.spelNaspelen('a', id);
  assert.equal(r.stap, 4);
  assert.equal(r.totaal, 4);
  assert.equal(r.staat.bord, borden[4]);
});

test('naspelen seint NIEMAND en schrijft niets weg', async () => {
  /* De reden dat er een tweede, stil register bestaat. De echte motoren
     eindigen elke zet op save() en nudge(); een partij naspelen zou dan de
     database schrijven en je tegenstander vertellen dat hij aan zet is -- voor
     een zet uit een partij die al klaar is. */
  const o = opstelling();
  const { id } = await partij(o);
  o.kern.spelOpgeven('b', id);
  const voor = o.geseind.length;
  const potjesVoor = JSON.stringify(o.db.data.spellen.potjes);
  for (let stap = 0; stap <= 4; stap++) o.kern.spelNaspelen('a', id, stap);
  assert.equal(o.geseind.length, voor, 'er is geen enkel seintje verstuurd');
  assert.equal(JSON.stringify(o.db.data.spellen.potjes), potjesVoor, 'en er is niets aan de potjes veranderd');
});

/* ---------- wat er niet na te spelen is ---------- */

test('een spel dat het niet kan wordt geweigerd, met de reden erbij', () => {
  /* Pesten deelt zijn kaarten met de schudbeker en die worp staat nergens in
     het verloop. Een bord tonen zou een partij laten zien die niet gespeeld is.

     Het verloop wordt hier rechtstreeks neergezet: de weigering hangt aan het
     SPEL en niet aan deze partij, en om die tak te raken moet er wel een
     verloop zijn -- zonder verloop weet de server het spel niet eens, en dan is
     404 het juiste antwoord. */
  const o = opstelling();
  o.db.data.spelZetten = [{ potje: 'p9', soort: 'pesten', spelers: ['a', 'b'], afgekapt: false,
    at: new Date().toISOString(), zetten: [{ s: 0, z: { pak: true } }] }];
  const n = o.kern.spelNaspelen('a', 'p9');
  assert.equal(n.status, 400);
  assert.match(n.error, /niet na te spelen/);
});

test('zonder verloop is het gewoon 404, en niet "dit spel kan het niet"', () => {
  // de volgorde is met opzet zo: zonder verloop is de SOORT onbekend, dus er
  // valt niets zinnigs over het spel te zeggen
  const o = opstelling();
  assert.equal(o.kern.spelNaspelen('a', 'bestaatniet').status, 404);
});

test('precies twee spellen zijn naspeelbaar, en dat zijn de twee zonder toeval', () => {
  /* Een gouden regel: naspeelbaar staat standaard UIT, en wie hem aanzet moet
     kunnen uitleggen dat het begin vastligt en de zetten de rest bepalen. */
  const kern = require('../server/kern/spellen')({
    db: { data: {} }, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true
  });
  const { SPEL } = kern._spelregels;
  assert.deepEqual(Object.keys(SPEL).filter(k => SPEL[k].naspeelbaar).sort(), ['dam', 'schaak']);
});

test('een afgekapt verloop wordt geweigerd in plaats van half nagespeeld', () => {
  /* zetten.js gooit bij een lange partij de OUDSTE zetten weg, dus juist het
     begin. Zonder begin is er geen bord om vanaf te rekenen; half naspelen
     vanaf een verzonnen beginstand is geen replay. */
  const o = opstelling();
  const z = { potje: 'lang', soort: 'schaak', spelers: ['a', 'b'], afgekapt: true,
    at: new Date().toISOString(), zetten: [{ s: 0, z: { van: 52, naar: 36 } }] };
  o.db.data.spelZetten = [z];
  const r = o.kern.spelNaspelen('a', 'lang');
  assert.equal(r.status, 409);
  assert.match(r.error, /begin niet meer bewaard/);
});

/* ---------- wie hem mag opvragen ---------- */

test('alleen wie meespeelde mag naspelen', async () => {
  const o = opstelling();
  const { id } = await partij(o);
  o.kern.spelOpgeven('b', id);
  assert.equal(o.kern.spelNaspelen('vreemde', id).status, 404);
});

test('een verloop dat vastloopt stopt daar, en zegt dat', () => {
  /* Klopt het verloop niet met de regels, dan hoort dat zichtbaar te zijn en
     niet weggepoetst met een bord dat toevallig ergens uitkomt. */
  const o = opstelling();
  o.db.data.spelZetten = [{ potje: 'raar', soort: 'schaak', spelers: ['a', 'b'], afgekapt: false,
    at: new Date().toISOString(),
    zetten: [{ s: 0, z: { van: 52, naar: 36 } }, { s: 1, z: { van: 0, naar: 63 } }] }];
  const r = o.kern.spelNaspelen('a', 'raar');
  assert.equal(r.status, 200);
  assert.equal(r.stap, 1, 'de eerste zet lukte');
  assert.equal(r.gestrand, 2, 'en bij de tweede liep het vast');
});
