'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../server/kern/civilis/contract');

test('CIVILIS heeft tien fasen, twaalf domeinen, zes lagen en vijftien motorverantwoordelijkheden', () => {
  assert.equal(C.FASES.length, 10);
  assert.equal(C.DOMEINEN.length, 12);
  assert.equal(C.LAGEN.length, 6);
  assert.equal(C.MOTOREN.length, 15);
  assert.equal(new Set(C.FASES).size, 10);
  assert.equal(new Set(C.DOMEINEN).size, 12);
  assert.equal(new Set(C.LAGEN).size, 6);
  assert.equal(new Set(C.MOTOREN).size, 15);
});

test('een ketenenvelop draagt gezag, doel, minimale gegevens, bewijs, herstel en eigenaar', () => {
  const e = { id: 'evt:1', keten: 'opvang', overgang: 'plek_geaccepteerd',
    fase: 'toewijzing_en_acceptatie', domein: 'wonen', actor: 'partner:1',
    bevoegdheid: 'samenwerking:opvang', grondslag: 'juridisch-beslispunt:OPV-04',
    doel: 'een aangevraagde noodplek accepteren', tenant: 'partner:1', zaak: 'BZ:1',
    onderwerp: 'BZ-ABCDE', idempotentie: 'acceptatie:1',
    gegevens: ['reservering', 'voorziening', 'vervaltijd'], bewijs: ['partneracceptatie'],
    fouttoestand: 'geen_actuele_capaciteit', compensatie: 'alternatief_zoeken',
    audit: 'opvang.geaccepteerd', verantwoordelijke: 'partner:1', op: '2026-11-10T10:00:00Z' };
  assert.deepEqual(C.keurEnvelop(e), { ok: true, fouten: [] });
});

test('de envelop weigert identiteitsvelden en een overgang zonder herstelpad', () => {
  const fout = C.keurEnvelop({ fase: 'toegang', domein: 'wonen', naam: 'Mens' });
  assert.equal(fout.ok, false);
  assert.ok(fout.fouten.includes('verboden topveld naam'));
  const overgang = C.keurOvergang({ id: 'x', van: 'a', naar: 'b' });
  assert.equal(overgang.ok, false);
  assert.ok(overgang.fouten.includes('mist compensatie'));
});
