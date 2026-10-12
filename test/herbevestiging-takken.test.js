/* HERBEVESTIGING TAK VOOR TAK (server/kern/identiteit/herbevestiging.js).

   Toetst de beslissing zelf met nagemaakte accounts, zware poort en rem:
   zonder eigen account geen handeling; een meegestuurde passkeyceremonie gaat
   voor het wachtwoord en telt alleen als hij echt bewezen is (en nooit via de
   terugval); een wachtwoordcontrole die niet kan draaien is een 503 en geen
   fout wachtwoord; een fout wachtwoord telt per account; en zonder bewijs
   volgt een weigering die zegt welke wegen er zijn, in het protocol dat de
   schermhulp verwacht. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakHerbevestiging, versGeopend, VERSE_INLOG_MS } = require('../server/kern/identiteit/herbevestiging');

const LID = { id: 'acc-1', password_hash: 'hash-van-geheim' };

function wereld({ zwaar, verify, rem = false } = {}) {
  const log = { pogingen: [], gewist: [], remVragen: [] };
  const accounts = { verifyPassword: verify || (async (pw, h) => pw === 'geheim' && h === 'hash-van-geheim') };
  const loginFails = { delete: k => log.gewist.push(k) };
  const h = maakHerbevestiging({ accounts, zwaarVan: zwaar,
    tooManyTries: (res, k) => { log.remVragen.push(k); return rem; },
    noteFailedTry: (k, ip) => log.pogingen.push([k, ip]), loginFails });
  return { h, log };
}
const verzoek = (body, account = LID) => ({ session: account ? { account } : null, body, ip: '203.0.113.5' });

test('versGeopend: de randen van het verse venster', () => {
  const nu = Date.parse('2026-10-12T12:00:00.000Z');
  assert.equal(versGeopend(nu - VERSE_INLOG_MS, nu), true, 'precies tien minuten is nog vers');
  assert.equal(versGeopend(nu - VERSE_INLOG_MS - 1, nu), false);
  assert.equal(versGeopend(nu + 60 * 1000, nu), true, 'een minuut klokspeling mag');
  assert.equal(versGeopend(nu + 60 * 1000 + 1, nu), false);
  assert.equal(versGeopend(0, nu), false, 'het begin van de jaartelling is geen herkomst');
  assert.equal(versGeopend(new Date().toISOString()), true, 'zonder nu: de klok van het huis');
});

test('eis: zonder eigen account geen handeling', async () => {
  const { h } = wereld();
  assert.deepEqual(await h.eis(verzoek({}, null), {}, { actie: 'x', wegen: ['wachtwoord'] }),
    { status: 403, error: 'Dit hoort bij een eigen RTG-account.' });
  assert.equal((await h.eis({ session: {} }, {}, { actie: 'x', wegen: ['wachtwoord'] })).status, 403);
});

test('eis: een goed wachtwoord bevestigt en wist de rem van dit account', async () => {
  const { h, log } = wereld();
  assert.deepEqual(await h.eis(verzoek({ huidig: 'geheim' }), {}, { actie: 'toestel', wegen: ['wachtwoord'] }),
    { ok: true, via: 'wachtwoord' });
  assert.deepEqual(log.remVragen, ['herbevestig:acc-1']);
  assert.deepEqual(log.gewist, ['herbevestig:acc-1']);
  assert.deepEqual(log.pogingen, []);
});

test('eis: een fout wachtwoord telt per account en zegt welke wegen er zijn', async () => {
  const { h, log } = wereld();
  const r = await h.eis(verzoek({ huidig: 'raden' }), {}, { actie: 'passkey-erbij', wegen: ['wachtwoord', 'passkey'] });
  assert.deepEqual(r, { status: 403, error: 'Het wachtwoord klopt niet.', herbevestigingNodig: true,
    wegen: ['wachtwoord', 'passkey'], actie: 'passkey-erbij' });
  assert.deepEqual(log.pogingen, [['herbevestig:acc-1', '203.0.113.5']]);
  assert.deepEqual(log.gewist, []);
  /* Een account zonder wachtwoordhash kan niet met een wachtwoord bevestigen. */
  const zonder = await h.eis(verzoek({ huidig: 'geheim' }, { id: 'acc-2' }), {}, { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(zonder.status, 403);
  assert.equal(zonder.error, 'Het wachtwoord klopt niet.');
});

