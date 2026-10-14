/* DE SESSIESTROOM ONDER AANVAL (server/kern/sessiestroom.js).

   Een stroomticket staat in een ADRES: in proxy- en serverlogs, in de
   browsergeschiedenis, in een Referer. Wie dat adres later leest, mag er niets
   mee. test/sessiestroom.test.js en test/sessiestroom-takken.test.js houden de
   gewone weg en de randen vast; dit bestand speelt de aanvaller die het adres
   heeft gelezen of de opslag kan aanraken: hij speelt het ticket opnieuw af,
   probeert het op een andere soort of een ander onderwerp, verschuift de zegel
   tussen rijen of tussen soorten, draait een enkel bit in de zegel om, of
   rekent op een sessie die intussen is afgemeld. Daarnaast de herstelkant:
   een asynchrone opslag, een soortnaam die op een prototypesleutel lijkt, en
   het plafond dat de oudste verdringt en nooit die van een ander.

   Wat hier niet mag sneuvelen:
   1. een eenmalig ticket opent precies een keer: een tweede poging (replay),
      ook vanuit een tweede dienst op dezelfde opslag, is een 401;
   2. met maxGebruik > 1 telt de claim af en is het ticket na de laatste
      opening weg -- niet een opening te veel;
   3. een ticket is gebonden aan zijn soort en zijn onderwerp: een ander
      onderwerp of een andere soort opent niets, en een mislukte poging met
      het verkeerde onderwerp VERBRUIKT het ticket (geen tweede gok);
   4. een zegel die een bit kwijt is, onder een ander ticket of een andere
      soort is geschoven, of met een andere sleutel is gemaakt, opent niets;
   5. de sessie wordt bij openen opnieuw getoetst: wie na de uitgifte is
      afgemeld, krijgt niets, en de sessie zelf staat nooit leesbaar in de
      opslag;
   6. een verlopen ticket wordt bij de volgende handeling opgeruimd;
   7. een soortnaam als `constructor` leest geen geërfde eigenschap als rij;
   8. een haperende opslag geeft 503 en laat het ticket ongemoeid; zonder
      bruikbare zegelsleutel komt er geen ticket en blijft er niets achter;
   9. een rij in de opslag die geen lijst is, een onderwerp met een
      misvormde sessie of zegel, of een deur die bij openen gooit: dicht, en
      het ticket is daarna op.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in `aadVan` de hash van het ticket uit de geassocieerde gegevens gehaald
     -> "4. een geknoeide zegel" en "4b. een zegel van een andere sessie"
     ZAKKEN: een zegel onder een ander ticket ging open (RAAK)
   - in `open` de binding `bij: onderwerpId` weggehaald uit de claim
     -> "3. gebonden aan soort en onderwerp" ZAKT: een kijkticket voor video
     v1 opende v2 (RAAK)
   - in `open` de hercontrole `s.geldig(raw, onderwerpId)` vervangen door
     `!!raw`
     -> "5. wie na de uitgifte is afgemeld" ZAKT (RAAK)
   - in `open` de 503 bij een gooiende opslag vervangen door 401
     -> "8. herstel" ZAKT (RAAK)
   Twee mutaties OVERLEVEN, en dat is uitgezocht: `tokenHash(raw) === o.sessie`
   in `geopend` weghalen is hier gelijkwaardig, omdat de sessiehash al in de
   AAD zit (een zegel die opengaat, draagt per constructie die sessie: het is
   verdediging in de diepte); en `hasOwnProperty` in `eigen` vervangen door
   `k in o` is gelijkwaardig, omdat stroomticket en kijk een rij die geen
   lijst is al als leeg lezen (toets 7 bewaakt dat gedrag, niet de regel).

   Draai: node --test test/sessiestroom-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maak, COLLECTIE } = require('../server/kern/sessiestroom');
const { tokenHash } = require('../server/kern/sessies');

const A = 'SESSIE-A-' + 'a'.repeat(48);
const B = 'SESSIE-B-' + 'b'.repeat(48);
const T0 = Date.parse('2026-10-14T08:00:00.000Z');

/* Een gedeelde opslag, zoals twee servers achter een balans die hebben. */
function opslagVan({ async = false } = {}) {
  const data = {};
  const bewerkCollectie = (naam, werk) => {
    const k = JSON.parse(JSON.stringify(data[naam] || {}));
    const uit = werk(k); data[naam] = k;
    return async ? Promise.resolve().then(() => uit) : uit;
  };
  return { data, bewerkCollectie };
}
function dienst({ opslag = opslagVan(), sleutel = Buffer.alloc(32, 9), klok = { t: T0 }, levend = new Set([A, B]) } = {}) {
  const d = maak({ db: { data: {} }, crypto, nu: () => new Date(klok.t).toISOString(), zegelSleutel: () => sleutel,
    productie: false, bewerkCollectie: opslag.bewerkCollectie });
  d.soort('lid', { geldig: raw => levend.has(raw) });
  d.soort('kantoor', { geldig: raw => raw === A && levend.has(raw) });
  d.soort('video', { geldig: (raw, bij) => levend.has(raw) && /^v\d+$/.test(bij), metBij: true, maxGebruik: 3 });
  return { d, opslag, klok, levend };
}
const rijen = (w, naam) => (w.opslag.data[COLLECTIE] || {})[naam] || [];

