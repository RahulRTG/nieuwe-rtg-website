/* HET GEZIN AAN EEN OUDERACCOUNT, op een ECHTE server
   (foundation/gezinseigenaar.js, besluit van de eigenaar van 5 oktober 2026).

   De server draait met RTF_GEZIN_ACCOUNTPLICHT=1: dezelfde plicht die in
   productie vanzelf geldt (gezinshulp.js profielVan), zonder de vrijgavepoort
   ervoor -- die heeft haar eigen toets (test/foundation-productiepoort.test.js).

   Wat hier vastligt:
     1. een GRATIS account maakt direct een gezin, zonder code of PIN, en zijn
        account IS de sleutel;
     2. een kind toevoegen of een kind een sessie geven weigert zonder
        gecontroleerd paspoort, en zegt waarom (`hoe: 'paspoort'`);
     3. na de keuring van de ouder werkt het wel, en het kind komt binnen;
     4. een anoniem gezin (code + PIN) opent onder de plicht niets meer;
     5. de oude beheerdersroute is geen omweg om de paspoorttrede heen;
     6. een account heeft een gezin, en een tweede verzoek zegt dat.

   Draai los: node --test test/gezinseigenaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, keurLidGoed } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinseigenaar-'));
let child, base;
test.before(async () => {
  ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1', RTF_GEZIN_ACCOUNTPLICHT: '1' } }));
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function post(pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst };
}
const mij = (code, token) => fetch(base + '/api/foundation/gezin/' + code + '/mij',
  { headers: { Authorization: 'Bearer ' + token } }).then(r => r.status);
const MAAK = { gezinsnaam: 'Gezin Proef', naam: 'Ouder', bevoegdGezin: true, privacyAkkoord: true };

let ouder, gezin;

test('1. een gratis account maakt direct een gezin, zonder code of pincode', async () => {
  ouder = await registreerGratis(base);
  assert.ok(ouder, 'een gratis account langs de echte registratie');
  const leeg = await post('/api/rtf/eigen-gezin', {}, ouder.token);
  assert.equal(leeg.status, 200, leeg.tekst);
  assert.equal(leeg.body.gezin, null);
  assert.equal(leeg.body.achttienPlus, true);
  assert.equal(leeg.body.paspoortGecontroleerd, false);

  const zonderAkkoord = await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'X', naam: 'Y' }, ouder.token);
  assert.equal(zonderAkkoord.status, 400, 'bevoegdheid en privacy worden bevestigd');

  const r = await post('/api/rtf/eigen-gezin/maak', MAAK, ouder.token);
  assert.equal(r.status, 200, r.tekst);
  assert.match(r.body.token, /^GZ\.[0-9A-F]{32}$/);
  gezin = r.body;
  assert.equal(await mij(gezin.code, gezin.token), 200, 'de ouder komt binnen onder de accountplicht');

  const opnieuw = await post('/api/rtf/eigen-gezin/sessie', {}, ouder.token);
  assert.equal(opnieuw.status, 200, opnieuw.tekst);
  assert.equal(await mij(gezin.code, opnieuw.body.token), 200, 'het account is de sleutel: een nieuwe sessie zonder PIN');
});

test('2. zonder gecontroleerd paspoort: geen kind, en de reden staat erbij', async () => {
  const k = await post('/api/rtf/eigen-gezin/kind', { naam: 'Mila', geboortedatum: '2018-03-03' }, ouder.token);
  assert.equal(k.status, 403, k.tekst);
  assert.equal(k.body.hoe, 'paspoort');
});

test('5. de oude beheerdersroute is geen omweg om de paspoorttrede', async () => {
  const r = await post('/api/foundation/gezin/profiel/maak',
    { code: gezin.code, token: gezin.token, naam: 'Omweg', rol: 'kind', geboortedatum: '2018-03-03', pin: '1357' });
  assert.equal(r.status, 409, r.tekst);
});

test('3. na de keuring van de ouder: kind toevoegen, kind binnen', async () => {
  await keurLidGoed(base, ouder.token, ouder.codenaam);
  const stand = await post('/api/rtf/eigen-gezin', {}, ouder.token);
  assert.equal(stand.body.paspoortGecontroleerd, true);
  const k = await post('/api/rtf/eigen-gezin/kind', { naam: 'Mila', geboortedatum: '2018-03-03' }, ouder.token);
  assert.equal(k.status, 200, k.tekst);
  const s = await post('/api/rtf/eigen-gezin/sessie', { profielId: k.body.profiel.id }, ouder.token);
  assert.equal(s.status, 200, s.tekst);
  assert.equal(s.body.profiel.rol, 'kind');
  assert.equal(await mij(gezin.code, s.body.token), 200, 'het kind komt binnen via het account van de ouder');
  const volw = await post('/api/rtf/eigen-gezin/kind', { naam: 'Groot', geboortedatum: '1990-01-01' }, ouder.token);
  assert.equal(volw.status, 409, 'een volwassene is geen kinderprofiel');
});

test('4. onder de plicht maakt de oude deur geen anoniem gezin, en wijst de weg', async () => {
  /* Een anoniem gezin opent onder de plicht niets (zie test/foundation-gezinstoken-productie.test.js,
     op een echte productieserver). Hem dan nog laten maken is een doodlopende weg. */
  const g = await post('/api/foundation/gezin/maak',
    { gezinsnaam: 'Anoniem', naam: 'Iemand', pin: '2468', bevoegdGezin: true, privacyAkkoord: true });
  assert.equal(g.status, 409, g.tekst);
  assert.match(g.body.error, /Mijn gezin/);
  assert.equal(g.body.token, undefined, 'geen sessie bij een weigering');
});

