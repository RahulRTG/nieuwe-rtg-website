/* HET BEZITSBEWIJS ONDER AANVAL (server/kern/identiteit/bezitsbewijs.js).

   Wat deze module beschermt: een sessietoken is een dragersbewijs, en op de
   zware paden (geld, passkeys, privacy-export, sessies sluiten) moet de
   aanbieder daarom bij elk verzoek bewijzen dat hij de private sleutel van het
   gebonden toestel BEZIT. Een gestolen token zonder die sleutel is hier
   waardeloos. Deze toetsen spelen de dief na: met het token maar zonder de
   sleutel, met een onderschept bewijs, met een bewijs van gisteren, met het
   bewijs van een ander toestel of een ander lid, en na intrekking.

   Aanvulling op test/bezitsbewijs.test.js en test/bezitsbewijs-takken.test.js;
   hier staat de aanvalskant en het spoor dat elke weigering achterlaat.

   Wat hier niet mag sneuvelen:
   1. een gebonden sessie zonder bewijs, of met een bewijs dat niet met de
      sleutel van DAT toestel is gezet, komt niet door -- ook niet als de
      lading verder perfect is (juiste methode, pad, tijd, jti);
   2. een bewijs is EEN keer bruikbaar, ook over twee werkprocessen heen: het
      herhaalmerk ligt in de gedeelde database en niet in een proces;
   3. een vervalst bewijs vult de herhaallijst niet: een aanvaller zonder
      sleutel kan de opslag niet laten groeien;
   4. de tijd geldt aan beide kanten: precies op de speling mag, een
      milliseconde erover niet, en de toekomst telt even zwaar als het verleden;
   5. een bewijs is gebonden aan lid EN toestel: hetzelfde toestel-id onder een
      andere lidsleutel levert geen sleutel op, en een ingetrokken toestel
      laat zijn eerder geldige bewijzen niet meer toe;
   6. de handeling zit in de handtekening: wie methode, pad of tijd na het
      tekenen verandert, breekt de handtekening;
   7. elke weigering laat een spoor na in de meter, per pad -- in de schaduw als
      "zou zijn geweigerd", nooit als stilte;
   8. een lichter pad dat op een zwaar pad LIJKT (/api/payment, /api/paybox)
      vraagt geen bewijs, en een zwaar pad onder een dieper adres wel.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (alGebruikt(lading.jti))` vervangen door `if (false)`
     -> "2. een onderschept bewijs werkt geen tweede keer, ook niet op een
        tweede werkproces" ZAKT (RAAK).
   - de herhaalcontrole VOOR de handtekening gezet (regel 181 naar boven de
     klopt-aanroep verplaatst)
     -> "3. een vervalst bewijs vult de herhaallijst niet" ZAKT (RAAK): de
        lijst bevat dan het merk van de vervalsing (en zes andere toetsen
        zakken mee, omdat een vervalsing dan een echte jti opgebruikt).
   - `afwijking > SPELING_MS` vervangen door `afwijking > SPELING_MS + 1000`
     -> "4. de speling geldt aan beide kanten" ZAKT (RAAK).

   Draai: node --test test/bezitsbewijs-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { maakBezitsbewijs, zwaarPad, SPELING_MS, PADEN } = require('../server/kern/identiteit/bezitsbewijs');
const { idVan } = require('../server/kern/identiteit/toestelsleutels');

const PAD = '/api/wallet/overboek';

async function sleutelpaar() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const j = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const pub = { kty: j.kty, crv: j.crv, x: j.x, y: j.y };
  return { kp, pub, id: idVan(pub) };
}
const kopVan = (lading) => Buffer.from(JSON.stringify(lading)).toString('base64url');
async function teken(kp, lading) {
  const kop = typeof lading === 'string' ? lading : kopVan(lading);
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(kop, 'utf8'));
  return kop + '.' + Buffer.from(sig).toString('base64url');
}

/* Een klein toestellenregister: per lid de toestellen die hij heeft, met
   intrekken. Dezelfde vorm als het echte (publiekeSleutelVan(lidKey, id)). */
function register() {
  const per = new Map();
  return {
    zet(lid, toestel) { per.set(lid + '|' + toestel.id, toestel.pub); },
    trekIn(lid, id) { per.delete(lid + '|' + id); },
    publiekeSleutelVan(lid, id) { return per.get(lid + '|' + id) || null; }
  };
}

