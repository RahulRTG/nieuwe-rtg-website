/* Gebouw: ALLEEN EEN ZAAK MET HET GENRE KANTOORGEBOUW KOMT IN HET PAND.

   /api/supplier/gebouw/* toetst al op de capability `gebouw` (eisGebouw in
   routes/gebouw.js). De twee uitbreidingen ernaast -- gebouwpand
   (installaties, keuringen, post, parkeren, BHV) en gebouwplus
   (huurcontracten, leads, energie) -- vroegen tot 19 oktober 2026 alleen een
   zaaksessie en een manager. Elke zaak, ook een restaurant of kapper, kon er
   dus een pand met huurcontracten en keuringen in opslaan. Dat is geen
   lek naar een andere zaak (de opslag is per zaakcode), maar het is een
   genre-grens die op de ene deur wel en op de andere niet stond.

   Draai los: node --test test/gebouw-cap.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function laad(bestand, caps) {
  const routes = {};
  const app = { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } };
  const db = { data: {}, capsVan: () => caps };
  require('../server/routes/supplier/' + bestand)({
    app, db, save: () => {}, supplierAuth: (q, s, n) => n(), managerOnly: () => true,
    logActivity: () => {}, sseToSupplier: () => {}, crypto
  });
  const roep = (pad) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
    routes[pad]({ supplier: { code: 'ZAAK', name: 'Zaak', type: caps.includes('gebouw') ? 'kantoorgebouw' : 'restaurant' },
      actor: { manager: true, name: 'Manager' }, body: {} }, res);
  });
  return { routes, roep };
}

for (const bestand of ['gebouwpand', 'gebouwplus']) {
  test(bestand + ': een zaak zonder het genre kantoorgebouw krijgt op elke route 403', async () => {
    const { routes, roep } = laad(bestand, ['menu', 'location']);
    const paden = Object.keys(routes);
    assert.ok(paden.length >= 6, 'de routes zijn geladen');
    for (const pad of paden) {
      const r = await roep(pad);
      assert.equal(r.status, 403, pad + ' laat een restaurant binnen');
    }
  });

  test(bestand + ': een kantoorgebouw komt er gewoon in', async () => {
    const { roep } = laad(bestand, ['gebouw', 'location']);
    const r = await roep('/api/supplier/' + bestand + '/overzicht');
    assert.equal(r.status, 200);
  });
}
