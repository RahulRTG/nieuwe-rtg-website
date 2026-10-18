/* EEN INGETROKKEN TOESTEL BLIJFT INGETROKKEN (kern/identiteit/toestelgrens.js,
   eigenaarsbesluit van 14 oktober 2026 bij WEERBAARHEID.md).

   Het register houdt per lid hoogstens 25 actieve bindingen bij. Dat vangnet
   liet vroeger ook INGETROKKEN toestellen wijken: wie de oude private sleutel
   nog had en 25 nieuwere bindingen maakte, kon daarna dat ingetrokken toestel
   stil opnieuw binden. Een intrekking is bewijs; ze hoort niet aan een
   opruimbeurt te hangen.

   Wat hier niet mag sneuvelen:
   1. een aanvaller met de oude private sleutel en meer dan 25 nieuwe bindingen
      krijgt het ingetrokken toestel niet terug;
   2. het maximum van 25 begrenst nog steeds de ACTIEVE bindingen;
   3. bij te veel intrekkingen sluit de grens dicht: geen nieuw toestel, en
      geen enkele intrekking verdwijnt; een bestaand toestel blijft werken;
   4. de intrekkingen van een ander lid tellen niet mee.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in toestelgrens.ruimActief `&& !r.ingetrokkenOp` weggehaald
     -> "1. een oude sleutel" ZAKT (RAAK)
   - in toestellen.bind de controle op intrekkingenVol weggehaald
     -> "3. te veel intrekkingen" ZAKT (RAAK)

   Draai: node --test test/toestelintrekking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('crypto');
const { maakToestellen } = require('../server/kern/identiteit/toestellen');
const grens = require('../server/kern/identiteit/toestelgrens');

function reg() {
  const db = { data: {} };
  return { t: maakToestellen({ db, save() {} }), db };
}
async function paar() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const teken = async (n) => Buffer.from(await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(String(n), 'utf8'))).toString('base64url');
  return { jwk, teken };
}
async function bind(t, lid, k, naam) {
  const u = t.uitdaging(lid);
  return t.bind(lid, k.jwk, await k.teken(u.nonce), naam);
}
/* De opgeslagen rijen, zoals de opslag ze ziet (kern/eigencollectie.js). */
const rijen = (db) => db.data.toestelregister;

test('1. een oude sleutel komt niet terug, ook niet na meer dan 25 nieuwe bindingen', async () => {
  const { t } = reg();
  const oud = await paar();
  const eerste = await bind(t, 'user-1', oud, 'Gestolen laptop');
  assert.equal(eerste.ok, true);
  assert.equal(t.trekIn('user-1', eerste.toestelId).ok, true);

  /* De aanvaller heeft de private sleutel en een sessie, en maakt er dertig bij. */
  for (let i = 0; i < 30; i++) assert.equal((await bind(t, 'user-1', await paar(), 'nieuw ' + i)).ok, true);

  const terug = await bind(t, 'user-1', oud, 'Gestolen laptop');
  assert.equal(terug.ok, undefined, 'het ingetrokken toestel bindt niet stil opnieuw');
  assert.equal(terug.ingetrokken, true);
  assert.equal(terug.toestelId, eerste.toestelId);
  assert.equal(t.publiekeSleutelVan('user-1', eerste.toestelId), null, 'en een bezitsbewijs ermee faalt');
});

test('2. het maximum begrenst nog steeds de actieve bindingen', async () => {
  const { t } = reg();
  const sleutels = [];
  for (let i = 0; i < grens.MAX_ACTIEF + 5; i++) {
    const k = await paar();
    sleutels.push((await bind(t, 'user-1', k, 'toestel ' + i)).toestelId);
  }
  assert.equal(t.lijst('user-1').length, grens.MAX_ACTIEF, 'niet meer dan 25 actief');
  assert.equal(t.MAX_PER_LID, grens.MAX_ACTIEF);
  assert.equal(t.publiekeSleutelVan('user-1', sleutels[sleutels.length - 1]) !== null, true, 'de nieuwste staat er');
});

test('3. te veel intrekkingen: de grens sluit dicht en gooit niets weg', async () => {
  const { t, db } = reg();
  const blijft = await paar();
  const actief = await bind(t, 'user-1', blijft, 'Telefoon');
  assert.equal(actief.ok, true);
  /* Zoveel intrekkingen als de grens toestaat, rechtstreeks in de opslag. */
  const bak = rijen(db);
  for (let i = 0; i < grens.MAX_INGETROKKEN; i++) {
    const id = i.toString(16).padStart(32, '0');
    bak['user-1|' + id] = { lidKey: 'user-1', toestelId: id, ingetrokkenOp: '2026-10-01T00:00:00.000Z', laatstBewezenOp: '2026-01-01T00:00:00.000Z' };
  }
  const nieuw = await bind(t, 'user-1', await paar(), 'Nog een');
  assert.equal(nieuw.ok, undefined, 'geen nieuw toestel');
  assert.equal(nieuw.vol, true);
  assert.equal(Object.values(bak).filter(r => r.ingetrokkenOp).length, grens.MAX_INGETROKKEN, 'en geen enkele intrekking is verdwenen');
  const opnieuw = await bind(t, 'user-1', blijft, 'Telefoon');
  assert.equal(opnieuw.ok, true, 'een bestaand toestel bewijst zich gewoon opnieuw');
  assert.equal(opnieuw.nieuw, false);
});

test('4. de intrekkingen van een ander lid tellen niet mee', async () => {
  const { t, db } = reg();
  await bind(t, 'user-1', await paar(), 'eerst');
  const bak = rijen(db);
  for (let i = 0; i < grens.MAX_INGETROKKEN; i++) {
    const id = i.toString(16).padStart(32, '0');
    bak['user-2|' + id] = { lidKey: 'user-2', toestelId: id, ingetrokkenOp: '2026-10-01T00:00:00.000Z' };
  }
  assert.equal((await bind(t, 'user-1', await paar(), 'tweede')).ok, true, 'user-1 bindt gewoon');
  assert.equal(grens.intrekkingenVol(bak, 'user-2'), true);
  assert.equal(grens.intrekkingenVol(bak, 'user-1'), false);
});