let n = 0;
const jti = () => 'weerbaar_' + String(++n).padStart(12, '0');
const lading = (extra = {}) => Object.assign({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: PAD }, extra);
const sessie = (lid, toestelId, extra = {}) => Object.assign({ key: lid, account: 'acc-' + lid, tier: 'rtg',
  sessieContext: { sleutelbinding: { keyRef: toestelId } } }, extra);

function maak({ db = { data: {} }, toestellen } = {}) {
  let saves = 0;
  const b = maakBezitsbewijs({ db, save() { saves++; }, toestellen });
  return { b, db, saves: () => saves };
}

function metOmgeving(waarden, fn) {
  const oud = {};
  for (const k of Object.keys(waarden)) {
    oud[k] = process.env[k];
    if (waarden[k] == null) delete process.env[k]; else process.env[k] = waarden[k];
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const k of Object.keys(oud)) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; }
  });
}

/* De klok verzetten zonder te slapen: klok.nu() leest Date.now(). */
async function metTijd(ms, fn) {
  const echt = Date.now;
  Date.now = () => ms;
  try { return await fn(); } finally { Date.now = echt; }
}

test('1. het token zonder de sleutel: geen bewijs, of een bewijs van een andere sleutel, komt niet door', async () => {
  const lid = await sleutelpaar(), dief = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);

  const zonder = await b.controleer({ sess, methode: 'POST', pad: PAD, stand: 'aanbevolen' });
  assert.equal(zonder.stand, 'geweigerd');
  assert.equal(zonder.code, 401, 'een gebonden sessie zonder bewijs is een 401');
  assert.match(zonder.reden, /aan een sleutel gebonden/);

  // De dief kent alles behalve de sleutel: de lading is perfect.
  const vals = await teken(dief.kp, lading());
  const uit = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: vals, stand: 'verplicht' });
  assert.deepEqual([uit.stand, uit.code], ['geweigerd', 401]);
  assert.match(uit.reden, /klopt niet bij het toestel/);

  // En een lege handtekening of rommel achter de punt evenmin.
  for (const staart of ['', 'AAAA', '!!!!']) {
    const r = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: kopVan(lading()) + '.' + staart, stand: 'verplicht' });
    assert.equal(r.stand, 'geweigerd', 'handtekening "' + staart + '" mag niet slagen');
    assert.equal(r.code, 401);
  }

  // Ter controle: met de echte sleutel gaat dezelfde vorm wel door.
  const echt = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading()), stand: 'verplicht' });
  assert.equal(echt.stand, 'bewezen');
  assert.equal(echt.waarom, 'tegoed en passen', 'de reden komt uit de padlijst');
});

test('2. een onderschept bewijs werkt geen tweede keer, ook niet op een tweede werkproces', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const db = { data: {} };
  const proces1 = maak({ db, toestellen: reg });
  const proces2 = maak({ db, toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const kop = await teken(lid.kp, lading());

  const eerst = await proces1.b.controleer({ sess, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.equal(eerst.stand, 'bewezen');
  assert.equal(proces1.saves(), 1, 'het herhaalmerk wordt meteen weggeschreven');

  const herhaald = await proces2.b.controleer({ sess, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.deepEqual([herhaald.stand, herhaald.code], ['geweigerd', 401]);
  assert.match(herhaald.reden, /al gebruikt/);
  assert.equal(proces2.saves(), 0, 'een herhaling schrijft niets bij');

  // Ook op het eigen proces nog een keer: nog steeds nee.
  const derde = await proces1.b.controleer({ sess, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.equal(derde.stand, 'geweigerd');
});

test('3. een vervalst bewijs vult de herhaallijst niet', async () => {
  const lid = await sleutelpaar(), dief = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b, db, saves } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  for (let i = 0; i < 25; i++) {
    const r = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(dief.kp, lading()), stand: 'verplicht' });
    assert.equal(r.stand, 'geweigerd');
  }
  const lijst = (db.data.bezitsbewijzen) || {};
  assert.equal(Object.keys(lijst).length, 0, 'zonder sleutel geen merk in de opslag');
  assert.equal(saves(), 0, 'en geen enkele schrijfactie');

  // En een vervalsing met de jti van een LATER echt bewijs blokkeert dat echte bewijs niet.
  const zelfde = jti();
  await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(dief.kp, lading({ jti: zelfde })), stand: 'verplicht' });
  const echt = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ jti: zelfde })), stand: 'verplicht' });
  assert.equal(echt.stand, 'bewezen', 'een dief kan een jti niet vooraf opgebruiken');
});

