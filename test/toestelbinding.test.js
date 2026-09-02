/* ============================================================================
   MIJN RTG blok 3 -- toestelbinding.

   DE BEWERING DIE ERTOE DOET staat in toets 1: alleen bezit van een sleutel die
   het toestel niet kan verlaten verdient `bewezen`. Alles daaronder -- een
   cookie, een opgeslagen id, een browservingerafdruk -- HERKENT een toestel en
   bewijst er niets over. Wie daarop `bewezen` schrijft, heeft de bewijsladder
   van BESTUUR.md tot een sierlijst gemaakt.

   En toets 6, die structureel is en niet gedragsmatig: een toestelsleutel mag
   nooit een inlog worden. Zou hij dat wel kunnen, dan is er een wachtwoordloze
   toegang ontstaan waarbij nooit een mens is gecontroleerd -- wie de laptop
   openklapt, is dan binnen.

   Draai los: node --test test/toestelbinding.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { maakToestellen } = require('../server/kern/identiteit/toestellen');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');

const reg = () => maakToestellen({ db: { data: {} }, save() {} });
async function paar() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const teken = async (n) => Buffer.from(await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(String(n), 'utf8'))).toString('base64url');
  return { jwk, teken };
}

test('1. alleen een geldige handtekening bindt; een verzonnen handtekening niet', async () => {
  const t = reg(), k = await paar();
  const u = t.uitdaging('user-1');
  const goed = await t.bind('user-1', k.jwk, await k.teken(u.nonce), 'MacBook');
  assert.equal(goed.ok, true);
  assert.match(goed.toestelId, /^[a-f0-9]{32}$/);

  const u2 = t.uitdaging('user-1');
  const fout = await t.bind('user-1', k.jwk, Buffer.from('niets').toString('base64url'));
  assert.ok(fout.error, 'een willekeurige reeks bytes hoort geen toestel te binden');
  assert.equal(fout.ok, undefined);
});

test('1b. een handtekening over een ANDERE uitdaging telt niet', async () => {
  const t = reg(), k = await paar();
  t.uitdaging('user-1');
  const vanIetsAnders = await k.teken('een andere tekst');
  const r = await t.bind('user-1', k.jwk, vanIetsAnders);
  assert.ok(r.error, 'anders tekent een toestel iets dat hij zelf koos');
});

/* DEZE TOETS WAS EERST FOUT, en de mutatieproef vond dat. Hij vroeg tussendoor
   een NIEUWE uitdaging aan en zag de tweede poging dus stranden op "andere
   nonce" in plaats van op "al verbruikt". Daarmee bleef hij groen terwijl het
   verbruiken was weggehaald -- hij mat de verkeerde reden.

   Het echte hergebruik is: teken een uitdaging, bind, en stuur daarna DEZELFDE
   handtekening nog eens, zonder iets nieuws te vragen. Wordt de uitdaging niet
   verbruikt, dan slaagt die tweede -- en dan is een onderschepte handtekening
   onbeperkt herbruikbaar. */
test('2. een uitdaging is voor EEN keer: dezelfde handtekening lukt geen tweede keer', async () => {
  const t = reg(), k = await paar();
  const u = t.uitdaging('user-1');
  const hand = await k.teken(u.nonce);
  assert.equal((await t.bind('user-1', k.jwk, hand)).ok, true);
  const her = await t.bind('user-1', k.jwk, hand);   // geen nieuwe uitdaging gevraagd
  assert.ok(her.error, 'een onderschepte handtekening hoort niet opnieuw bruikbaar te zijn');
  assert.match(her.error, /verlopen/, 'en hij hoort af te ketsen op de VERBRUIKTE uitdaging');
});

/* De houdbaarheid zelf is de tweede helft van dezelfde bescherming: hoe langer
   een uitdaging leeft, hoe groter het venster waarin een onderschepte
   handtekening bruikbaar is. Twee minuten dekt de reis naar de browser en terug
   ruim; wie hem oprekt naar een uur, moet dat hier verantwoorden. */
test('2b. een uitdaging leeft kort', () => {
  const t = reg();
  assert.ok(t.UITDAGING_MS > 0 && t.UITDAGING_MS <= 5 * 60 * 1000,
    'een uitdaging die lang leeft is een venster waarin een onderschepte handtekening bruikbaar blijft');
});

test('3. een PRIVATE sleutel komt er nooit in', async () => {
  const t = reg();
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await webcrypto.subtle.exportKey('jwk', kp.privateKey);
  assert.ok(priv.d, 'de toets zelf moet wel een private sleutel aanbieden');
  t.uitdaging('user-1');
  const r = await t.bind('user-1', priv, 'AAAA');
  assert.ok(r.error);
});

