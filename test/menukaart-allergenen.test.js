/* Horeca: DE MENUKAART KENT ALLE VEERTIEN WETTELIJKE ALLERGENEN.

   EU-verordening 1169/2011 kent veertien allergenen, en de NVWA vraagt dat de
   informatie ook schriftelijk of elektronisch beschikbaar is. Tot 19 oktober
   2026 knipte /api/supplier/menu de allergenen van een gerecht (en van een
   optie) af op TWAALF, en nam het vrije tekst zonder controle: een gerecht met
   alle veertien verloor er stil twee, en "lupien" of "nuts" stond er naast
   "noten" als iets anders. Een allergeen dat stil verdwijnt, is erger dan een
   foutmelding.

   Nu wordt elke term naar de wettelijke naam gebracht (ook bekende
   synoniemen, zoals "ei" voor "eieren"), gaan alle veertien mee, en geeft een
   onbekende term een weigering met de lijst erbij.

   Draai los: node --test test/menukaart-allergenen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const VEERTIEN = ['gluten', 'schaaldieren', 'eieren', 'vis', 'pinda', 'noten', 'soja', 'melk',
  'selderij', 'mosterd', 'sesam', 'sulfiet', 'lupine', 'weekdieren'];

function zaak() {
  const routes = {};
  const app = { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } };
  const supplier = { code: 'TEST', name: 'Test', menu: [] };
  require('../server/routes/supplier/menukaart')({
    app, auth: (q, s, n) => n(), supplierAuth: (q, s, n) => n(), managerOnly: () => true,
    crypto, db: { data: { suppliers: [supplier], supplierPrices: [] } }, express: { json: () => (q, s, n) => n() },
    findSupplier: () => supplier, i18n: {}, ledenPrijs: (p) => p, logActivity: () => {}, media: {},
    publicSupplier: (s) => s, save: () => {}, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    sseToOffice: () => {}, alcoholGrensVan: () => 18, geborenVan: () => null, isFavoriet: () => false, leeftijdVan: () => null
  });
  const zet = (menu) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
    routes['/api/supplier/menu']({ supplier, actor: { manager: true }, body: { menu } }, res);
  });
  return { zet, supplier };
}

test('alle veertien allergenen blijven op een gerecht staan', async () => {
  const { zet } = zaak();
  const r = await zet([{ name: 'Alles', price: 10, allergens: VEERTIEN }]);
  assert.equal(r.status, 200);
  assert.deepEqual([...r.data.menu[0].allergens].sort(), [...VEERTIEN].sort(), 'niets geknipt');
});

test('ook op een optie gaan alle veertien mee', async () => {
  const { zet } = zaak();
  const r = await zet([{ name: 'Bowl', price: 10, opties: [{ naam: 'Topping', keuzes: [{ naam: 'Alles erop', allergenen: VEERTIEN }] }] }]);
  assert.equal(r.status, 200);
  assert.equal(r.data.menu[0].opties[0].keuzes[0].allergenen.length, 14);
});

test('een bekend synoniem wordt de wettelijke naam', async () => {
  const { zet } = zaak();
  const r = await zet([{ name: 'Omelet', price: 8, allergens: ['Ei', 'lactose', 'tarwe'] }]);
  assert.equal(r.status, 200);
  assert.deepEqual([...r.data.menu[0].allergens].sort(), ['eieren', 'gluten', 'melk']);
});

test('een onbekende term wordt geweigerd met de lijst erbij, en de kaart blijft zoals hij was', async () => {
  const { zet, supplier } = zaak();
  supplier.menu = [{ id: 'oud', name: 'Oud gerecht', allergens: ['melk'] }];
  const r = await zet([{ name: 'Raar', price: 5, allergens: ['kokos'] }]);
  assert.equal(r.status, 400);
  assert.match(r.data.error, /kokos/);
  assert.match(r.data.error, /lupine/, 'de toegestane lijst staat in de melding');
  assert.equal(supplier.menu[0].id, 'oud', 'niets half opgeslagen');
});