test('4. de speling geldt aan beide kanten, tot op de milliseconde', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const NU = Date.UTC(2026, 9, 14, 12, 0, 0);
  await metTijd(NU, async () => {
    const geval = async (tijd) => (await b.controleer({ sess, methode: 'POST', pad: PAD,
      kop: await teken(lid.kp, lading({ tijd })), stand: 'verplicht' })).stand;
    assert.equal(await geval(NU - SPELING_MS), 'bewezen', 'precies op de grens in het verleden mag');
    assert.equal(await geval(NU + SPELING_MS), 'bewezen', 'precies op de grens in de toekomst mag');
    assert.equal(await geval(NU - SPELING_MS - 1), 'geweigerd', 'een milliseconde te oud niet');
    assert.equal(await geval(NU + SPELING_MS + 1), 'geweigerd', 'een milliseconde te vroeg niet');
    assert.equal(await geval(NU - 24 * 3600 * 1000), 'geweigerd', 'een bewijs van gisteren niet');
    assert.equal(await geval('nu'), 'geweigerd', 'een tijd die geen getal is niet');
  });
  const r = await b.controleer({ sess, methode: 'POST', pad: PAD,
    kop: await teken(lid.kp, lading({ tijd: Date.now() - SPELING_MS * 3 })), stand: 'verplicht' });
  assert.match(r.reden, /te oud of ligt in de toekomst/);
});

test('4b. een gebruikt merk verloopt pas na twee keer de speling, en dan ruimt het volgende bewijs het op', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b, db } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);
  const eerste = jti();
  await metTijd(T0, async () => {
    assert.equal((await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ jti: eerste, tijd: T0 })), stand: 'verplicht' })).stand, 'bewezen');
  });
  assert.equal(db.data.bezitsbewijzen[eerste], T0 + SPELING_MS * 2, 'het merk leeft twee spelingen lang');
  // Binnen het venster: het merk staat er nog.
  await metTijd(T0 + SPELING_MS, async () => {
    await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ tijd: T0 + SPELING_MS })), stand: 'verplicht' });
  });
  assert.ok(eerste in db.data.bezitsbewijzen, 'binnen het venster wordt niets opgeruimd');
  // Na het venster: het volgende geldige bewijs ruimt het oude merk op.
  const later = T0 + SPELING_MS * 2 + 1;
  await metTijd(later, async () => {
    await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ tijd: later })), stand: 'verplicht' });
  });
  assert.ok(!(eerste in db.data.bezitsbewijzen), 'het verlopen merk is weg');
});

test('5. verkeerde binding: hetzelfde toestel-id onder een ander lid levert geen sleutel', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  // Iemand anders zet het toestel-id van user-7 in zijn eigen sessie.
  const indringer = sessie('user-8', lid.id);
  const r = await b.controleer({ sess: indringer, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading()), stand: 'verplicht' });
  assert.deepEqual([r.stand, r.code], ['geweigerd', 403]);
  assert.match(r.reden, /niet meer bekend of ingetrokken/);

  // Een sessie gebonden aan toestel B, met een bewijs van toestel A van hetzelfde lid.
  const tweede = await sleutelpaar(); reg.zet('user-7', tweede);
  const r2 = await b.controleer({ sess: sessie('user-7', tweede.id), methode: 'POST', pad: PAD,
    kop: await teken(lid.kp, lading()), stand: 'verplicht' });
  assert.equal(r2.code, 401, 'een bewijs van het verkeerde toestel klopt niet');
});

test('5b. na intrekking werkt een sessie op dat toestel niet meer, ook niet met een vers bewijs', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const voorraad = [await teken(lid.kp, lading()), await teken(lid.kp, lading())];
  assert.equal((await b.controleer({ sess, methode: 'POST', pad: PAD, kop: voorraad[0], stand: 'verplicht' })).stand, 'bewezen');
  reg.trekIn('user-7', lid.id);
  const na = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: voorraad[1], stand: 'verplicht' });
  assert.deepEqual([na.stand, na.code], ['geweigerd', 403], 'een vooraf getekend bewijs is na intrekking niets waard');
  // Ook in `aanbevolen`: een gebonden sessie komt er niet langs na intrekking.
  const aanb = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading()), stand: 'aanbevolen' });
  assert.equal(aanb.stand, 'geweigerd');
});

