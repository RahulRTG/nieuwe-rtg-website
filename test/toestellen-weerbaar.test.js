/* HET TOESTELREGISTER ACHTER HET BEZITSBEWIJS (server/kern/identiteit/toestellen.js).

   Wat deze module beschermt: het enige dat in deze laag `bewezen` mag heten,
   is bezit van een sleutel die het toestel niet kan verlaten. Een toestel
   wordt gebonden door een eenmalige uitdaging te tekenen; daarna levert dit
   register de publieke sleutel waarmee het bezitsbewijs elk zwaar verzoek
   controleert (publiekeSleutelVan is precies wat ./bezitsbewijs.js vraagt;
   een null daar is een 403 daar, zie test/bezitsbewijs-weerbaar.test.js).
   Hier wordt de registerkant nagespeeld met echte P-256-sleutels uit
   webcrypto: binden, intrekken, en wat een dief met een onderschepte
   uitdaging, handtekening of toestel-id kan.

   Wat hier niet mag sneuvelen:
   1. een uitdaging is voor EEN keer en voor EEN lid, en vervalt na twee
      minuten: een onderschepte handtekening is daarna niets waard;
   2. een binding vraagt een handtekening van DE sleutel die wordt
      aangeboden, over DE uitdaging van dit lid; een private sleutel of een
      andere kromme komt er niet in;
   3. intrekken werkt meteen door: de publieke sleutel waar het bezitsbewijs
      op leunt is weg, en een ingetrokken toestel bindt niet stilletjes
      opnieuw;
   4. een toestel is per lid: hetzelfde toestel bij een ander lid levert geen
      sleutel, geen naam en geen intrekking op;
   5. een naam is presentatie: stuurtekens gaan eruit, hij is begrensd, en
      een ingetrokken of onbekend toestel heeft er geen;
   6. het vangnet per lid laat de oudste wijken, nooit de zojuist gebonden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in pakUitdaging de regel `delete kast[String(lidKey)];   // een uitdaging
     is voor EEN keer` weggehaald
     -> "1. een uitdaging is voor een keer" ZAKT (RAAK).
   - in publiekeSleutelVan `r && !r.ingetrokkenOp ? r.jwk : null` vervangen
     door `r ? r.jwk : null`
     -> "3. intrekken werkt meteen door" ZAKT (RAAK).

   Draai: node --test test/toestellen-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { maakToestellen } = require('../server/kern/identiteit/toestellen');

async function sleutelpaar(curve = 'P-256') {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: curve }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  return { kp, jwk };
}
async function teken(kp, tekst) {
  const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: curveHash(kp) }, kp.privateKey, Buffer.from(tekst, 'utf8'));
  return Buffer.from(sig).toString('base64url');
}
const curveHash = (kp) => (kp.privateKey.algorithm.namedCurve === 'P-384' ? 'SHA-384' : 'SHA-256');

function opzet() {
  const db = { data: {} };
  let saves = 0;
  const t = maakToestellen({ db, save() { saves++; } });
  return { t, db, saves: () => saves };
}
async function bind(t, lid, paar, naam, opties) {
  const { nonce } = t.uitdaging(lid);
  return t.bind(lid, paar.jwk, await teken(paar.kp, nonce), naam, opties);
}

test('1. een uitdaging is voor een keer en voor een lid', async () => {
  const { t } = opzet();
  const paar = await sleutelpaar();
  assert.deepEqual(t.uitdaging(''), { error: 'Geen sessie.' });
  const { nonce, geldigMs } = t.uitdaging('user-1');
  assert.equal(geldigMs, 2 * 60 * 1000);
  assert.ok(nonce.length >= 32, 'de uitdaging is niet te raden');
  const sig = await teken(paar.kp, nonce);
  // Een ander lid kan de uitdaging van user-1 niet gebruiken.
  assert.match((await t.bind('user-2', paar.jwk, sig)).error, /uitdaging is verlopen/);
  const eerst = await t.bind('user-1', paar.jwk, sig, 'Laptop');
  assert.equal(eerst.ok, true);
  assert.equal(eerst.nieuw, true);
  // Dezelfde handtekening nog een keer: de uitdaging is op.
  assert.match((await t.bind('user-1', paar.jwk, sig)).error, /uitdaging is verlopen/);
  // Een nieuwe uitdaging vervangt de oude: een handtekening over de oude telt niet.
  const oud = t.uitdaging('user-1').nonce;
  t.uitdaging('user-1');
  assert.match((await t.bind('user-1', paar.jwk, await teken(paar.kp, oud))).error, /klopt niet/);
});

test('1b. een uitdaging vervalt na twee minuten, en verlopen uitdagingen worden opgeruimd', async () => {
  const { t, db } = opzet();
  const paar = await sleutelpaar();
  const echt = Date.now;
  const T = echt();
  try {
    Date.now = () => T;
    const { nonce } = t.uitdaging('user-1');
    t.uitdaging('user-9');
    Date.now = () => T + t.UITDAGING_MS + 1;
    assert.match((await t.bind('user-1', paar.jwk, await teken(paar.kp, nonce))).error, /verlopen/);
    assert.ok(!('user-1' in db.data.toesteluitdaging), 'een verlopen uitdaging is na gebruik weg');
    // Precies op de grens werkt hij nog.
    Date.now = () => T;
    const op = t.uitdaging('user-3').nonce;
    Date.now = () => T + t.UITDAGING_MS;
    assert.equal((await t.bind('user-3', paar.jwk, await teken(paar.kp, op))).ok, true);
    // Een nieuwe uitdaging van iemand anders ruimt de verlopen van user-9 op.
    Date.now = () => T + t.UITDAGING_MS + 1;
    t.uitdaging('user-4');
    assert.ok(!('user-9' in db.data.toesteluitdaging));
    // Een beschadigde regel in de kast wordt ook opgeruimd.
    db.data.toesteluitdaging.kapot = null;
    t.uitdaging('user-5');
    assert.ok(!('kapot' in db.data.toesteluitdaging));
  } finally { Date.now = echt; }
});

test('2. een binding vraagt een handtekening van de aangeboden sleutel over deze uitdaging', async () => {
  const { t, db } = opzet();
  const lid = await sleutelpaar(), dief = await sleutelpaar();
  // Een handtekening van een andere sleutel dan de aangeboden.
  let { nonce } = t.uitdaging('user-1');
  assert.match((await t.bind('user-1', lid.jwk, await teken(dief.kp, nonce))).error, /klopt niet/);
  // Rommel, leeg of te lang.
  for (const sig of ['', null, Buffer.alloc(300).toString('base64url')]) {
    t.uitdaging('user-1');
    assert.equal((await t.bind('user-1', lid.jwk, sig)).error, 'Onleesbare handtekening.');
  }
  // Een private sleutel, een andere kromme, een geen-sleutel of geen sessie komen er niet in.
  const privaat = await webcrypto.subtle.exportKey('jwk', lid.kp.privateKey);
  const p384 = await sleutelpaar('P-384');
  for (const jwk of [privaat, p384.jwk, null, 'tekst', { kty: 'RSA' }, Object.assign({}, lid.jwk, { x: 'x'.repeat(65) }), Object.assign({}, lid.jwk, { y: 5 })]) {
    t.uitdaging('user-1');
    assert.match((await t.bind('user-1', jwk, 'AAAA')).error, /P-256 publieke sleutel/, JSON.stringify(jwk && jwk.kty));
  }
  assert.deepEqual(await t.bind('', lid.jwk, 'AAAA'), { error: 'Geen sessie.' });
  assert.deepEqual(Object.keys(db.data.toestelregister || {}), [], 'niets van dit alles is opgeschreven');
  // De opgeslagen sleutel is alleen de publieke helft, ook als er extra velden meekwamen.
  ({ nonce } = t.uitdaging('user-1'));
  const r = await t.bind('user-1', Object.assign({}, lid.jwk, { kid: 'x', use: 'sig' }), await teken(lid.kp, nonce));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(t.publiekeSleutelVan('user-1', r.toestelId)).sort(), ['crv', 'ext', 'kty', 'x', 'y']);
  assert.match(r.toestelId, /^[a-f0-9]{32}$/);
  assert.equal(r.toestelId, t.idVan(lid.jwk), 'het id is afgeleid van de sleutel en niet te kiezen');
});

test('3. intrekken werkt meteen door: de sleutel voor het bezitsbewijs is weg', async () => {
  const { t } = opzet();
  const paar = await sleutelpaar();
  const { toestelId } = await bind(t, 'user-1', paar, 'Telefoon');
  assert.equal(t.publiekeSleutelVan('user-1', toestelId).x, paar.jwk.x);
  assert.deepEqual(t.trekIn('user-1', toestelId), { ok: true, toestelId });
  assert.equal(t.publiekeSleutelVan('user-1', toestelId), null, 'zonder sleutel weigert het bezitsbewijs (403)');
  assert.equal(t.naamVan('user-1', toestelId), null, 'een ingetrokken toestel heeft geen naam meer');
  assert.deepEqual(t.lijst('user-1'), [], 'en staat niet meer in het overzicht');
  assert.deepEqual(t.trekIn('user-1', toestelId), { error: 'Onbekend toestel.' }, 'twee keer intrekken is geen tweede succes');
  assert.deepEqual(t.noem('user-1', toestelId, 'Nieuw'), { error: 'Onbekend toestel.' });
  // Opnieuw binden van hetzelfde toestel gebeurt niet stil.
  const terug = await bind(t, 'user-1', paar, 'Telefoon');
  assert.equal(terug.ingetrokken, true);
  assert.equal(terug.toestelId, toestelId);
  assert.match(terug.error, /eerder ingetrokken/);
  assert.equal(t.publiekeSleutelVan('user-1', toestelId), null, 'en de sleutel komt niet terug');
});

test('4. een toestel is per lid: een ander lid krijgt geen sleutel, naam of intrekking', async () => {
  const { t } = opzet();
  const paar = await sleutelpaar();
  const { toestelId } = await bind(t, 'user-1', paar, 'Werklaptop');
  assert.equal(t.publiekeSleutelVan('user-2', toestelId), null);
  assert.equal(t.naamVan('user-2', toestelId), null);
  assert.deepEqual(t.trekIn('user-2', toestelId), { error: 'Onbekend toestel.' });
  assert.deepEqual(t.noem('user-2', toestelId, 'Van mij'), { error: 'Onbekend toestel.' });
  assert.deepEqual(t.lijst('user-2'), []);
  assert.equal(t.naamVan('user-1', toestelId), 'Werklaptop', 'het toestel van user-1 is onaangetast');
  // Ongeldige ids leveren niets op en raken niets.
  for (const id of [null, 'kort', 'A'.repeat(32), toestelId + '0']) {
    assert.equal(t.publiekeSleutelVan('user-1', id), null);
    assert.equal(t.naamVan('user-1', id), null);
    assert.deepEqual(t.trekIn('user-1', id), { error: 'Onbekend toestel.' });
    assert.deepEqual(t.noem('user-1', id, 'x'), { error: 'Onbekend toestel.' });
  }
});

test('4b. dezelfde sleutel opnieuw binden ververst het bewijsmoment en houdt de eerste binding en de naam', async () => {
  const { t, db } = opzet();
  const paar = await sleutelpaar();
  const eerst = await bind(t, 'user-1', paar, 'Laptop');
  const k = 'user-1|' + eerst.toestelId;
  db.data.toestelregister[k].laatstBewezenOp = '2026-01-01T00:00:00.000Z';
  const gebonden = db.data.toestelregister[k].gebondenOp;
  const weer = await bind(t, 'user-1', paar, '');
  assert.equal(weer.nieuw, false);
  assert.equal(weer.naam, 'Laptop', 'zonder nieuwe naam blijft de oude');
  assert.equal(db.data.toestelregister[k].gebondenOp, gebonden);
  assert.notEqual(db.data.toestelregister[k].laatstBewezenOp, '2026-01-01T00:00:00.000Z');
  assert.notEqual(weer.bindingId, eerst.bindingId, 'elke binding heeft een eigen bewijs-id');
  // Een binding zonder naam bij een nieuw toestel: naam null.
  const ander = await bind(t, 'user-1', await sleutelpaar());
  assert.equal(ander.naam, null);
});

test('4c. de route mag een binding weigeren voordat er iets is opgeschreven', async () => {
  const { t, db } = opzet();
  const paar = await sleutelpaar();
  let gezien = null;
  const r = await bind(t, 'user-1', paar, 'Laptop', { voor: (x) => { gezien = x; return { weiger: true, reden: 'sessie al gebonden' }; } });
  assert.equal(r.geweigerd, true);
  assert.equal(r.reden, 'sessie al gebonden');
  assert.equal(r.toestelId, gezien.toestelId);
  assert.match(gezien.bindingId, /^[a-f0-9]{32}$/);
  assert.deepEqual(db.data.toestelregister || {}, {}, 'niets opgeschreven');
  // Een voor-functie die niets teruggeeft, laat door.
  const ok = await bind(t, 'user-1', paar, 'Laptop', { voor: () => undefined });
  assert.equal(ok.ok, true);
});

test('5. een naam is presentatie: stuurtekens eruit, hoogstens 40 tekens, en leeg mag niet', async () => {
  const { t } = opzet();
  const paar = await sleutelpaar();
  const { toestelId } = await bind(t, 'user-1', paar, '  Mijn\u0000 tel\u001f\u007fefoon  ');
  assert.equal(t.naamVan('user-1', toestelId), 'Mijn telefoon');
  assert.deepEqual(t.noem('user-1', toestelId, 'x'.repeat(60)), { ok: true, naam: 'x'.repeat(40) });
  for (const leeg of ['', '   ', '\u0000\u0001', null, undefined]) {
    assert.match(t.noem('user-1', toestelId, leeg).error, /naam van maximaal 40/);
  }
  assert.equal(t.naamVan('user-1', toestelId), 'x'.repeat(40), 'een geweigerde naam verandert niets');
  assert.equal(t.noem('user-1', toestelId, 42).naam, '42');
});

test('6. het vangnet per lid laat de oudste wijken, nooit de zojuist gebonden', async () => {
  const { t, db } = opzet();
  const paren = [];
  for (let i = 0; i < t.MAX_PER_LID; i++) {
    const p = await sleutelpaar();
    const r = await bind(t, 'user-1', p, 'toestel ' + i);
    db.data.toestelregister['user-1|' + r.toestelId].laatstBewezenOp = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    paren.push(r.toestelId);
  }
  await bind(t, 'user-2', await sleutelpaar(), 'ander lid');
  assert.equal(t.lijst('user-1').length, t.MAX_PER_LID);
  const nieuwste = await bind(t, 'user-1', await sleutelpaar(), 'nieuwste');
  const ids = t.lijst('user-1').map(x => x.toestelId);
  assert.equal(ids.length, t.MAX_PER_LID);
  assert.equal(ids[0], nieuwste.toestelId, 'de nieuwste staat bovenaan');
  assert.ok(!ids.includes(paren[0]), 'de oudste is geweken');
  assert.ok(ids.includes(paren[1]));
  assert.equal(t.lijst('user-2').length, 1, 'een ander lid is niet geraakt');
  // Een rij zonder bewijsmoment telt als de oudste.
  delete db.data.toestelregister['user-1|' + paren[5]].laatstBewezenOp;
  await bind(t, 'user-1', await sleutelpaar(), 'nog een');
  assert.ok(!('user-1|' + paren[5] in db.data.toestelregister));
});
