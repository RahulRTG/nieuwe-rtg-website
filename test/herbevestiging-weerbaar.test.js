/* DE HERBEVESTIGING TEGEN EEN DIEF MET ALLEEN HET TOKEN
   (server/kern/identiteit/herbevestiging.js).

   Wat deze module beschermt: twee handelingen maken van een sessietoken iets
   blijvends -- een toestelsleutel aan de sessie binden en een nieuwe passkey
   registreren. Daarna tekent de houder zelf de bezitsbewijzen voor geld,
   wachtwoord en export. Wie alleen het TOKEN heeft (uit een logregel, een
   gedeelde computer), mag daarom geen van beide zonder iets wat alleen de mens
   heeft: zijn huidige wachtwoord of een verse vinger op een passkey die er al
   stond. Deze toetsen spelen die dief na.

   Aanvulling op test/herbevestiging-takken.test.js en test/herbevestiging-p1.test.js.

   Wat hier niet mag sneuvelen:
   1. zonder wachtwoord of ceremonie wordt er niets bevestigd -- ook niet met
      een leeg wachtwoord, een getal, een array, of een ceremonie zonder
      antwoord -- en de weigering zegt welke wegen er wel zijn;
   2. een passkeyceremonie telt alleen als hij BEWEZEN is: "ok" zonder bewijs,
      of een terugval naar een melding, is geen bevestiging; de poort wordt
      zonder terugval gevraagd, met deze actie en deze sessie;
   3. een fout wachtwoord telt per ACCOUNT (niet per IP), een goed wachtwoord
      wist alleen de teller van dit account, en een actieve rem antwoordt
      zelf zonder het wachtwoord na te kijken;
   4. een account zonder wachtwoord kan niet via de wachtwoordweg, en een
      wachtwoordcontrole die omvalt is een 503 die NIET als fout telt;
   5. het verse venster is tien minuten, onbekend of onleesbaar is niet vers,
      en een moment ver in de toekomst (scheve of vervalste klok) ook niet;
   6. wat het scherm terugkrijgt bevat de weigering en niet de interne velden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (r && r.ok && r.bewezen)` vervangen door `if (r && r.ok)`
     -> "2. een passkeyceremonie telt alleen als hij bewezen is" ZAKT (RAAK).
   - `if (t > nu + KLOKSPELING_MS) return false;` weggehaald
     -> "5. het verse venster" ZAKT (RAAK).

   Draai: node --test test/herbevestiging-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakHerbevestiging, versGeopend, VERSE_INLOG_MS } = require('../server/kern/identiteit/herbevestiging');

const LID = { id: 42, password_hash: 'hash:geheim' };

function opzet({ zwaar, rem = false, verify } = {}) {
  const telling = [];
  const gewist = [];
  const nagekeken = [];
  const accounts = {
    verifyPassword: verify || (async (pw, hash) => { nagekeken.push(pw); return hash === 'hash:' + pw; })
  };
  const h = maakHerbevestiging({
    accounts,
    zwaarVan: zwaar,
    tooManyTries: (res, emmer) => { if (rem) { res.status(429).json({ error: 'te vaak' }); return true; } return false; },
    noteFailedTry: (emmer, ip) => telling.push([emmer, ip]),
    loginFails: { delete: (emmer) => gewist.push(emmer) }
  });
  return { h, telling, gewist, nagekeken };
}
function res() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const req = (body, extra = {}) => Object.assign({ session: { account: LID }, body, ip: '203.0.113.9' }, extra);

test('1. zonder wachtwoord of ceremonie wordt er niets bevestigd, en de weigering wijst de weg', async () => {
  const { h, nagekeken, telling } = opzet();
  for (const body of [undefined, {}, { huidig: '' }, { huidig: 12345 }, { huidig: ['geheim'] }, { huidig: { toString: () => 'geheim' } },
    { ceremonie: 'c1' }, { antwoord: {} }]) {
    const r = await h.eis(req(body), res(), { actie: 'toestel-binden', wegen: ['wachtwoord', 'passkey'], omschrijving: 'Dit toestel binden' });
    assert.equal(r.ok, undefined, 'body ' + JSON.stringify(body) + ' mag niets bevestigen');
    assert.equal(r.status, 403);
    assert.equal(r.herbevestigingNodig, true);
    assert.deepEqual(r.wegen, ['wachtwoord', 'passkey']);
    assert.equal(r.actie, 'toestel-binden');
    assert.match(r.error, /^Dit toestel binden vraagt een bevestiging\. .*wachtwoord of met uw passkey/);
  }
  assert.deepEqual(nagekeken, [], 'er is geen wachtwoord nagekeken');
  assert.deepEqual(telling, [], 'en niets geteld als fout');
  // Geen account: geen handeling, wat er ook meekomt.
  for (const sessie of [undefined, {}, { account: null }]) {
    const r = await h.eis({ session: sessie, body: { huidig: 'geheim' } }, res(), { actie: 'x', wegen: ['wachtwoord'] });
    assert.deepEqual(r, { status: 403, error: 'Dit hoort bij een eigen RTG-account.' });
  }
});

test('1b. per wegenset de juiste zin en het juiste protocol; zonder wegen bevestigt niets', async () => {
  const { h } = opzet({ zwaar: { eis: async () => ({ ok: true, bewezen: true }), sessieSleutel: () => 's' } });
  const alleenPasskey = await h.eis(req({ huidig: 'geheim' }), res(), { actie: 'passkey-erbij', wegen: ['passkey'] });
  assert.deepEqual([alleenPasskey.status, alleenPasskey.bevestigingNodig], [401, true], 'alleen-passkey start de bestaande ceremonie');
  assert.equal(alleenPasskey.error, 'Bevestig eerst met een passkey die al op dit account staat.');
  const alleenWachtwoord = await h.eis(req({ ceremonie: 'c', antwoord: {} }), res(), { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(alleenWachtwoord.status, 403);
  assert.equal(alleenWachtwoord.bevestigingNodig, undefined);
  assert.equal(alleenWachtwoord.error, 'Bevestig eerst met uw huidige wachtwoord.', 'een ceremonie telt niet als de handeling hem niet aanneemt');
  // Zonder opgegeven wegen: geen enkele weg, dus ook een juist wachtwoord bevestigt niets.
  const geen = await h.eis(req({ huidig: 'geheim', ceremonie: 'c', antwoord: {} }), res(), { actie: 'x' });
  assert.equal(geen.ok, undefined);
  assert.deepEqual(geen.wegen, []);
});

test('2. een passkeyceremonie telt alleen als hij bewezen is, en wordt zonder terugval gevraagd', async () => {
  const gevraagd = [];
  let antwoord = { ok: true, bewezen: true };
  const zwaar = {
    eis: async (...a) => { gevraagd.push(a); return antwoord; },
    sessieSleutel: (r) => 'sessie:' + r.ip,
    heeftPasskey: () => true
  };
  const { h, nagekeken } = opzet({ zwaar: () => zwaar });
  const body = { ceremonie: 'c1', antwoord: { sig: 'x' }, huidig: 'fout-maar-ongebruikt' };
  const r = await h.eis(req(body), res(), { actie: 'toestel-binden', wegen: ['wachtwoord', 'passkey'], omschrijving: 'Binden' });
  assert.deepEqual(r, { ok: true, via: 'passkey' });
  assert.deepEqual(nagekeken, [], 'de vinger gaat voor: het wachtwoord wordt niet bekeken');
  const [u, actie, sessie, , omschrijving, opties] = gevraagd[0];
  assert.equal(u, LID);
  assert.equal(actie, 'toestel-binden', 'een ceremonie voor de ene handeling is niet inwisselbaar voor een andere');
  assert.equal(sessie, 'sessie:203.0.113.9');
  assert.equal(omschrijving, 'Binden');
  assert.deepEqual(opties, { zonderTerugval: true });

  for (const [a, fout] of [
    [{ ok: true }, 'De passkey kon niet worden bevestigd.'],                              // ok zonder bewijs: een terugval
    [{ ok: true, bewezen: false, melding: true }, 'De passkey kon niet worden bevestigd.'],
    [{ ok: false, error: 'Ceremonie verlopen.' }, 'Ceremonie verlopen.'],
    [null, 'De passkey kon niet worden bevestigd.'],
    [undefined, 'De passkey kon niet worden bevestigd.']
  ]) {
    antwoord = a;
    const w = await h.eis(req(body), res(), { actie: 'toestel-binden', wegen: ['passkey', 'wachtwoord'] });
    assert.deepEqual(w, { status: 401, error: fout }, 'antwoord ' + JSON.stringify(a));
  }
  assert.deepEqual(nagekeken, [], 'een mislukte ceremonie valt NIET terug op het meegestuurde wachtwoord');
});

test('2b. zonder zware poort is er geen passkeyweg (503), en heeftPasskey zegt nee', async () => {
  for (const zwaar of [undefined, null, () => null]) {
    const { h } = opzet({ zwaar });
    const r = await h.eis(req({ ceremonie: 'c', antwoord: {} }), res(), { actie: 'x', wegen: ['passkey'] });
    assert.deepEqual(r, { status: 503, error: 'De passkeybevestiging is hier niet beschikbaar.' });
    assert.equal(h.heeftPasskey(LID), false);
  }
  assert.equal(opzet({ zwaar: { heeftPasskey: 'ja' } }).h.heeftPasskey(LID), false, 'geen functie is geen ja');
  assert.equal(opzet({ zwaar: { heeftPasskey: (u) => u.id === 42 } }).h.heeftPasskey(LID), true);
  assert.equal(opzet({ zwaar: () => ({ heeftPasskey: () => 1 }) }).h.heeftPasskey(LID), true, 'het antwoord wordt een boolean');
});

test('3. een fout wachtwoord telt per account; een goed wachtwoord wist alleen die teller', async () => {
  const { h, telling, gewist } = opzet();
  const fout = await h.eis(req({ huidig: 'raden' }), res(), { actie: 'passkey-erbij', wegen: ['wachtwoord'] });
  assert.deepEqual([fout.status, fout.error, fout.herbevestigingNodig], [403, 'Het wachtwoord klopt niet.', true]);
  assert.deepEqual(fout.wegen, ['wachtwoord']);
  assert.equal(fout.actie, 'passkey-erbij');
  await h.eis(req({ huidig: 'nogmaals' }, { ip: '198.51.100.1' }), res(), { actie: 'x', wegen: ['wachtwoord'] });
  assert.deepEqual(telling, [['herbevestig:42', '203.0.113.9'], ['herbevestig:42', '198.51.100.1']],
    'beide pogingen tellen op dezelfde emmer, vanaf welk adres ook');
  assert.deepEqual(gewist, []);
  assert.deepEqual(await h.eis(req({ huidig: 'geheim' }), res(), { actie: 'x', wegen: ['wachtwoord'] }), { ok: true, via: 'wachtwoord' });
  assert.deepEqual(gewist, ['herbevestig:42']);
});

test('3b. een actieve rem antwoordt zelf, zonder het wachtwoord na te kijken', async () => {
  const { h, nagekeken, telling } = opzet({ rem: true });
  const r = res();
  assert.deepEqual(await h.eis(req({ huidig: 'geheim' }), r, { actie: 'x', wegen: ['wachtwoord'] }), { verstuurd: true });
  assert.equal(r.code, 429);
  assert.deepEqual(nagekeken, [], 'ook een juist wachtwoord wordt niet bekeken: anders is de rem een orakel');
  assert.deepEqual(telling, []);
});

test('4. geen wachtwoord op het account, of een controle die omvalt: geen bevestiging, en geen fout geteld', async () => {
  const { h, telling } = opzet();
  const zonder = await h.eis({ session: { account: { id: 7, password_hash: null } }, body: { huidig: 'iets' }, ip: '1' }, res(), { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(zonder.status, 403);
  assert.equal(zonder.error, 'Het wachtwoord klopt niet.');
  assert.deepEqual(telling, [['herbevestig:7', '1']]);

  const kapot = opzet({ verify: async () => { throw new Error('bcrypt weg'); } });
  const r = await kapot.h.eis(req({ huidig: 'geheim' }), res(), { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(r.status, 503);
  assert.match(r.error, /niets uitgevoerd/);
  assert.deepEqual(kapot.telling, [], 'een storing is geen fout wachtwoord van de mens');
  assert.deepEqual(kapot.gewist, []);
  // Een controle die iets anders dan true teruggeeft, is geen ja.
  const vaag = opzet({ verify: async () => 'ja' });
  assert.deepEqual(await vaag.h.eis(req({ huidig: 'geheim' }), res(), { actie: 'x', wegen: ['wachtwoord'] }), { ok: true, via: 'wachtwoord' },
    'een truthy antwoord telt als ja (de echte verifyPassword geeft een boolean)');
  const nee = opzet({ verify: async () => 0 });
  assert.equal((await nee.h.eis(req({ huidig: 'geheim' }), res(), { actie: 'x', wegen: ['wachtwoord'] })).status, 403);
  // Zonder rem, teller of wisser werkt de weg ook, en zonder delete-functie wordt er niets gewist.
  const kaal = maakHerbevestiging({ accounts: { verifyPassword: async () => true }, loginFails: {} });
  assert.deepEqual(await kaal.eis(req({ huidig: 'x' }), res(), { actie: 'x', wegen: ['wachtwoord'] }), { ok: true, via: 'wachtwoord' });
  const kaalFout = maakHerbevestiging({ accounts: { verifyPassword: async () => false } });
  assert.equal((await kaalFout.eis(req({ huidig: 'x' }), res(), { actie: 'x', wegen: ['wachtwoord'] })).status, 403);
});

test('5. het verse venster: tien minuten, onbekend is niet vers, de toekomst ook niet', () => {
  const nu = Date.UTC(2026, 9, 14, 12, 0, 0);
  const iso = (ms) => new Date(ms).toISOString();
  assert.equal(VERSE_INLOG_MS, 10 * 60 * 1000);
  assert.equal(versGeopend(iso(nu), nu), true);
  assert.equal(versGeopend(iso(nu - VERSE_INLOG_MS), nu), true, 'precies op de grens');
  assert.equal(versGeopend(iso(nu - VERSE_INLOG_MS - 1), nu), false);
  assert.equal(versGeopend(iso(nu + 60 * 1000), nu), true, 'een minuut klokspeling mag');
  assert.equal(versGeopend(iso(nu + 60 * 1000 + 1), nu), false, 'een sessie uit de toekomst veroudert nooit en is dus niet vers');
  assert.equal(versGeopend(iso(nu + 365 * 24 * 3600 * 1000), nu), false);
  for (const onbekend of [undefined, null, '', 'gisteren', 0, -5, NaN]) assert.equal(versGeopend(onbekend, nu), false, String(onbekend));
  assert.equal(versGeopend(nu - 1000, nu), true, 'een getal als moment werkt ook');
  const h = opzet().h;
  assert.equal(h.versGeopend, versGeopend);
  assert.equal(versGeopend(new Date().toISOString()), true, 'zonder meegegeven moment telt de klok');
});

test('6. wat het scherm krijgt: de status en de weigering, zonder interne velden', () => {
  const { h } = opzet();
  const r = res();
  h.stuur(r, { status: 401, ok: false, via: 'x', verstuurd: false, error: 'nee', wegen: ['passkey'], bevestigingNodig: true });
  assert.equal(r.code, 401);
  assert.deepEqual(r.body, { error: 'nee', wegen: ['passkey'], bevestigingNodig: true });
  const s = res();
  h.stuur(s, { error: 'zonder status' });
  assert.equal(s.code, 403, 'zonder status is het een weigering, nooit een 200');
});