test('5c. zonder bruikbaar toestellenregister is er geen sleutel, en dus geen doorgang', async () => {
  const lid = await sleutelpaar();
  for (const toestellen of [undefined, null, {}, { publiekeSleutelVan: 'geen functie' }]) {
    const { b } = maak({ toestellen });
    const r = await b.controleer({ sess: sessie('user-7', lid.id), methode: 'POST', pad: PAD,
      kop: await teken(lid.kp, lading()), stand: 'verplicht' });
    assert.deepEqual([r.stand, r.code], ['geweigerd', 403]);
  }
  // Een register dat een kapotte sleutel teruggeeft: de verificatie faalt dicht.
  const { b } = maak({ toestellen: { publiekeSleutelVan: () => ({ kty: 'EC', crv: 'P-256', x: 'kapot', y: 'kapot' }) } });
  const r = await b.controleer({ sess: sessie('user-7', lid.id), methode: 'POST', pad: PAD,
    kop: await teken(lid.kp, lading()), stand: 'verplicht' });
  assert.equal(r.code, 401);
});

test('6. de handeling zit in de handtekening: na het tekenen niets meer aan te passen', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  // Getekend voor een saldo LEZEN; de dief zet de lading om naar een overboeking.
  const echt = await teken(lid.kp, lading({ methode: 'GET', pad: '/api/wallet/saldo' }));
  const [kop, sig] = echt.split('.');
  const lad = JSON.parse(Buffer.from(kop, 'base64url').toString());
  for (const wijzig of [{ methode: 'POST' }, { pad: PAD }, { methode: 'POST', pad: PAD }, { tijd: lad.tijd + 1 }]) {
    const nieuw = Object.assign({}, lad, wijzig);
    const r = await b.controleer({ sess, methode: nieuw.methode, pad: nieuw.pad, kop: kopVan(nieuw) + '.' + sig, stand: 'verplicht' });
    assert.deepEqual([r.stand, r.code], ['geweigerd', 401], 'wijziging ' + JSON.stringify(wijzig) + ' moet de handtekening breken');
    assert.match(r.reden, /klopt niet/);
  }
  // Het onveranderde bewijs gebruikt voor de overboeking: andere handeling.
  const r = await b.controleer({ sess, methode: 'POST', pad: '/api/wallet/saldo', kop: echt, stand: 'verplicht' });
  assert.match(r.reden, /andere handeling/);
  const r2 = await b.controleer({ sess, methode: 'GET', pad: PAD, kop: echt, stand: 'verplicht' });
  assert.match(r2.reden, /ander adres/);
  // Een lading ZONDER methode, pad of tijd dekt niets: ontbrekend is geen joker.
  const zonder = async (weg, arg) => {
    const l = lading(); delete l[weg];
    return b.controleer(Object.assign({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, l), stand: 'verplicht' }, arg));
  };
  assert.match((await zonder('methode')).reden, /andere handeling/);
  assert.match((await zonder('pad')).reden, /ander adres/);
  assert.match((await zonder('tijd')).reden, /te oud/);
  // En een verzoek zonder methode of pad wordt niet gedekt door een lading die ze wel heeft.
  assert.match((await zonder('niets', { methode: undefined })).reden, /andere handeling/);
  // De methode is hoofdletterongevoelig, het pad niet.
  assert.equal((await b.controleer({ sess, methode: 'get', pad: '/api/wallet/saldo', kop: echt, stand: 'verplicht' })).stand, 'bewezen');
});

test('6b. een jti moet tekst van 16 tot 64 veilige tekens zijn, ook in een geldig getekend bewijs', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b, db } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  for (const fout of ['kort', 'x'.repeat(65), 'a'.repeat(15) + '/', 12345678901234567, null, '__proto__xxxxxxxxx'.replace(/_/g, '.')]) {
    const r = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ jti: fout })), stand: 'verplicht' });
    assert.deepEqual([r.stand, r.code, r.reden], ['geweigerd', 401, 'Onleesbaar bezitsbewijs.'], 'jti ' + String(fout));
  }
  assert.equal(Object.keys(db.data.bezitsbewijzen || {}).length, 0);
  assert.equal((await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ jti: 'A'.repeat(16) })), stand: 'verplicht' })).stand, 'bewezen');
  assert.equal((await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading({ jti: 'z'.repeat(64) })), stand: 'verplicht' })).stand, 'bewezen');
});

