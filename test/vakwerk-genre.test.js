/* Vakwerk: ELK BOUWGENRE UIT HET REGISTER IS EEN VAKBEDRIJF.

   Het genre `vakwerk` ("Vakwerk & klussen", sector construction, dezelfde
   caps als `bouw`) staat open in het genre-register, maar stond tot 19
   oktober 2026 niet in VAK_GENRES. Daardoor faalde isVak (kern/vakwerk/
   index.js) en kreeg zo'n zaak 403 op de hele vakpro-laag: offertes,
   capaciteit, werkbon. Een open genre zonder werkend gereedschap is volgens
   CIVILIS par. 5A "een belofte zonder inhoud". Ook de keten van een
   woningmelding naar de vakman (LivingOS-A, W4) loopt via deze laag.

   Draai los: node --test test/vakwerk-genre.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GENRES } = require('../server/seed/genres');
const { VAK_GENRES } = require('../server/kern/vakwerk/genres');

const lijst = Array.isArray(GENRES) ? GENRES : Object.entries(GENRES).map(([id, v]) => Object.assign({ id }, v));

test('elk open bouwgenre (construction) is een vakgenre', () => {
  const bouw = lijst.filter((g) => g.industry === 'construction' && g.status === 'open');
  assert.ok(bouw.length >= 2, 'het register heeft bouwgenres');
  for (const g of bouw) assert.ok(VAK_GENRES[g.id], g.id + ' staat open maar heeft geen vakpro-laag');
});

test('vakwerk heeft een eigen naam voor zijn werk en een persona', () => {
  const v = VAK_GENRES.vakwerk;
  assert.ok(v && v.label && v.werk && v.werkMv && v.persona);
});
