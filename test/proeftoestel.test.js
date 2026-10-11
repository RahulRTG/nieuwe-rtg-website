'use strict';
/* HET PROEFLID MET EEN GEBONDEN TOESTEL (scripts/lib/proeftoestel.js), tegen een
   ECHTE server met het bezitsbewijs op `verplicht` -- de productiestand, en niet
   de `aanbevolen` die ./helper standaard zet.

   Wat hier vastligt: de handtekening van het proeflid wordt door de poort in
   server/kern/identiteit/bezitsbewijs.js AANVAARD, en elke afwijking ervan --
   geen kop, een andere sleutel, een ander pad -- wordt GEWEIGERD. Een
   proefclient die de poort alleen haalt omdat de poort niets controleert, zou
   een groen vinkje zijn dat niets bewijst.

   En de passkeymedewerker van de idempotentieproef (scripts/lib/idempasskey.js)
   komt op die productiestand weer klaar: dat was de tweede helft van dezelfde
   regressie ("geen registratieopties (403)"). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('crypto');
const { startServer, stop } = require('./helper');
const { maakProeflid, metToestellen, bewijsVoor, KOP } = require('../scripts/lib/proeftoestel');
const { bouwPasskeyMedewerker } = require('../scripts/lib/idempasskey');

let srv, base;
const post = async (pad, lijf, tok, koppen) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(koppen || {}) },
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

test.before(async () => {
  srv = await startServer({ env: { RTG_BEZITSBEWIJS: 'verplicht', SMTP_URL: '' } });
  base = srv.base;
});
test.after(() => stop(srv));

test('1. de stand is werkelijk verplicht: een demo-pas komt niet door een zwaar pad', async () => {
  const demo = (await post('/api/login', { tier: 'rtg' })).data.token;
  assert.ok(demo);
  const r = await post('/api/pay/overzicht', {}, demo);
  assert.equal(r.status, 403, 'zonder deze weigering bewijzen de toetsen hieronder niets: ' + JSON.stringify(r.data).slice(0, 160));
  assert.match(String(r.data.error), /eigen RTG-account/);
});

test('2. het getekende verzoek van het proeflid wordt door de poort aanvaard', async () => {
  const lid = await maakProeflid({ post, naam: 'Toets Een' });
  assert.ok(lid.klaar, 'proeflid: ' + lid.reden);
  assert.ok(lid.klaar.codenaam);
  const getekend = metToestellen(post, { toestellen: [lid.klaar] });
  const r = await getekend('/api/pay/overzicht', {}, lid.klaar.token);
  assert.equal(r.status, 200, 'met bewijs door de poort: ' + JSON.stringify(r.data).slice(0, 160));
  assert.equal(r.data.codenaam, lid.klaar.codenaam);
  /* Elke oproep een vers bewijs: een tweede keer gaat ook door (geen hergebruikte jti). */
  assert.equal((await getekend('/api/pay/overzicht', {}, lid.klaar.token)).status, 200);
});

test('3. zonder bewijs, met een vreemde sleutel of voor een ander pad: geweigerd', async () => {
  const lid = await maakProeflid({ post, naam: 'Toets Twee' });
  assert.ok(lid.klaar, 'proeflid: ' + lid.reden);
  const t = lid.klaar.token;

  const kaal = await post('/api/pay/overzicht', {}, t);
  assert.equal(kaal.status, 401, 'een gebonden sessie zonder kop: ' + JSON.stringify(kaal.data).slice(0, 160));

  const vreemd = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const nep = await post('/api/pay/overzicht', {}, t, { [KOP]: await bewijsVoor(vreemd.privateKey, 'POST', '/api/pay/overzicht') });
  assert.equal(nep.status, 401, 'een handtekening van een andere sleutel');
  assert.match(String(nep.data.error), /klopt niet/);

  const ander = await post('/api/pay/overzicht', {}, t, { [KOP]: await lid.klaar.teken('POST', '/api/pay/tegoed') });
  assert.equal(ander.status, 401, 'een bewijs voor een ander adres');
  assert.match(String(ander.data.error), /ander adres/);
});

test('4. de ledenrol wordt alleen op een ZWAAR pad het proeflid; elders blijft hij de demo-pas', async () => {
  const lid = await maakProeflid({ post, naam: 'Toets Drie' });
  assert.ok(lid.klaar, 'proeflid: ' + lid.reden);
  const demo = (await post('/api/login', { tier: 'rtg' })).data.token;
  const p = metToestellen(post, { voorLid: { lid: lid.klaar, van: () => demo } });
  const zwaar = await p('/api/pay/overzicht', {}, demo);
  assert.equal(zwaar.status, 200, 'het demo-token op een zwaar pad: ' + JSON.stringify(zwaar.data).slice(0, 160));
  assert.equal(zwaar.data.codenaam, lid.klaar.codenaam, 'op een zwaar pad spreekt het proeflid');
  const licht = await p('/api/state', {}, demo);
  assert.equal(licht.status, 200);
  assert.notEqual(licht.data.state.user.codename, lid.klaar.codenaam, 'op een gewoon pad blijft het de demo-pas');
});

test('5. de schil raakt een gewoon pad niet aan en tekent een zwaar pad met de juiste lading', async () => {
  const gezien = [];
  const nep = async (pad, lijf, tok, koppen) => { gezien.push({ pad, tok, koppen }); return { status: 200, data: {} }; };
  const teken = async (m, pad) => 'bewijs:' + m + ':' + pad;
  const p = metToestellen(nep, { toestellen: [{ token: 'T', teken }] });
  await p('/api/state', {}, 'T');
  await p('/api/bank/akkoord', {}, 'T');
  await p('/api/bank/akkoord', {}, 'ONBEKEND');
  assert.equal(gezien[0].koppen, undefined, 'geen kop op een gewoon pad');
  assert.equal(gezien[1].koppen[KOP], 'bewijs:POST:/api/bank/akkoord');
  assert.equal(gezien[2].koppen, undefined, 'een onbekend token gaat ongemoeid door: de server beslist');
});

test('6. de passkeymedewerker komt klaar op de productiestand van het bezitsbewijs', async () => {
  const eigenaar = (await post('/api/auth/login', { login: process.env.RTG_OWNER_LOGIN || 'Rahul',
    password: process.env.DEMO_PASS || 'Imran' })).data.token;
  assert.ok(eigenaar, 'eigenaar logt in');
  const boardroom = (await post('/api/account/start', { rol: 'kantoor' }, eigenaar)).data.token;
  assert.ok(boardroom, 'boardroomsessie');
  const m = await bouwPasskeyMedewerker({ post, basis: base, boardroom });
  assert.ok(m.klaar, 'de medewerker bindt zijn toestel en registreert zijn passkey: ' + m.reden);
  assert.deepEqual(m.klaar.routes, ['/api/office/bank/incasso']);
});