test('1. een eenmalig ticket opent een keer; replay, ook via een tweede server, is een 401', async () => {
  const w = dienst();
  const tweede = dienst({ opslag: w.opslag, klok: w.klok });
  const t = await w.d.geef('lid', A);
  assert.equal(t.ok, true);
  assert.match(t.ticket, /^ST\.[0-9A-F]{32}$/);
  assert.equal(t.geldigTot, new Date(T0 + 60000).toISOString(), 'standaard een minuut');
  assert.deepEqual(await tweede.d.open('lid', t.ticket), { ok: true, token: A }, 'een andere server claimt via de gedeelde opslag');
  assert.deepEqual(await w.d.open('lid', t.ticket), { status: 401 }, 'het afgeluisterde adres opent daarna niets meer');
  assert.deepEqual(await tweede.d.open('lid', t.ticket), { status: 401 });
  assert.deepEqual(rijen(w, 'lid'), [], 'de claim heeft het ticket weggehaald');
  assert.deepEqual(await w.d.open('lid', ' ' + t.ticket.toLowerCase() + ' '), { status: 401 }, 'ook niet in een andere schrijfwijze');
});

test('2. maxGebruik 3: precies drie openingen, dan weg', async () => {
  const w = dienst();
  const t = await w.d.geef('video', A, 'v1');
  for (let i = 1; i <= 3; i++) {
    assert.deepEqual(await w.d.open('video', t.ticket, 'v1'), { ok: true, token: A }, 'opening ' + i);
    assert.equal(rijen(w, 'video').length, i < 3 ? 1 : 0, 'na opening ' + i);
  }
  assert.deepEqual(await w.d.open('video', t.ticket, 'v1'), { status: 401 }, 'de vierde is er een te veel');
});

