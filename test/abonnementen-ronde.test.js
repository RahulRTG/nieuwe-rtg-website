'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const maak = require('../server/kern/aanmeldingen/abonnementen');

test('een begrensde ronde bereikt ook contract 101 en herneemt na gewijzigde lijst', async () => {
  const gezien = [], rijen = [];
  rijen.find = fn => {
    for (let n = 1; n <= 103; n++) {
      const rij = { contractId: String(n).padStart(3, '0'), termijnen: [] };
      if (fn(rij)) { gezien.push(rij.contractId); return rij; }
    }
  };
  const db = { data: { contracten: Array.from({ length: 101 }, (_, i) => ({
    id: String(i + 1).padStart(3, '0'), status: 'GEACCEPTEERD', automatischAbonnement: true
  })), lidmaatschapBetalingen: rijen } };
  const service = maak({ db, accounts: {}, betaal: {}, betaalWaarheid: {}, beschikbaar: true,
    returnUrl: 'https://example.test/apps/geld.html#lidmaatschap' });
  assert.equal((await service.ronde()).bekeken, 100);
  assert.equal((await service.ronde()).bekeken, 1);
  assert.equal(new Set(gezien).size, 101);
  db.data.contracten.push({ id: '103', status: 'GEACCEPTEERD', automatischAbonnement: true });
  assert.equal((await service.ronde()).bekeken, 1);
  assert.equal(gezien.at(-1), '103');
  assert.equal((await service.ronde()).bekeken, 100);
});