test('6c. onleesbare vormen zijn een 401 en geen crash', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const vormen = ['geenpunt', 'a.b.c', '.', kopVan('tekst') + '.x', kopVan(null) + '.x', kopVan(42) + '.x',
    Buffer.from('{kapot').toString('base64url') + '.x', 12345];
  for (const kop of vormen) {
    const r = await b.controleer({ sess, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
    assert.equal(r.stand, 'geweigerd', 'vorm ' + String(kop));
    assert.equal(r.code, 401);
  }
});

test('7. elke weigering laat een spoor na in de meter, per pad', async () => {
  const lid = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const nul = b.stand();
  assert.equal(nul.zwareVerzoeken, 0);
  assert.equal(nul.dekking, null, 'niets gemeten is geen nul procent');

  await b.controleer({ sess, methode: 'POST', pad: PAD, stand: 'verplicht' });                       // geen bewijs
  await b.controleer({ sess, methode: 'POST', pad: '/api/pay/x', kop: 'rommel', stand: 'aanbevolen' }); // onleesbaar
  await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading()), stand: 'verplicht' }); // bewezen
  await b.controleer({ sess: { key: 'user-9', account: 'a', tier: 'rtg', sessieContext: {} }, methode: 'POST', pad: '/api/bank/x', stand: 'aanbevolen' }); // onbeschermd
  await b.controleer({ sess, methode: 'GET', pad: '/api/menu', stand: 'verplicht' });                  // nvt: telt niet

  const s = b.stand();
  assert.equal(s.zwareVerzoeken, 4, 'een licht pad telt niet mee');
  assert.deepEqual(s.perPad['/api/wallet/'], { geweigerd: 1, bewezen: 1 });
  assert.deepEqual(s.perPad['/api/pay/'], { geweigerd: 1 });
  assert.deepEqual(s.perPad['/api/bank/'], { onbeschermd: 1 });
  assert.equal(s.onbeschermd, 1);
  assert.equal(s.dekking, 33.3, 'een van de drie beschermbare verzoeken droeg een geldig bewijs');
  // De teruggegeven stand is een kopie: een aanroeper kan de meter niet bijsturen.
  s.perPad['/api/pay/'].geweigerd = 0; s.perUitkomst.bewezen = 99;
  assert.deepEqual(b.stand().perPad['/api/pay/'], { geweigerd: 1 });
  assert.equal(b.stand().perUitkomst.bewezen, 1);
});

test('7b. in de schaduw wordt niets geweigerd, maar elke weigering staat er als "zou zijn"', async () => {
  const lid = await sleutelpaar(), dief = await sleutelpaar();
  const reg = register(); reg.zet('user-7', lid);
  const { b } = maak({ toestellen: reg });
  const sess = sessie('user-7', lid.id);
  const r = await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(dief.kp, lading()), stand: 'schaduw' });
  assert.equal(r.stand, 'schaduw');
  assert.equal(r.zouZijn, 'geweigerd');
  assert.match(r.reden, /klopt niet/);
  assert.equal(r.waarom, 'tegoed en passen');
  // In de schaduw wordt een ongebonden sessie beoordeeld als in `aanbevolen`: onbeschermd, geen weigering.
  const los = await b.controleer({ sess: { key: 'user-9', sessieContext: null }, methode: 'POST', pad: PAD, stand: 'schaduw' });
  assert.equal(los.stand, 'onbeschermd');
  assert.match(los.nietAfgedwongen, /gestolen token/);
  // En een geldig bewijs in de schaduw is gewoon bewezen.
  assert.equal((await b.controleer({ sess, methode: 'POST', pad: PAD, kop: await teken(lid.kp, lading()), stand: 'schaduw' })).stand, 'bewezen');
  assert.deepEqual(b.stand().perPad['/api/wallet/'], { schaduw: 1, onbeschermd: 1, bewezen: 1 });
});

test('7c. een onleesbaar register of een kapotte verifier sluit, en ook dat telt als weigering', async () => {
  const lid = await sleutelpaar();
  const { b } = maak({ toestellen: { publiekeSleutelVan() { throw new Error('opslag weg'); } } });
  const kapot = await b.controleer({ sess: sessie('user-7', lid.id), methode: 'POST', pad: PAD,
    kop: await teken(lid.kp, lading()), stand: 'verplicht' });
  assert.deepEqual([kapot.stand, kapot.code, kapot.storing], ['geweigerd', 503, true]);
  assert.match(kapot.reden, /niets uitgevoerd/);

  const storing = await b.controleer({ sess: { key: 'user-7', sessieContextStoring: true }, methode: 'POST', pad: PAD, stand: 'aanbevolen' });
  assert.deepEqual([storing.stand, storing.code], ['geweigerd', 503], 'onleesbaar is niet hetzelfde als ongebonden');
  assert.match(storing.reden, /niet worden gelezen/);
  assert.deepEqual(b.stand().perUitkomst, { geweigerd: 2 });
});

