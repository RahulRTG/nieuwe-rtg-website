/* EEN BERICHT AAN HET GEZIN MET EEN HERHAALSLEUTEL STAAT ER EEN KEER, OOK NA
   EEN HERSTART (19 oktober 2026).

   De voltooiproef van de stand Gezin (scripts/lib/voltooi/gezin.js) zag een
   dubbele tik op "Stuur" het bericht twee keer bij het gezin plaatsen. De stand
   stuurt nu per geschreven bericht een sleutel mee. Een geheugenlaag vangt een
   dubbeltik binnen een proces al op; na een crash is die leeg, en dan herkent
   alleen de gastenkern (server/foundation/gasten/koppeling.js) de herhaling,
   omdat de sleutel op het bericht staat. Deze toets herstart de server op
   dezelfde datamap en zakt zonder die herkenning. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopNet } = require('./helper');

const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-herhaal-'));
let srv;
test.after(() => { stop(srv && srv.child); try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {} });
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
const lid = async () => { const u = Date.now().toString().slice(-7) + (n++);
  return (await api('/api/auth/register', { name: 'Gezinslid ' + u, email: 'gh' + u + '@x.nl', phone: '061' + u.slice(-7),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' })).body.token; };

test('dezelfde sleutel na een herstart is hetzelfde bericht; een nieuwe sleutel een tweede', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: MAP } });
  const ouder = await lid(), oppas = await lid();
  const g = await api('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'Gezin Herhaal', naam: 'Beheerder', bevoegdGezin: true, privacyAkkoord: true }, ouder);
  const s = (await api('/api/rtf/eigen-gezin/sessie', { profielId: g.body.profielen[0].id }, ouder)).body;
  const u = (await api('/api/foundation/gezin/uitnodiging/maak', { code: s.code, token: s.token, naam: 'Oppas', rol: 'gast', relatie: 'oppas' })).body;
  assert.equal((await api('/api/rtf/uitnodiging/accepteer', { uitnodiging: u.uitnodiging }, oppas)).status, 200);
  const lijf = { code: s.code, tekst: 'Ze slapen.', idem: 'toets-gezin-1' };
  assert.equal((await api('/api/rtf/bericht', lijf, oppas)).status, 200);
  await stopNet(srv.child, 15000);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: MAP } });
  assert.equal((await api('/api/rtf/bericht', lijf, oppas)).status, 200);
  assert.equal((await api('/api/rtf/bericht', Object.assign({}, lijf, { idem: 'toets-gezin-2' }), oppas)).status, 200);
  const r = await fetch(srv.base + '/api/foundation/gezin/' + s.code + '/berichten', { headers: { Authorization: 'Bearer ' + s.token } });
  const berichten = (await r.json()).berichten || [];
  assert.equal(berichten.filter(b => b.tekst === 'Ze slapen.').length, 2, 'een herhaling na de herstart telt niet, een nieuwe sleutel wel');
  assert.ok(!JSON.stringify(berichten).includes('toets-gezin-1'), 'de sleutel gaat niet naar de lezer');
});