test('3. gebonden aan soort en onderwerp; een verkeerde gok verbruikt het ticket', async () => {
  const w = dienst();
  const lid = await w.d.geef('lid', A);
  assert.deepEqual(await w.d.open('kantoor', lid.ticket), { status: 401 }, 'een ledenticket opent de kantoorstroom niet');
  assert.deepEqual(await w.d.open('video', lid.ticket, 'v1'), { status: 401 });
  assert.deepEqual(await w.d.open('lid', lid.ticket), { ok: true, token: A }, 'pogingen op een andere soort raken dit ticket niet');

  assert.deepEqual(await w.d.geef('kantoor', B), { status: 401, error: 'Deze sessie mag deze stroom niet openen.' },
    'een lid krijgt geen kantoorticket');

  const v = await w.d.geef('video', A, 'v1');
  assert.deepEqual(await w.d.open('video', v.ticket, 'v2'), { status: 401 }, 'een ander onderwerp opent niets');
  assert.deepEqual(await w.d.open('video', v.ticket, 'v1'), { ok: true, token: A },
    'met maxGebruik 3 telt de mislukte binding als gebruik, maar er is nog over');
  const eenmalig = dienst();
  eenmalig.d.soort('beeld', { geldig: (raw, bij) => raw === A && bij === 'b1', metBij: true });
  const e = await eenmalig.d.geef('beeld', A, 'b1');
  assert.deepEqual(await eenmalig.d.open('beeld', e.ticket, 'b2'), { status: 401 });
  assert.deepEqual(await eenmalig.d.open('beeld', e.ticket, 'b1'), { status: 401 },
    'een eenmalig ticket is na een verkeerde gok op: geen tweede kans om onderwerpen af te tasten');

  assert.deepEqual(await w.d.geef('video', A, 'x9'), { status: 401, error: 'Deze sessie mag deze stroom niet openen.' },
    'de deurcontrole ziet het onderwerp al bij de uitgifte');
  assert.deepEqual(await w.d.geef('bestaat-niet', A), { status: 400, error: 'Deze stroom kennen we niet.' });
  assert.deepEqual(await w.d.geef(undefined, A), { status: 400, error: 'Deze stroom kennen we niet.' });
  assert.deepEqual(await w.d.geef('video', A), { status: 400, error: 'Zeg voor welk onderwerp dit ticket is.' });
  assert.deepEqual(await w.d.open('video', 'ST.' + '0'.repeat(32), undefined), { status: 401 });
});

test('4. een geknoeide zegel opent niets: een bit om, verschoven tussen tickets of soorten', async () => {
  const w = dienst();
  const t = await w.d.geef('lid', A);
  const onderwerp = rijen(w, 'lid')[0].onderwerp;
  assert.equal(onderwerp.sessie, tokenHash(A), 'in de opslag alleen de hash van de sessie');
  assert.ok(!JSON.stringify(w.opslag.data).includes(A), 'de sessie staat nergens leesbaar in de opslag');
  for (const plek of [0, 12, 28, -1]) {
    const b = Buffer.from(onderwerp.zegel, 'base64');
    const i = plek < 0 ? b.length + plek : plek;
    b[i] ^= 1;
    const k = JSON.parse(JSON.stringify(w.opslag.data));
    k[COLLECTIE].lid[0].onderwerp.zegel = b.toString('base64');
    const kopie = dienst({ opslag: { data: k, bewerkCollectie: (n, f) => { const x = JSON.parse(JSON.stringify(k[n])); const u = f(x); k[n] = x; return u; } }, klok: w.klok });
    assert.deepEqual(await kopie.d.open('lid', t.ticket), { status: 401 }, 'een omgedraaid bit op ' + (plek < 0 ? 'het eind' : 'byte ' + plek) + ' (iv, tag of inhoud)');
    assert.equal(await kopie.d.kijk(t.ticket), null);
  }

  /* De zegel van ticket 1 onder ticket 2 geschoven: de AAD draagt de hash van
     het ticket, dus het opent niet -- ook niet met dezelfde sessie. */
  const v = dienst();
  const t1 = await v.d.geef('lid', A);
  const t2 = await v.d.geef('lid', A);
  const [r1, r2] = rijen(v, 'lid');
  r2.onderwerp.zegel = r1.onderwerp.zegel;
  assert.deepEqual(await v.d.open('lid', t2.ticket), { status: 401 }, 'een zegel onder een ander ticket');
  assert.deepEqual(await v.d.open('lid', t1.ticket), { ok: true, token: A }, 'het origineel opent nog wel');

  /* Een ledenrij in de kantoorlijst gezet: de soort zit in het doel, in de
     binding en in de AAD. */
  const s = dienst();
  const lt = await s.d.geef('lid', A);
  s.opslag.data[COLLECTIE].kantoor = s.opslag.data[COLLECTIE].lid;
  assert.deepEqual(await s.d.open('kantoor', lt.ticket), { status: 401 }, 'een verplaatste rij opent een andere soort niet');
  assert.deepEqual(await s.d.kijk(lt.ticket), { soort: 'lid', token: A }, 'de echte rij onder lid staat er nog, en kijk noemt de juiste soort');
  s.opslag.data[COLLECTIE] = { kantoor: s.opslag.data[COLLECTIE].lid };
  assert.equal(await s.d.kijk(lt.ticket), null, 'alleen onder kantoor: kijk vindt hem en weigert hem daar');
});

