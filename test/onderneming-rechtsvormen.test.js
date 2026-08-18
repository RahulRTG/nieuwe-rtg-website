/* Ronde: rechtsvormen -- Nederland en het buitenland in een register, en een
   wacht die ze bijwerkt zonder de grendels te openen.

   Zes beweringen:

   1. NEDERLAND EN DE REST STAAN IN EEN LIJST, en elke vorm draagt zijn land.
      De Nederlandse vormen houden hun kale id, want die staan in de opslag van
      bestaande ondernemingen.
   2. WAT WIJ NIET WETEN, STAAT ER NIET. Voor een land dat wij niet kennen komt
      er geen ongeveer-Nederlandse lijst maar een expliciet "wij weten het
      niet". Wie op de verkeerde lijst afgaat, gaat naar de verkeerde instantie.
   3. DE NEDERLANDSE BELASTINGSOM BLIJFT NEDERLANDS. Een buitenlandse vorm
      krijgt geen reservering maar de reden waarom niet.
   4. VERBODEN GROEIT ALLEEN. Een bron mag een verbod toevoegen en er nooit een
      weghalen -- anders is een regel in een bestand genoeg om een stichting
      winst te laten uitkeren.
   5. CAPS KOMEN UIT HET WOORDENBOEK, en rechtspersoon/notarieel liggen vast
      zodra een vorm bestaat.
   6. EEN HERSTART VERLIEST NOOIT EEN UPDATE, en zonder bron draait alles op de
      ingebouwde tabel door.

   Draai los: node --test test/onderneming-rechtsvormen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const RV = require('../server/kern/onderneming/rechtsvorm');
const LAND = require('../server/kern/onderneming/rechtsvorm-landen');
const maakWacht = require('../server/kern/onderneming/rechtsvormwacht');
const maakOnderneming = require('../server/kern/onderneming');

/* De wacht werkt het GEDEELDE register in place bij -- dat is het ontwerp.
   Elke toets die iets wijzigt, zet het achteraf terug, anders lekt een update
   naar de volgende toets en toetst die iets anders dan hij zegt. */
function metRegister(fn) {
  const kopie = JSON.parse(JSON.stringify(RV.RECHTSVORMEN));
  const bestond = new Set(Object.keys(RV.RECHTSVORMEN));
  try { return fn(); } finally {
    for (const id of Object.keys(RV.RECHTSVORMEN)) if (!bestond.has(id)) delete RV.RECHTSVORMEN[id];
    for (const [id, v] of Object.entries(kopie)) RV.RECHTSVORMEN[id] = v;
  }
}

function wacht() {
  const db = { data: {} };
  const w = maakWacht({ db, save: () => {} }).rechtsvormwacht;
  w._db = db;
  return w;
}

/* ---------------- een register, met landen ---------------- */

test('Nederlandse en buitenlandse vormen staan in een register, elk met hun land', () => {
  assert.equal(RV.rechtsvormVan('bv').land, 'NL');
  assert.equal(RV.rechtsvormVan('de-gmbh').land, 'DE');
  assert.ok(RV.LANDEN_MET_VORMEN().includes('NL'));
  assert.ok(RV.LANDEN_MET_VORMEN().length > 1, 'er staat meer dan Nederland in');
});

test('de Nederlandse ids blijven kaal, want ze staan in bestaande ondernemingen', () => {
  for (const id of Object.keys(RV.NL)) {
    assert.ok(RV.isRechtsvorm(id), id + ' bestaat nog onder zijn oude id');
    assert.equal(RV.RECHTSVORMEN[id].land, 'NL');
  }
  assert.equal(RV.rechtsvormVan('eenmanszaak').label, 'Eenmanszaak',
    'en heet nog hetzelfde: een hernoemde vorm laat een bestaand bedrijf zonder rechtsvorm achter');
});

test('een land dat wij niet kennen krijgt geen ongeveer-Nederlandse lijst', () => {
  const uit = RV.rechtsvormenVanLand('IT');
  assert.equal(uit.ok, false);
  assert.deepEqual(uit.vormen, [], 'en geen halve lijst');
  assert.ok(uit.reden.includes('kennen de rechtsvormen van dit land niet'));
  assert.ok(uit.uitleg.includes('verkeerde instantie'));
  assert.ok(uit.landen.includes('NL'), 'met de landen die wij wel kennen erbij');
});