test('6. een account, een gezin', async () => {
  const r = await post('/api/rtf/eigen-gezin/maak', MAAK, ouder.token);
  assert.equal(r.status, 409, r.tekst);
  const zonderAccount = await post('/api/rtf/eigen-gezin/maak', MAAK);
  assert.ok([401, 403].includes(zonderAccount.status), 'zonder sessie geen gezin: ' + zonderAccount.status);
});

test('7. een gratis account ziet zijn gezin in zijn export, en "verwijder mijn account" neemt het gezin mee', async () => {
  const exp = await post('/api/privacy/export', {}, ouder.token);
  assert.equal(exp.status, 200, 'een gratis account heeft recht op inzage: ' + exp.tekst.slice(0, 120));
  assert.equal(exp.body.foundationGezin.gezin.code, gezin.code);
  assert.equal(await mij(gezin.code, gezin.token), 200);
  const weg = await post('/api/privacy/delete', {}, ouder.token);
  assert.equal(weg.status, 200, 'een gratis account heeft recht op vergetelheid: ' + weg.tekst.slice(0, 120));
  assert.equal(await mij(gezin.code, gezin.token), 404, 'het gezin aan het account is weg, met de kinderen erin');
});

test('8. een account van 16 maakt geen gezin, en hoort waarom', async () => {
  const u = Date.now().toString().slice(-8);
  const jaar = new Date().getFullYear() - 16;
  const r = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tiener', email: 'tn' + u + '@voorbeeld.nl', password: 'geheim12345',
      geboortedatum: jaar + '-01-01', tier: 'guest' }) });
  const j = await r.json();
  assert.ok(j.token, 'een account van 16 kan bestaan: ' + JSON.stringify(j).slice(0, 120));
  const stand = await post('/api/rtf/eigen-gezin', {}, j.token);
  assert.equal(stand.body.achttienPlus, false);
  const m = await post('/api/rtf/eigen-gezin/maak', MAAK, j.token);
  assert.equal(m.status, 403, m.tekst);
  assert.match(m.body.error, /vanaf 18 jaar/);
});

/* De herhaling, voor het mutatiecontract (server/lib/mutatiecontracten-eigengezin.js):
   elke route twee keer met hetzelfde lijf tegen deze echte server. */
test('9. twee keer hetzelfde lijf: lezen verandert niets, maken weigert, een sessie is nieuw, een kind is een kind', async () => {
  const lid = await registreerGratis(base);
  await keurLidGoed(base, lid.token, lid.codenaam);
  const l1 = await post('/api/rtf/eigen-gezin', {}, lid.token), l2 = await post('/api/rtf/eigen-gezin', {}, lid.token);
  assert.equal(l1.status, 200); assert.deepEqual(l1.body, l2.body, 'lezen is twee keer hetzelfde');
  const m1 = await post('/api/rtf/eigen-gezin/maak', MAAK, lid.token);
  const m2 = await post('/api/rtf/eigen-gezin/maak', MAAK, lid.token);
  assert.equal(m1.status, 200, m1.tekst);
  assert.equal(m2.status, 409, 'een toestandscontrole: een account, een gezin');
  assert.equal(m2.body.token, undefined, 'de weigering toont geen sessie');
  const s1 = await post('/api/rtf/eigen-gezin/sessie', {}, lid.token);
  const s2 = await post('/api/rtf/eigen-gezin/sessie', {}, lid.token);
  assert.equal(s1.status, 200); assert.equal(s2.status, 200);
  assert.notEqual(s1.body.token, s2.body.token, 'elke sessie is nieuw, nooit uit een cache');
  assert.equal(await mij(m1.body.code, s1.body.token), 200, 'en de eerste blijft geldig');
  const KIND = { naam: 'Sam', geboortedatum: '2017-06-06' };
  const k1 = await post('/api/rtf/eigen-gezin/kind', KIND, lid.token);
  const k2 = await post('/api/rtf/eigen-gezin/kind', KIND, lid.token);
  assert.equal(k1.status, 200, k1.tekst); assert.equal(k2.status, 200, k2.tekst);
  assert.equal(k1.body.profiel.id, k2.body.profiel.id, 'een dubbeltik is geen tweede kind');
  const na = await post('/api/rtf/eigen-gezin', {}, lid.token);
  assert.equal(na.body.profielen.filter(p => p.naam === 'Sam').length, 1);
});
