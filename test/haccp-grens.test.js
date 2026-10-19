/* Horeca HACCP: EEN MEETGRENS ZET DE LEIDING, EN EEN OUDE GRENS BLIJFT STAAN.

   Een temperatuurlogboek is zo goed als zijn grens: koeling op hoogstens 7 °C
   (NVWA). Tot 19 oktober 2026 kon elke medewerker met alleen een
   zaaksessie de grens van een bestaand meetpunt overschrijven door hetzelfde
   id opnieuw te posten -- 7 werd 12 en de afwijkingen verdwenen -- en er
   bleef geen spoor van de oude grens. Dat is precies het "achteraf
   gladstrijken" dat dit bestand zelf verbiedt (keuze 2 in de kop).

   Nu:
   - een meetpunt maken of zijn grens wijzigen doet een manager;
   - een gewijzigde grens bewaart de oude, met wanneer en door wie.

   Draai los: node --test test/haccp-grens.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function keuken() {
  const routes = {};
  const app = { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } };
  const opslag = {};
  let n = 0;
  const horeca = { H: (code) => (opslag[code] = opslag[code] || {}), nu: () => new Date().toISOString(), id: () => 'p' + (++n) };
  require('../server/routes/supplier/horeca/haccp')({
    app, save: () => {}, schoon: (v, m) => String(v == null ? '' : v).trim().slice(0, m), supplierAuth: (q, s, nx) => nx(),
    logActivity: () => {}, horeca,
    managerOnly: (req, res) => { if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; } return true; }
  });
  const roep = (pad, body, manager) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
    routes[pad]({ supplier: { code: 'KEUKEN' }, actor: { manager: !!manager, name: manager ? 'Chef' : 'Kok' }, body }, res);
  });
  return { roep, opslag };
}

test('een medewerker zonder managerrol zet of wijzigt geen meetgrens', async () => {
  const { roep } = keuken();
  const nieuw = await roep('/api/supplier/horeca/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 7 }, false);
  assert.equal(nieuw.status, 403);
  assert.equal((await roep('/api/supplier/horeca/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 7 }, true)).status, 200);
  const ruimer = await roep('/api/supplier/horeca/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 12 }, false);
  assert.equal(ruimer.status, 403, 'een kok maakt de koeling niet ruimer');
});

test('een gewijzigde grens bewaart de oude, met wanneer en door wie', async () => {
  const { roep, opslag } = keuken();
  await roep('/api/supplier/horeca/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 7 }, true);
  const r = await roep('/api/supplier/horeca/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 5 }, true);
  assert.equal(r.status, 200);
  const punt = opslag.KEUKEN.haccp.punten.koel1;
  assert.equal(punt.max, 5);
  assert.ok(Array.isArray(punt.historie) && punt.historie.length === 1, 'de oude grens staat in de historie');
  assert.equal(punt.historie[0].max, 7);
  assert.ok(punt.historie[0].tot && punt.historie[0].door, 'met wanneer en door wie');
});