test('de oprichtingsstappen noemen de instantie van het land zelf', () => {
  const nl = RV.rechtsvormVan('eenmanszaak').oprichting.join(' ');
  const de = RV.rechtsvormVan('de-einzelunternehmen').oprichting.join(' ');
  assert.ok(nl.includes('KvK'));
  assert.ok(!de.includes('KvK'), 'een Duitse stap stuurt niemand naar de KvK');
  assert.ok(de.includes('Gewerbeamt') || de.includes('Handelsregister'));
});

test('buiten Nederland dragen de caps geen Nederlandse fiscale begrippen', () => {
  const nlBegrippen = ['urencriterium', 'startersaftrek', 'mkb-winstvrijstelling', 'dga-loon',
    'kleineondernemersregeling', 'ib-aangifte', 'vpb'];
  for (const [id, v] of Object.entries(RV.RECHTSVORMEN)) {
    if (v.land === 'NL') continue;
    for (const c of v.caps) {
      assert.ok(!nlBegrippen.includes(c),
        id + ' draagt "' + c + '", en dat is een Nederlands begrip op een buitenlandse vorm');
    }
  }
});

test('de Verenigde Staten zeggen zelf dat het bedrijfsrecht van de staat is', () => {
  const us = RV.rechtsvormenVanLand('US');
  assert.equal(us.ok, true);
  assert.ok(us.let.includes('van de staat'),
    'anders leest een landelijke lijst als een landelijke waarheid');
});

/* ---------------- de belastinggrendel ---------------- */

test('voor een buitenlandse rechtsvorm rekent de belastinglaag niets uit', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }],
    online: true, salon: { bio: 'Ramen wassen bij bedrijven.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'K', price: 100 }],
    boekingen: [], orders: [] };
  const jaar = new Date().getUTCFullYear();
  const factuur = { id: 'F1', datum: jaar + '-03-01', subtotaal: 20000, btwBedrag: 4200,
    verkoper: { code: 'GLAS' }, koper: {} };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [],
    facturen: [factuur], werkruimtes: {}, vacatures: {}, applications: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);

  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  const nl = K.ondernemingBelasting(o);
  assert.equal(nl.land, 'NL');
  assert.equal(nl.reservering.kan, true, 'een Nederlandse eenmanszaak krijgt wel een reservering');

  K.ondernemingRechtsvorm(o, 'gb-sole-trader');
  const gb = K.ondernemingBelasting(o);
  assert.equal(gb.land, 'GB');
  assert.equal(gb.reservering.kan, false,
    'dezelfde som op een Britse sole trader geeft een getal dat er goed uitziet en het niet is');
  assert.ok(gb.reservering.reden.includes('Nederlandse regels'));
  assert.equal(gb.btw.zeker, true, 'de optelsom uit de eigen facturen blijft wel een optelsom');
});

/* ---------------- de wacht: verboden groeit alleen ---------------- */

test('een bron kan een verbod toevoegen', () => metRegister(() => {
  const w = wacht();
  const uit = w.pasToe({ rechtsvormen: { stichting: { verboden: ['aandeelhouders'] } } }, 'proef');
  assert.equal(uit.vormen, 1);
  assert.ok(RV.rechtsvormVan('stichting').verboden.includes('aandeelhouders'));
}));

test('een bron kan een verbod NOOIT weghalen', () => metRegister(() => {
  const w = wacht();
  const voor = RV.rechtsvormVan('stichting').verboden.slice();
  assert.ok(voor.includes('winstuitkering'), 'die staat er om te beginnen');

  w.pasToe({ rechtsvormen: { stichting: { verboden: ['bestuur'] } } }, 'kwaadwillend');
  const na = RV.rechtsvormVan('stichting').verboden;
  assert.ok(na.includes('winstuitkering'),
    'een stichting mag geen winst uitkeren, en een regel in een bestand verandert dat niet');
  for (const v of voor) assert.ok(na.includes(v), v + ' staat er nog');
}));

test('een verbod wint ook nadat een bron hem als cap probeert aan te zetten', () => metRegister(() => {
  const w = wacht();
  w.pasToe({ rechtsvormen: { stichting: { caps: ['bestuur', 'winstuitkering'] } } }, 'proef');
  const rv = RV.rechtsvormVan('stichting');
  const samen = RV.capsSamen([rv.caps], rv.verboden);
  assert.ok(!samen.caps.includes('winstuitkering'),
    'wat verboden is wint altijd -- daarvoor staat verboden apart van caps');
  assert.ok(samen.geweerd.includes('winstuitkering'), 'en het scherm kan uitleggen waarom');
}));

/* ---------------- de wacht: woordenboek en vaste velden ---------------- */

