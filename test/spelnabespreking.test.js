/* De nabespreking: Rahul kijkt een AFGELOPEN partij terug.

   Er zijn twee Rahul-deuren en ze mogen elkaar niet raken. Het spelmaatje
   (`rahul.js`) krijgt tijdens het potje bewust niet het bord te zien en KAN dus
   niet verklappen. De nabespreking leest het hele verloop en ziet dus alles --
   wat hem na afloop nuttig maakt en tijdens het spelen onaanvaardbaar.

   Wat deze toets bewaakt is de regel die die twee uit elkaar houdt: DEZE DEUR
   WEIGERT EEN LOPEND POTJE, op de status en niet in een prompt. Een
   prompt-instructie is niet te toetsen; deze weigering is dat wel.

   Draai los: node --test test/spelnabespreking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');

function opstelling({ volwassen = () => true } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}

/* Een echte schaakpartij van twee zetten, zodat er een verloop bestaat. */
async function partij(o, wie = 'a') {
  const r = await o.kern.spelNieuw(wie, { soort: 'schaak', vrienden: ['b'], wereld: 'rtg' });
  o.kern.spelAntwoord('b', r.id, true);
  o.kern.spelZet('a', r.id, { van: 52, naar: 36 });   // wit: pion twee vooruit
  o.kern.spelZet('b', r.id, { van: 12, naar: 28 });   // zwart: idem
  return r.id;
}

/* ---------- DE REGEL ---------- */

test('een LOPEND potje wordt geweigerd', async () => {
  /* Zonder deze weigering is de nabespreking de kortste weg om tijdens je eigen
     partij het hele bord aan een AI voor te leggen -- precies wat de blindheid
     van het spelmaatje moest voorkomen. */
  const o = opstelling();
  const id = await partij(o);
  const r = await o.kern.spelNabespreking('a', id);
  assert.equal(r.status, 409);
  assert.match(r.error, /na afloop/);
});

test('en na afloop mag het gewoon', async () => {
  const o = opstelling();
  const id = await partij(o);
  o.kern.spelOpgeven('b', id);
  const r = await o.kern.spelNabespreking('a', id);
  assert.equal(r.status, 200);
  assert.equal(r.zetten, 2, 'het verloop van twee zetten zit erin');
});

test('het spelmaatje blijft tijdens het potje gewoon werken', () => {
  /* De keerzijde: de weigering hierboven mag deur 1 niet dichtzetten. Een hint
     vragen tijdens je partij is juist waar dat spelmaatje voor is. */
  return (async () => {
    const o = opstelling();
    const id = await partij(o);
    const r = await o.kern.spelRahul('a', id, 'hoe sta ik ervoor?');
    assert.equal(r.status, 200);
    assert.ok(r.antwoord, 'en hij zegt gewoon iets');
  })();
});

/* ---------- wie hem mag opvragen ---------- */

test('alleen wie meespeelde krijgt een nabespreking', async () => {
  /* Die controle zit in `spelReplay` en niet hier: twee plekken die dezelfde
     vraag beantwoorden lopen uiteen. Deze toets bewaakt dat de nabespreking
     hem ook echt langsloopt. */
  const o = opstelling();
  const id = await partij(o);
  o.kern.spelOpgeven('b', id);
  const r = await o.kern.spelNabespreking('vreemde', id);
  assert.equal(r.status, 404);
});

test('een partij die niet bestaat geeft geen nabespreking', async () => {
  const o = opstelling();
  const r = await o.kern.spelNabespreking('a', 'bestaatniet');
  assert.equal(r.status, 404);
});

/* ---------- het verloop overleeft het potje ---------- */

test('de nabespreking werkt nog als het potje al opgeruimd is', async () => {
  /* Een klaar potje verdwijnt na een dag; het verloop leeft dertig dagen. De
     regel hangt daarom aan "staat hij nog in de potjes EN loopt hij" en niet
     aan "hij moet er zijn" -- anders zou de nabespreking precies verdwijnen
     wanneer je hem het vaakst wilt. */
  const o = opstelling();
  const id = await partij(o);
  o.kern.spelOpgeven('b', id);
  delete o.db.data.spellen.potjes[id];              // zoals de opruiming doet
  const r = await o.kern.spelNabespreking('a', id);
  assert.equal(r.status, 200);
  assert.match(r.antwoord, /opgeruimd/, 'en hij zegt eerlijk dat de uitslag er niet meer is');
});

/* ---------- onder de progressiegrens ---------- */

test('onder de 18+-grens mag je je eigen partij gewoon nabespreken', async () => {
  /* Dezelfde redenering als bij de replay zelf: terugkijken telt niets op en
     vergelijkt niets met niemand, en er wordt niets van bewaard. */
  const o = opstelling({ volwassen: () => false });
  const id = await partij(o);
  o.kern.spelOpgeven('b', id);
  const r = await o.kern.spelNabespreking('a', id);
  assert.equal(r.status, 200);
  assert.ok(r.antwoord);
});

/* ---------- wat hij zonder sleutel zegt ---------- */

test('zonder API-sleutel is de samenvatting smal en waar', async () => {
  /* Analyse verzinnen die er niet is zou erger zijn dan niets zeggen. Wat er
     staat is narekenbaar: hoeveel zetten, hoeveel van jou, en de uitslag. */
  const o = opstelling();
  const id = await partij(o);
  o.kern.spelOpgeven('b', id);
  const r = await o.kern.spelNabespreking('a', id);
  assert.equal(r.demo, true);
  assert.match(r.antwoord, /Schaken: 2 zetten/);
  assert.match(r.antwoord, /waarvan 1 van jou/);
  assert.match(r.antwoord, /CN-a/, 'de winnaar staat erin');
});
