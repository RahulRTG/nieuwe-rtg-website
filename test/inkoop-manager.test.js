/* Horeca-inkoop: BESTELLEN EN ANNULEREN BIJ EEN GROOTHANDEL IS MANAGERWERK.

   Een bestelling verplicht de zaak tot betalen; annuleren raakt een
   leverancier. Tot 19 oktober 2026 hadden /api/supplier/inkoop/bestel,
   /annuleer en /ai-bevestig alleen een zaaksessie nodig: elk personeelslid
   kon namens de zaak bestellen of een bestelling van een ander annuleren.
   De groothandelkant zelf (functie, product) vroeg wel een manager.

   Kijken (markt, eigen bestellingen) en een AI-voorstel laten maken blijft
   voor iedereen in de zaak: dat verplicht niemand tot iets.

   Draai los: node --test test/inkoop-manager.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function zaak() {
  const routes = {};
  const app = { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } };
  const geplaatst = [];
  const kern = {
    app, express: { json: () => (q, s, n) => n() }, supplierAuth: (q, s, n) => n(),
    managerOnly: (req, res) => { if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; } return true; }
  };
  kern.groothandel = {
    ghIsGroothandel: () => false, ghFunctieLijst: () => [], ghZetFunctie: () => ({}), ghZetProduct: () => ({}),
    ghZetVoorraad: () => ({}), ghDefaults: () => ({ producten: [] }), ghMarkt: () => [],
    ghPlaatsBestelling: (code, koper, regels) => { geplaatst.push({ code, regels }); return { order: { ref: 'O1' } }; },
    ghOrderVerder: () => ({}), ghAnnuleer: () => ({ ok: true }), ghMijnBestellingen: () => [], ghInkomend: () => [],
    ghBijbestelVoorstel: () => ({ ok: true, regels: [] }), GROOTHANDEL_CATEGORIEEN: []
  };
  require('../server/routes/supplier/groothandel')(kern);
  const roep = (pad, manager) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
    routes[pad]({ supplier: { code: 'ZAAK', name: 'Zaak', type: 'restaurant' }, actor: { manager: !!manager }, body: { groothandelCode: 'GH', regels: [{ id: 'x', aantal: 1 }], ref: 'O1' } }, res);
  });
  return { roep, geplaatst };
}

test('een medewerker bestelt, annuleert of bevestigt geen inkoop', async () => {
  const { roep, geplaatst } = zaak();
  for (const pad of ['/api/supplier/inkoop/bestel', '/api/supplier/inkoop/annuleer', '/api/supplier/inkoop/ai-bevestig']) {
    assert.equal((await roep(pad, false)).status, 403, pad + ' vraagt een manager');
  }
  assert.equal(geplaatst.length, 0, 'er is niets besteld');
});

test('een manager kan het wel, en kijken blijft voor iedereen', async () => {
  const { roep, geplaatst } = zaak();
  assert.equal((await roep('/api/supplier/inkoop/bestel', true)).status, 200);
  assert.equal(geplaatst.length, 1);
  for (const pad of ['/api/supplier/inkoop/markt', '/api/supplier/inkoop/mijn', '/api/supplier/inkoop/ai']) {
    assert.equal((await roep(pad, false)).status, 200, pad + ' blijft open voor de zaak');
  }
});