test('8. een pad dat op een zwaar pad lijkt is niet zwaar; een dieper adres onder een zwaar pad wel', async () => {
  for (const licht of ['/api/payment', '/api/paybox', '/api/walletjes', '/API/PAY/x', 'api/pay/x', '', undefined, 42])
    assert.equal(zwaarPad(licht), null, String(licht) + ' is geen zwaar pad');
  for (const zwaar of ['/api/pay/a/b/c', '/api/auth/password/reset', '/api/privacy/delete?id=1', '/api/gegevens/telefoon'])
    assert.ok(zwaarPad(zwaar), zwaar + ' is zwaar');
  // Elk zwaar pad uit de lijst is als zodanig herkenbaar en draagt zijn eigen reden.
  for (const p of PADEN) assert.equal(zwaarPad(p.pad).reden, p.reden);

  const { b } = maak({});
  // Een licht pad vraagt niets, ook niet van een sessie zonder iets.
  assert.deepEqual(await b.controleer({ sess: null, methode: 'POST', pad: '/api/payment', stand: 'verplicht' }), { stand: 'nvt' });
});

test('9. de stand uit de omgeving: leeg en onbekend zijn verplicht, schaduw niet in productie', async () => {
  const { b } = maak({});
  const geen = { key: 'user-9', account: 'a', tier: 'rtg', sessieContext: {} };
  await metOmgeving({ RTG_BEZITSBEWIJS: null, NODE_ENV: 'test' }, async () => {
    assert.equal(b.standNu().stand, 'verplicht');
    const r = await b.controleer({ sess: geen, methode: 'POST', pad: PAD });
    assert.deepEqual([r.stand, r.code], ['geweigerd', 403]);
    assert.match(r.reden, /Bevestig dit toestel/, 'een lid met account krijgt de weg naar binden');
  });
  await metOmgeving({ RTG_BEZITSBEWIJS: 'Uit', NODE_ENV: 'test' }, async () => {
    const s = b.standNu();
    assert.equal(s.stand, 'verplicht', 'een typefout zet niets uit');
    assert.match(s.reden, /onbekende waarde "uit"/);
  });
  await metOmgeving({ RTG_BEZITSBEWIJS: ' aanbevolen ', NODE_ENV: 'test' }, async () => {
    const r = await b.controleer({ sess: geen, methode: 'POST', pad: PAD });
    assert.equal(r.stand, 'onbeschermd', 'aanbevolen laat een ongebonden sessie door, en zegt dat');
    assert.ok(r.nietAfgedwongen);
  });
  await metOmgeving({ RTG_BEZITSBEWIJS: 'schaduw', NODE_ENV: 'production' }, async () => {
    const s = b.standNu();
    assert.equal(s.stand, 'verplicht');
    assert.match(s.reden, /niet toegestaan/);
    const r = await b.controleer({ sess: geen, methode: 'POST', pad: PAD });
    assert.equal(r.stand, 'geweigerd', 'schaduw in productie weigert gewoon');
  });
  await metOmgeving({ RTG_BEZITSBEWIJS: 'schaduw', NODE_ENV: 'test' }, async () => {
    const r = await b.controleer({ sess: { key: 'x', sessieContextStoring: true }, methode: 'POST', pad: PAD });
    assert.equal(r.stand, 'schaduw');
    assert.equal(r.zouZijn, 'geweigerd');
  });
});

test('9b. in verplicht krijgt wie niet KAN binden de accountweg, niet de toestelweg', async () => {
  const { b } = maak({});
  for (const sess of [null, undefined, {}, { account: 'a', tier: 'guest' }, { tier: 'rtg' }, { sessieContext: { sleutelbinding: {} } }]) {
    const r = await b.controleer({ sess, methode: 'POST', pad: PAD, stand: 'verplicht' });
    assert.deepEqual([r.stand, r.code], ['geweigerd', 403]);
    assert.match(r.reden, /eigen RTG-account/, JSON.stringify(sess));
  }
  const lid = await b.controleer({ sess: { account: 'a', tier: 'rtg', sessieContext: { sleutelbinding: { keyRef: '' } } }, methode: 'POST', pad: PAD, stand: 'verplicht' });
  assert.match(lid.reden, /Waar ben ik aanwezig/);
});