test('4b. een zegel van een andere sessie, of met een andere sleutel, opent niets', async () => {
  const w = dienst();
  const ta = await w.d.geef('lid', A);
  const tb = await w.d.geef('lid', B);
  const [ra, rb] = rijen(w, 'lid');
  /* Sessie en zegel van B onder het ticket van A: de AAD noemt het ticket. */
  ra.onderwerp.sessie = rb.onderwerp.sessie;
  ra.onderwerp.zegel = rb.onderwerp.zegel;
  assert.deepEqual(await w.d.open('lid', ta.ticket), { status: 401 });
  assert.deepEqual(await w.d.open('lid', tb.ticket), { ok: true, token: B });

  const ander = dienst({ sleutel: Buffer.alloc(32, 1) });
  const t = await ander.d.geef('lid', A);
  const zelfdeOpslag = dienst({ opslag: ander.opslag, sleutel: Buffer.alloc(32, 2), klok: ander.klok });
  assert.deepEqual(await zelfdeOpslag.d.open('lid', t.ticket), { status: 401 }, 'een server met een andere zegelsleutel leest niets');
  assert.deepEqual(rijen(ander, 'lid'), [], 'en het ticket is daarmee wel verbruikt');
});

test('5. wie na de uitgifte is afgemeld, opent niets -- ook binnen de minuut', async () => {
  const w = dienst();
  const t = await w.d.geef('lid', A);
  const v = await w.d.geef('video', A, 'v3');
  w.levend.delete(A);
  assert.deepEqual(await w.d.open('lid', t.ticket), { status: 401 });
  assert.deepEqual(await w.d.open('video', v.ticket, 'v3'), { status: 401 });
  assert.deepEqual(await w.d.geef('lid', A), { status: 401, error: 'Deze sessie mag deze stroom niet openen.' });
  const wankel = dienst();
  wankel.d.soort('wankel', { geldig: async raw => { if (raw === B) throw new Error('kluis weg'); return raw === A ? 'ja' : 0; } });
  assert.equal((await wankel.d.geef('wankel', A)).ok, true, 'een truthy antwoord van de deur geldt als ja');
  assert.equal((await wankel.d.geef('wankel', B)).status, 401, 'een deur die gooit is dicht');
});

test('6. verlopen: na een minuut niets, en de rij verdwijnt bij de volgende handeling', async () => {
  const w = dienst();
  const t = await w.d.geef('lid', A);
  await w.d.geef('lid', B);
  w.klok.t = T0 + 59999;
  assert.equal((await w.d.kijk(t.ticket)).token, A, 'een milliseconde voor het einde leeft hij nog');
  w.klok.t = T0 + 60000;
  assert.deepEqual(await w.d.open('lid', t.ticket), { status: 401 }, 'precies op het einde is verlopen');
  assert.equal(w.opslag.data[COLLECTIE].lid, undefined, 'beide verlopen rijen zijn opgeruimd');
});

test('6b. het plafond verdringt de oudste van DEZE sessie en dit onderwerp, nooit die van een ander', async () => {
  const w = dienst();
  const vanB = await w.d.geef('video', B, 'v1');
  const anderOnderwerp = await w.d.geef('video', A, 'v2');
  const eigen = [];
  for (let i = 0; i < 9; i++) eigen.push(await w.d.geef('video', A, 'v1'));
  assert.equal(rijen(w, 'video').length, 10, 'acht van A op v1, plus een van B en een van A op v2');
  assert.deepEqual(await w.d.open('video', eigen[0].ticket, 'v1'), { status: 401 }, 'de oudste is verdrongen');
  assert.deepEqual(await w.d.open('video', eigen[8].ticket, 'v1'), { ok: true, token: A });
  assert.deepEqual(await w.d.open('video', vanB.ticket, 'v1'), { ok: true, token: B }, 'een ander verliest zijn ticket niet');
  assert.deepEqual(await w.d.open('video', anderOnderwerp.ticket, 'v2'), { ok: true, token: A });
});

