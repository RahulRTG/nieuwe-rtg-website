/* HET FORMULIER OP DE SITE VAN EEN ZAAK -- een bericht wordt een klus in de
   werklijst, en een herhaling is dezelfde klus.

   De weg is echt: de manager zet de site van de zaak online met
   /api/supplier/site/genereer, een lid opent hem in de RTG-browser en
   verstuurt het formulier. Daarna valt de server (SIGKILL) en stuurt het lid
   hetzelfde verzoek opnieuw, zoals een scherm doet waarvan het antwoord nooit
   aankwam. Er hoort precies een klus te staan; een ander bericht met dezelfde
   sleutel is 409. En de werklijst draagt geen ledensleutel.

   Draai los: node --test test/browser-zaakbericht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const { once } = require('node:events');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakbericht-'));
const env = { RTG_DATA_DIR: TMP, SMTP_URL: '' };
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
const klussen = async (tok, tekst) => ((await api('/api/supplier/state', {}, tok)).body.state.tickets || [])
  .filter(t => String(t.text).includes(tekst));

test.after(() => {
  if (srv && srv.child) try { srv.child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een herhaald formulierbericht aan een zaak is na een crash dezelfde klus', async () => {
  srv = await startServer({ env });
  let Z = await zaak();
  const site = await api('/api/supplier/site/genereer', {}, Z);
  assert.equal(site.status, 200, JSON.stringify(site.body));
  const adres = site.body.adres;
  const lid = (await api('/api/auth/register', { name: 'Gast Een', email: 'zaakbericht@x.nl', phone: '0612345699',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
  const o = await api('/api/browser/open', { adres }, lid);
  assert.equal(o.status, 200);
  assert.ok(o.body.zaak, 'de browser weet dat dit een bedrijf is');
  const lijf = { adres, tekst: 'Tafel voor zes op zaterdag', soort: 'reservering', idem: 'web-1' };
  const eerste = await api('/api/browser/bericht', lijf, lid);
  assert.equal(eerste.status, 200);
  assert.equal(eerste.body.via, 'werklijst');
  assert.equal((await klussen(Z, 'Tafel voor zes')).length, 1, 'de klus staat in de werklijst');
  // Een bevestigde handeling moet direct duurzaam zijn, zonder extra spaartijd.
  // Luister vóór SIGKILL; een gemist exit-event mag de proef niet laten hangen.
  const exited = once(srv.child, 'exit', { signal: AbortSignal.timeout(5000) });
  const killed = srv.child.kill('SIGKILL');
  const [, signal] = await exited;
  assert.equal(killed, true);
  assert.equal(signal, 'SIGKILL');
  srv = await startServer({ env });
  const herhaling = await api('/api/browser/bericht', lijf, (await api('/api/auth/login', { login: 'zaakbericht@x.nl', password: 'geheim12345' })).body.token);
  assert.equal(herhaling.status, 200);
  assert.equal(herhaling.body.herhaald, true);
  const lid2 = (await api('/api/auth/login', { login: 'zaakbericht@x.nl', password: 'geheim12345' })).body.token;
  assert.equal((await api('/api/browser/bericht', Object.assign({}, lijf, { tekst: 'Iets anders graag' }), lid2)).status, 409);
  Z = await zaak();
  const k = await klussen(Z, 'Tafel voor zes');
  assert.equal(k.length, 1, 'precies een klus in de werklijst: ' + JSON.stringify(k).slice(0, 400));
  assert.ok(!JSON.stringify(k[0]).includes('user-'), 'de werklijst draagt geen ledensleutel');
});