test('een verzonnen cap wordt genegeerd', () => metRegister(() => {
  const w = wacht();
  w.pasToe({ rechtsvormen: { bv: { caps: ['jaarrekening', 'gratis-geld'] } } }, 'proef');
  const caps = RV.rechtsvormVan('bv').caps;
  assert.ok(!caps.includes('gratis-geld'), 'een naam die nergens bestaat kan geen knop opleveren');
  assert.ok(caps.includes('jaarrekening'), 'en de bekende komt er wel in');
  assert.ok(RV.CAPS_WOORDENBOEK.includes('jaarrekening'));
}));

test('rechtspersoon en notarieel liggen vast zodra een vorm bestaat', () => metRegister(() => {
  const w = wacht();
  w.pasToe({ rechtsvormen: { bv: { rechtspersoon: false, notarieel: false, label: 'B.V. nieuw' } } }, 'proef');
  assert.equal(RV.rechtsvormVan('bv').rechtspersoon, true,
    'anders laat de belastinglaag een inkomstenbelastingsom op een rechtspersoon los');
  assert.equal(RV.rechtsvormVan('bv').notarieel, true);
  assert.equal(RV.rechtsvormVan('bv').label, 'B.V. nieuw', 'het label mag wel');
}));

test('een rechtsvorm kan nooit verdwijnen', () => metRegister(() => {
  const w = wacht();
  w.pasToe({ rechtsvormen: { stichting: null } }, 'proef');
  assert.ok(RV.isRechtsvorm('stichting'),
    'er kan een onderneming aan hangen, en die zou een vorm hebben die het systeem niet kent');
  assert.ok(w.status().grendels.some(g => g.includes('nooit verdwijnen')));
}));

/* ---------------- de wacht: nieuwe vormen en nieuwe landen ---------------- */

test('een bron kan een vorm in een nieuw land toevoegen, mits hij compleet is', () => metRegister(() => {
  const w = wacht();
  const uit = w.pasToe({ rechtsvormen: {
    'it-srl': { land: 'IT', label: 'Società a responsabilità limitata', kort: 'srl',
      rechtspersoon: true, notarieel: true, caps: ['aandeelhouders', 'jaarrekening'],
      verboden: [], oprichting: ['Statuten bij de notaris', 'Inschrijven in het Registro Imprese'] }
  } }, 'proef');
  assert.equal(uit.vormen, 1);
  const it = RV.rechtsvormenVanLand('IT');
  assert.equal(it.ok, true, 'en het land is er nu een dat wij wel kennen');
  assert.equal(it.vormen.length, 1);
  assert.equal(RV.rechtsvormVan('it-srl').nieuwUitBron, true, 'met de herkomst erbij');
}));

test('een halve rechtsvorm komt er niet in', () => metRegister(() => {
  const w = wacht();
  const pogingen = {
    'pt-lda': { land: 'PT', label: 'Lda', rechtspersoon: true },                    // geen stappen
    /* En de stap-zonder-stappen apart: een lijst die er WEL is maar leeg is,
       kwam eerst ongestraft binnen. Dat gat viel pas op toen een mutatie op de
       lengtecontrole niet beet. */
    'pt-leeg': { land: 'PT', label: 'Leeg', rechtspersoon: true, oprichting: [] },
    'pt-tweede': { land: 'PT', rechtspersoon: true, oprichting: ['Iets'] },         // geen label
    'pt-derde': { land: 'PT', label: 'Derde', oprichting: ['Iets'] },               // geen rechtspersoon
    'pt-vierde': { label: 'Vierde', rechtspersoon: true, oprichting: ['Iets'] },    // geen land
    'zomaarietsraars': { land: 'PT', label: 'Vijfde', rechtspersoon: true, oprichting: ['Iets'] }
  };
  const uit = w.pasToe({ rechtsvormen: pogingen }, 'proef');
  assert.equal(uit.vormen, 0, 'een halve vorm is erger dan geen: hij komt wel in de keuzelijst');
  assert.equal(RV.rechtsvormenVanLand('PT').ok, false);
}));

/* ---------------- de wacht: herstart en geen bron ---------------- */