test('4. een toestel kan zijn eigen id niet kiezen', async () => {
  const t = reg(), k = await paar();
  const uitSleutel = t.idVan(k.jwk);
  const u = t.uitdaging('user-1');
  const r = await t.bind('user-1', Object.assign({}, k.jwk, { kid: 'ik-kies-zelf' }), await k.teken(u.nonce));
  assert.equal(r.toestelId, uitSleutel, 'de id is een afgeleide van de sleutel, geen meegestuurd veld');
});

test('5. de naam is van EEN lid: een ander ziet hem niet', async () => {
  const t = reg(), k = await paar();
  const u = t.uitdaging('user-1');
  const r = await t.bind('user-1', k.jwk, await k.teken(u.nonce), 'MacBook van Rahul');
  assert.equal(t.naamVan('user-1', r.toestelId), 'MacBook van Rahul');
  assert.equal(t.naamVan('user-9', r.toestelId), null, 'hetzelfde toestel bij een ander lid is een andere rij');
  assert.equal(t.lijst('user-9').length, 0);
});

/* ---------------------------------------------------------------------------
   6. DE STRUCTURELE PROEF. Niet "wij hebben geen inlogroute gebouwd" maar: deze
   module KAN er geen worden, want zij kent geen gebruikers. Zodra iemand hier
   een account opzoekt, is een toestelsleutel een inlogmiddel geworden.
   ------------------------------------------------------------------------- */
test('6. een toestelsleutel is geen inlog: de module raakt geen accounts aan', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'identiteit', 'toestellen.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const verboden of ['accounts', 'issueToken', 'getUserById', 'verifyToken', 'rememberSession', 'sessieregister']) {
    assert.equal(code.includes(verboden), false,
      'kern/identiteit/toestellen.js noemt "' + verboden + '"; een toestelsleutel mag een sessie BINDEN en er nooit een openen');
  }
  const t = reg();
  for (const naam of Object.keys(t)) {
    assert.doesNotMatch(String(naam), /login|inlog|token|account/i, 'de module hoort geen inlogachtige uitgang te hebben');
  }
});

test('6b. de browsersleutel is niet exporteerbaar, en dat is de hele grond', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'toestelsleutel.js'), 'utf8');
  assert.match(bron, /generateKey\(\{ name: 'ECDSA', namedCurve: 'P-256' \}, false,/,
    'met true is de sleutel te exporteren en bewijst een handtekening niets meer over DIT toestel');
});

test('7. een ingetrokken toestel komt niet stilletjes terug', async () => {
  const t = reg(), k = await paar();
  const u = t.uitdaging('user-1');
  const r = await t.bind('user-1', k.jwk, await k.teken(u.nonce), 'Oude telefoon');
  t.trekIn('user-1', r.toestelId);
  assert.equal(t.naamVan('user-1', r.toestelId), null);
  const u2 = t.uitdaging('user-1');
  const weer = await t.bind('user-1', k.jwk, await k.teken(u2.nonce));
  assert.ok(weer.error, 'opnieuw binden zou een bewuste handeling van het lid ongedaan maken zonder dat iemand het ziet');
  assert.equal(weer.ingetrokken, true);
});

test('8. de binding landt als BEWEZEN in de sessie, en kan niet stil verzwakken', async () => {
  const sr = maakSessieregister({ db: { data: {} }, save() {} });
  const nu = new Date().toISOString();
  sr.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'wachtwoord',
    herkomst: { bron: 't', methode: 'gemeten', vastgesteldOp: nu, regelversie: 'v1' } } });
  sr.vul('aaaaaaaaaaaa', { toestel: { toestelId: 'a'.repeat(32), bindingId: 'b'.repeat(32), bindingStand: 'bevestigd',
    herkomst: { bron: 'toestelsleutel', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'blok3' } } });
  assert.equal(sr.vanLid('user-1')[0].stand.toestel.graad, 'bewezen');
  assert.equal(sr.vanLid('user-1')[0].toestelId, 'a'.repeat(32));

  const zwak = sr.vul('aaaaaaaaaaaa', { toestel: { toestelId: 'c'.repeat(32), bindingStand: 'vermoed',
    herkomst: { bron: 'gok', methode: 'afgeleid', vastgesteldOp: nu, regelversie: 'v1' } } });
  assert.ok(zwak.geweigerd.some(g => /verzwakken/.test(g.reden)));
  assert.equal(sr.vanLid('user-1')[0].stand.toestel.graad, 'bewezen');
});

test('9. de sessie draagt de toestelId maar NOOIT de naam', async () => {
  const sr = maakSessieregister({ db: { data: {} }, save() {} });
  const nu = new Date().toISOString();
  sr.open('aaaaaaaaaaaa', 'user-1', { toestel: { toestelId: 'a'.repeat(32), toestelnaam: 'MacBook van Rahul',
    herkomst: { bron: 'toestelsleutel', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'blok3' } } });
  const rauw = JSON.stringify(sr.lees('aaaaaaaaaaaa'));
  assert.equal(rauw.includes('MacBook'), false,
    'een naam in de sessie repliceert over de bus naar andere processen; hij hoort in het toestelregister');
});