test('7. een soortnaam als constructor leest geen geërfde eigenschap, en een asynchrone opslag werkt', async () => {
  const w = dienst({ opslag: opslagVan({ async: true }) });
  w.d.soort('constructor', { geldig: raw => raw === A });
  w.d.soort('tostring', { geldig: raw => raw === A });
  assert.deepEqual(await w.d.open('constructor', 'ST.' + 'A'.repeat(32)), { status: 401 },
    'een lege kaart heeft geen eigen rij constructor, ook al erft hij er een');
  assert.equal(await w.d.kijk('ST.' + 'A'.repeat(32)), null);
  const t = await w.d.geef('constructor', A);
  assert.equal(t.ok, true);
  assert.equal(Array.isArray(w.opslag.data[COLLECTIE].constructor), true, 'de rij is een eigen lijst');
  assert.deepEqual(await w.d.kijk(t.ticket), { soort: 'constructor', token: A });
  assert.deepEqual(await w.d.open('constructor', t.ticket), { ok: true, token: A });
  assert.deepEqual(await w.d.open('constructor', t.ticket), { status: 401 });
  assert.deepEqual(w.d.soorten(), ['lid', 'kantoor', 'video', 'constructor', 'tostring']);
});

test('8. herstel: een haperende opslag of zegelsleutel kost een poging, geen ticket en geen sessie', async () => {
  const opslag = opslagVan();
  let stuk = false;
  const wankel = { data: opslag.data, bewerkCollectie: (n, f) => { if (stuk) throw new Error('opslag hapert'); return opslag.bewerkCollectie(n, f); } };
  let sleutel = Buffer.alloc(32, 4);
  const klok = { t: T0 };
  const d = maak({ db: { data: {} }, crypto, nu: () => new Date(klok.t).toISOString(), zegelSleutel: () => sleutel,
    productie: true, bewerkCollectie: wankel.bewerkCollectie });
  d.soort('lid', { geldig: raw => raw === A });

  const t = await d.geef('lid', A);
  stuk = true;
  assert.deepEqual(await d.open('lid', t.ticket), { status: 503 }, 'een haperende opslag is 503, geen 401 en geen open deur');
  assert.equal(await d.kijk(t.ticket), null, 'de zekering ziet dan niets');
  await assert.rejects(d.geef('lid', A), /opslag hapert/, 'uitgifte zonder opslag faalt hard, er komt geen ticket');
  stuk = false;
  assert.deepEqual(await d.open('lid', t.ticket), { ok: true, token: A }, 'na herstel opent het onaangeroerde ticket precies een keer');
  assert.deepEqual(await d.open('lid', t.ticket), { status: 401 });

  sleutel = Buffer.alloc(31, 4);
  assert.deepEqual(await d.geef('lid', A), { status: 503, error: 'De stroom kan nu niet veilig worden geopend.' },
    'een sleutel van 31 bytes: liever geen stroom dan een sessie in leesbare vorm');
  assert.equal(opslag.data[COLLECTIE].lid, undefined, 'er bleef niets achter in de opslag');
  sleutel = 'k'.repeat(32);
  assert.equal((await d.geef('lid', A)).status, 503, 'een tekst is geen sleutel, ook niet met 32 tekens');
  sleutel = Buffer.alloc(32, 4);
  const u = await d.geef('lid', A);
  assert.deepEqual(await d.open('lid', u.ticket), { ok: true, token: A }, 'met de sleutel terug werkt alles weer');

  const zonder = maak({ db: { data: {} }, crypto, zegelSleutel: () => sleutel, productie: true });
  zonder.soort('lid', { geldig: () => true });
  await assert.rejects(zonder.geef('lid', A), /geen collectietransactie in productie/,
    'in productie nooit een stille eigen collectie naast de gedeelde opslag');
  assert.deepEqual(await zonder.open('lid', 'ST.' + 'A'.repeat(32)), { status: 503 });

  assert.throws(() => maak({ crypto: { createCipheriv: 'nee' }, zegelSleutel: () => sleutel }), /vereist node:crypto/);
  assert.throws(() => maak({ crypto, zegelSleutel: sleutel }), /vereist een zegelsleutel/);
});

