/* EEN TIK IS EEN REGEL, EN EEN HERHAALDE TIK IS DEZELFDE REGEL.

   Op een horecarekening zijn twee identieke tikken twee bestellingen: twee
   biertjes zijn geen dubbeltik. Daarom stuurt het scherm per tik een eigen
   herhaalsleutel (`idem`), en dedupliceert de server op die sleutel en niet op
   de inhoud. Komt dezelfde tik terug nadat hij al telde (een afgebroken
   verbinding, een herstart van de server), dan staat hij er een keer; een
   ANDER verzoek met dezelfde sleutel is een fout (409). De sleutel staat op de
   regel zelf, dus hij overleeft een crash -- deze toets laat de server echt
   vallen en start hem op dezelfde map opnieuw.

   Draai los: node --test test/horeca-regel-herhaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regel-'));
let srv = null;
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function zaak() {
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  return (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
}
const env = { RTG_DATA_DIR: TMP, SMTP_URL: '' };

test.after(() => {
  if (srv && srv.child) try { srv.child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een herhaalde tik is na een crash dezelfde regel; een andere tik met dezelfde sleutel is 409', async () => {
  srv = await startServer({ env });
  let tok = await zaak();
  const rek = (await api('/api/supplier/horeca/rekening/open', { tafel: 'H1', gasten: 2 }, tok)).body.rekening;
  const tik = { rekeningId: rek.id, naam: 'Biertje', prijs: 4, aantal: 1, gang: 0, idem: 'tik-1' };
  const eerste = await api('/api/supplier/horeca/rekening/regel', tik, tok);
  assert.equal(eerste.status, 200);
  /* Twee biertjes zijn geen dubbeltik: een tweede tik heeft een eigen sleutel. */
  assert.equal((await api('/api/supplier/horeca/rekening/regel', Object.assign({}, tik, { idem: 'tik-2' }), tok)).status, 200);
  await new Promise(r => setTimeout(r, 300));
  srv.child.kill('SIGKILL');
  await new Promise(r => srv.child.once('exit', r));
  srv = await startServer({ env });
  tok = await zaak();
  const herhaling = await api('/api/supplier/horeca/rekening/regel', tik, tok);
  assert.equal(herhaling.status, 200);
  assert.equal(herhaling.body.herhaald, true, 'de herhaling na de crash is dezelfde regel');
  assert.equal(herhaling.body.regel.id, eerste.body.regel.id);
  const ander = await api('/api/supplier/horeca/rekening/regel', Object.assign({}, tik, { naam: 'Wijn', prijs: 7 }), tok);
  assert.equal(ander.status, 409, 'dezelfde sleutel bij een ander verzoek is een fout: ' + JSON.stringify(ander.body).slice(0, 300));
  const r = (await api('/api/supplier/horeca/rekening', { rekeningId: rek.id }, tok)).body.rekening;
  assert.equal(r.regels.length, 2, 'precies de twee biertjes, geen derde regel');
});