test('een herstart verliest geen update', () => metRegister(() => {
  const db = { data: {} };
  const w1 = maakWacht({ db, save: () => {} }).rechtsvormwacht;
  w1.pasToe({ rechtsvormen: { bv: { label: 'B.V. (bijgewerkt)' } } }, 'proef', '2027-01');
  assert.equal(RV.rechtsvormVan('bv').label, 'B.V. (bijgewerkt)');

  /* De herstart: het register terug naar de ingebouwde stand, en dan de
     bewaarde overlay opnieuw toepassen -- precies wat kernlaag4b bij het
     opstarten doet. */
  RV.RECHTSVORMEN.bv.label = 'Besloten vennootschap';
  const w2 = maakWacht({ db, save: () => {} }).rechtsvormwacht;
  w2.herstelOverlay();
  assert.equal(RV.rechtsvormVan('bv').label, 'B.V. (bijgewerkt)',
    'de overlay staat in db en wordt bij het opstarten opnieuw gezet');
  assert.equal(w2.status().versie, '2027-01');
}));

test('zonder bron meldt de wacht eerlijk dat de ingebouwde tabel geldt', async () => {
  const oud = process.env.RECHTSVORM_BRON_URL;
  delete process.env.RECHTSVORM_BRON_URL;
  try {
    const w = wacht();
    const uit = await w.check();
    assert.equal(uit.ok, true);
    assert.equal(uit.bron, null);
    assert.ok(w.status().checkUitslag.includes('geen externe bron'));
  } finally { if (oud !== undefined) process.env.RECHTSVORM_BRON_URL = oud; }
});

test('een onbereikbare bron laat de tabel gewoon staan', async () => {
  const oud = process.env.RECHTSVORM_BRON_URL;
  process.env.RECHTSVORM_BRON_URL = 'https://voorbeeld.invalid/rechtsvormen.json';
  try {
    const db = { data: {} };
    const w = maakWacht({ db, save: () => {},
      fetchImpl: async () => { throw new Error('geen netwerk'); } }).rechtsvormwacht;
    const uit = await w.check();
    assert.equal(uit.ok, false);
    assert.ok(w.status().checkUitslag.includes('blijft gelden'));
    assert.equal(RV.rechtsvormVan('bv').label, 'Besloten vennootschap',
      'dat is het hele punt van een ingebouwde basis');
  } finally {
    if (oud === undefined) delete process.env.RECHTSVORM_BRON_URL;
    else process.env.RECHTSVORM_BRON_URL = oud;
  }
});

test('een bron die iets teruggeeft wordt gelezen en geteld', async () => metRegister(async () => {
  const oud = process.env.RECHTSVORM_BRON_URL;
  process.env.RECHTSVORM_BRON_URL = 'https://voorbeeld.test/rechtsvormen.json';
  try {
    const db = { data: {} };
    const w = maakWacht({ db, save: () => {}, fetchImpl: async () => ({
      ok: true, json: async () => ({ versie: '2027-02',
        rechtsvormen: { vof: { label: 'Vennootschap onder firma (v.o.f.)' } } })
    }) }).rechtsvormwacht;
    const uit = await w.check();
    assert.equal(uit.bijgewerkt, 1);
    assert.equal(RV.rechtsvormVan('vof').label, 'Vennootschap onder firma (v.o.f.)');
    assert.equal(w.status().versie, '2027-02');
    assert.ok(w.status().vormenMetUpdates.includes('vof'));
  } finally {
    if (oud === undefined) delete process.env.RECHTSVORM_BRON_URL;
    else process.env.RECHTSVORM_BRON_URL = oud;
  }
}));

/* ---------------- de tabel zelf ---------------- */

test('elke vorm in de tabel is compleet genoeg om te tonen', () => {
  for (const [id, v] of Object.entries(RV.RECHTSVORMEN)) {
    assert.ok(v.label && v.label.length > 2, id + ' heeft een label');
    assert.equal(typeof v.rechtspersoon, 'boolean', id + ' zegt of hij rechtspersoon is');
    assert.ok(/^[A-Z]{2}$/.test(v.land), id + ' draagt een landcode');
    assert.ok(Array.isArray(v.oprichting) && v.oprichting.length >= 3,
      id + ' heeft een oprichtingslijst waar iemand iets aan heeft');
    assert.ok(v.aansprakelijk && v.aansprakelijk.length > 20,
      id + ' zegt wie er aansprakelijk is -- dat is de vraag waarvoor mensen hier komen');
  }
});

test('geen enkele buitenlandse vorm belooft een Nederlandse instantie', () => {
  const nlInstanties = /\bKvK\b|Belastingdienst|Kamer van Koophandel/;
  for (const [id, v] of Object.entries(RV.RECHTSVORMEN)) {
    if (v.land === 'NL') continue;
    assert.ok(!nlInstanties.test(v.oprichting.join(' ')),
      id + ' stuurt iemand naar een Nederlandse instantie');
  }
  assert.ok(Object.keys(LAND.LANDEN).length >= 5, 'en er staat een handvol landen in');
});