test('9. een opslag vol rommel en misvormde invoer: dicht, en opgeruimd bij de volgende handeling', async () => {
  const w = dienst();
  const knoei = [
    o => { o.sessie = 'NIET-HEX'; },
    o => { o.sessie = null; },
    o => { o.zegel = 42; },
    o => { o.zegel = Buffer.alloc(28).toString('base64'); },
    o => { o.soort = 'kantoor'; }
  ];
  for (const [i, f] of knoei.entries()) {
    const t = await w.d.geef('lid', A);
    f(rijen(w, 'lid').at(-1).onderwerp);
    assert.deepEqual(await w.d.open('lid', t.ticket), { status: 401 }, 'knoeigeval ' + i);
  }
  const t = await w.d.geef('lid', A);
  rijen(w, 'lid').at(-1).onderwerp = null;
  assert.deepEqual(await w.d.open('lid', t.ticket), { status: 401 }, 'een rij zonder onderwerp opent niets');

  w.opslag.data[COLLECTIE].kantoor = 'geen lijst';
  w.opslag.data[COLLECTIE].video = { 0: 'ook geen lijst' };
  assert.deepEqual(await w.d.open('kantoor', 'ST.' + 'B'.repeat(32)), { status: 401 });
  assert.equal(w.opslag.data[COLLECTIE].kantoor, undefined, 'een rij die geen lijst is, wordt opgeruimd');
  assert.equal(w.opslag.data[COLLECTIE].video, undefined);

  for (const naam of ['__proto__', 'Lid', 'x', '-lid', 'lid.x', 'l'.repeat(32)]) {
    assert.throws(() => w.d.soort(naam, { geldig: () => true }), /ongeldige soortnaam/, naam);
  }
  assert.throws(() => w.d.soort('lid', { geldig: () => true }), /bestaat al/, 'een tweede registratie kan de deurcontrole niet vervangen');
  assert.throws(() => w.d.soort('zonder-deur', {}), /zonder geldig\(\)/);
  assert.throws(() => w.d.soort('zonder-spec'), /zonder geldig\(\)/);

  for (const raw of [null, undefined, '', '  ']) {
    assert.equal((await w.d.geef('lid', raw)).status, 401, 'geen sessie, geen ticket: ' + String(raw));
  }
  assert.deepEqual(await w.d.open(null, 'ST.' + 'A'.repeat(32)), { status: 401 });
  assert.deepEqual(await w.d.open('lid', null), { status: 401 });
  assert.deepEqual(await w.d.open('video', 'ST.' + 'A'.repeat(32), null), { status: 401 });

  let gooi = false;
  w.d.soort('grillig', { geldig: raw => { if (gooi) throw new Error('kluis weg'); return raw === A; } });
  const g = await w.d.geef('grillig', A);
  gooi = true;
  assert.deepEqual(await w.d.open('grillig', g.ticket), { status: 401 }, 'een deur die bij openen gooit is dicht');
  gooi = false;
  assert.deepEqual(await w.d.open('grillig', g.ticket), { status: 401 }, 'en het ticket is daarmee verbruikt');
});

test('10. buiten productie, zonder collectietransactie: een eigen collectie die dezelfde regels volgt', async () => {
  const db = { data: {} };
  const d = maak({ db, crypto, zegelSleutel: () => Buffer.alloc(32, 5), productie: false });
  d.soort('lid', { geldig: raw => raw === A });
  const t = await d.geef('lid', A);
  assert.equal(Array.isArray(db.data[COLLECTIE].lid), true);
  assert.ok(!JSON.stringify(db.data).includes(A), 'ook hier alleen hash en zegel');
  assert.deepEqual(await d.open('lid', t.ticket), { ok: true, token: A });
  assert.deepEqual(await d.open('lid', t.ticket), { status: 401 });
});