test('eis: een actieve rem antwoordt zelf, en er wordt niets nagekeken', async () => {
  let gekeken = false;
  const { h } = wereld({ rem: true, verify: async () => { gekeken = true; return true; } });
  assert.deepEqual(await h.eis(verzoek({ huidig: 'geheim' }), {}, { actie: 'x', wegen: ['wachtwoord'] }), { verstuurd: true });
  assert.equal(gekeken, false);
});

test('eis: een wachtwoordcontrole die niet kan draaien is een 503, geen fout wachtwoord', async () => {
  const { h, log } = wereld({ verify: async () => { throw new Error('bcrypt weg'); } });
  const r = await h.eis(verzoek({ huidig: 'geheim' }), {}, { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(r.status, 503);
  assert.match(r.error, /er is niets uitgevoerd/);
  assert.deepEqual(log.pogingen, [], 'de rem telt niet voor iets wat de mens niet deed');
});

test('eis: zonder rem- en tellerhaken werkt de wachtwoordweg ook', async () => {
  const h = maakHerbevestiging({ accounts: { verifyPassword: async pw => pw === 'geheim' } });
  assert.deepEqual(await h.eis(verzoek({ huidig: 'geheim' }), {}, { actie: 'x', wegen: ['wachtwoord'] }), { ok: true, via: 'wachtwoord' });
  assert.equal((await h.eis(verzoek({ huidig: 'fout' }), {}, { actie: 'x', wegen: ['wachtwoord'] })).status, 403);
  const metRaar = maakHerbevestiging({ accounts: { verifyPassword: async () => true }, loginFails: {} });
  assert.deepEqual(await metRaar.eis(verzoek({ huidig: 'x' }), {}, { actie: 'x', wegen: ['wachtwoord'] }), { ok: true, via: 'wachtwoord' });
});

test('eis: een bewezen passkeyceremonie gaat voor het wachtwoord, zonder terugval', async () => {
  const gezien = [];
  const zwaar = { sessieSleutel: req => 'sk-' + req.ip,
    eis: async (...a) => { gezien.push(a); return { ok: true, bewezen: true }; } };
  const { h } = wereld({ zwaar: () => zwaar });
  const req = verzoek({ ceremonie: 'c1', antwoord: 'a1', huidig: 'fout' });
  assert.deepEqual(await h.eis(req, {}, { actie: 'toestel', wegen: ['wachtwoord', 'passkey'], omschrijving: 'Toestel binden' }),
    { ok: true, via: 'passkey' });
  assert.equal(gezien.length, 1);
  const [u, actie, sleutel, r2, oms, opties] = gezien[0];
  assert.equal(u, LID); assert.equal(actie, 'toestel'); assert.equal(sleutel, 'sk-203.0.113.5');
  assert.equal(r2, req); assert.equal(oms, 'Toestel binden'); assert.deepEqual(opties, { zonderTerugval: true });
});

test('eis: een passkey die niet bewezen is, of een poort die er niet is, bevestigt niets', async () => {
  const metFout = wereld({ zwaar: { sessieSleutel: () => 's', eis: async () => ({ ok: false, error: 'Ceremonie verlopen.' }) } });
  assert.deepEqual(await metFout.h.eis(verzoek({ ceremonie: 'c', antwoord: 'a' }), {}, { actie: 'x', wegen: ['passkey'] }),
    { status: 401, error: 'Ceremonie verlopen.' });
  const terugval = wereld({ zwaar: { sessieSleutel: () => 's', eis: async () => ({ ok: true }) } });
  assert.deepEqual(await terugval.h.eis(verzoek({ ceremonie: 'c', antwoord: 'a' }), {}, { actie: 'x', wegen: ['passkey'] }),
    { status: 401, error: 'De passkey kon niet worden bevestigd.' }, 'ok zonder bewezen is de terugval, en die telt hier niet');
  const leeg = wereld({ zwaar: { sessieSleutel: () => 's', eis: async () => null } });
  assert.equal((await leeg.h.eis(verzoek({ ceremonie: 'c', antwoord: 'a' }), {}, { actie: 'x', wegen: ['passkey'] })).error,
    'De passkey kon niet worden bevestigd.');
  const geen = wereld({ zwaar: () => null });
  assert.deepEqual(await geen.h.eis(verzoek({ ceremonie: 'c', antwoord: 'a' }), {}, { actie: 'x', wegen: ['passkey'] }),
    { status: 503, error: 'De passkeybevestiging is hier niet beschikbaar.' });
});

test('eis: een ceremonie telt niet als deze handeling geen passkey aanneemt', async () => {
  let gevraagd = false;
  const { h } = wereld({ zwaar: { sessieSleutel: () => 's', eis: async () => { gevraagd = true; return { ok: true, bewezen: true }; } } });
  const r = await h.eis(verzoek({ ceremonie: 'c', antwoord: 'a' }), {}, { actie: 'x', wegen: ['wachtwoord'] });
  assert.equal(gevraagd, false);
  assert.equal(r.status, 403);
  /* En een halve ceremonie (zonder antwoord) is ook geen ceremonie. */
  const half = await h.eis(verzoek({ ceremonie: 'c' }), {}, { actie: 'x', wegen: ['passkey'] });
  assert.equal(gevraagd, false);
  assert.equal(half.status, 401);
});

test('eis zonder bewijs: de weigering spreekt per wegenset de juiste zin en het juiste protocol', async () => {
  const { h } = wereld();
  const beide = await h.eis(verzoek({}), {}, { actie: 'a', wegen: ['wachtwoord', 'passkey'], omschrijving: 'Een passkey toevoegen' });
  assert.deepEqual(beide, { status: 403, herbevestigingNodig: true, wegen: ['wachtwoord', 'passkey'], actie: 'a',
    error: 'Een passkey toevoegen vraagt een bevestiging. Bevestig eerst dat u het bent: met uw huidige wachtwoord of met uw passkey.' });
  const passkey = await h.eis(verzoek({ huidig: '' }), {}, { actie: 'b', wegen: ['passkey'] });
  assert.deepEqual(passkey, { status: 401, herbevestigingNodig: true, wegen: ['passkey'], actie: 'b', bevestigingNodig: true,
    error: 'Bevestig eerst met een passkey die al op dit account staat.' });
  const ww = await h.eis({ session: { account: LID } }, {}, { actie: 'c', wegen: ['wachtwoord'] });
  assert.equal(ww.status, 403);
  assert.equal(ww.error, 'Bevestig eerst met uw huidige wachtwoord.');
  assert.equal('bevestigingNodig' in ww, false);
  const niets = await h.eis(verzoek({ huidig: 'geheim' }), {}, { actie: 'd' });
  assert.deepEqual(niets.wegen, [], 'zonder wegen telt ook een goed wachtwoord niet');
  assert.equal(niets.status, 403);
});

test('heeftPasskey: vraagt de zware poort, en zonder poort of zonder functie is het nee', () => {
  assert.equal(wereld({ zwaar: { heeftPasskey: u => u.id === 'acc-1' } }).h.heeftPasskey(LID), true);
  assert.equal(wereld({ zwaar: () => ({ heeftPasskey: () => 0 }) }).h.heeftPasskey(LID), false);
  assert.equal(wereld({ zwaar: {} }).h.heeftPasskey(LID), false);
  assert.equal(wereld({}).h.heeftPasskey(LID), false);
  assert.equal(wereld({}).h.versGeopend, versGeopend);
});

test('stuur: de status, en alleen de velden die het scherm hoort te zien', () => {
  const uit = {};
  const res = { status(s) { uit.status = s; return this; }, json(b) { uit.body = b; return 'verstuurd'; } };
  const { h } = wereld();
  assert.equal(h.stuur(res, { status: 401, ok: false, via: 'x', verstuurd: false, error: 'e', wegen: ['passkey'] }), 'verstuurd');
  assert.deepEqual(uit, { status: 401, body: { error: 'e', wegen: ['passkey'] } });
  h.stuur(res, { error: 'zonder status' });
  assert.equal(uit.status, 403);
});
