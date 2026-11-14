'use strict';
/* De supplier-state geeft de huisdag door, geen UTC-dag. Bewijs dat zijn
   klokboek diezelfde grens leest zonder de bestaande actorpoort te verruimen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const zicht = require('../server/kern/leverancier/logboekzicht');

for (const [naam, dag, gisteren, eigen, collega, morgen] of [
  ['winternacht uit CI', '2026-11-12', '2026-11-11T22:59:00Z', '2026-11-11T23:00:00Z', '2026-11-11T23:13:50Z', '2026-11-12T23:00:00Z'],
  ['zomernacht', '2026-07-16', '2026-07-15T21:59:00Z', '2026-07-15T22:00:00Z', '2026-07-15T22:30:00Z', '2026-07-16T22:00:00Z'],
  ['gewone middag', '2026-11-12', '2026-11-11T22:59:00Z', '2026-11-12T08:00:00Z', '2026-11-12T12:00:00Z', '2026-11-12T23:00:00Z'],
  ['wintertijdwissel', '2026-10-25', '2026-10-24T21:59:00Z', '2026-10-24T22:00:00Z', '2026-10-25T22:30:00Z', '2026-10-25T23:00:00Z']
]) {
  test('klokboek: ' + naam + ' houdt de lokale dag én de personeelsgrens', () => {
    const ik = { staffId: 'a', name: 'Zoe', in: eigen };
    const ander = { staffId: 'b', name: 'Anna', in: collega };
    const data = { klok: { Z: [
      { staffId: 'b', name: 'Anna', in: morgen }, ander, ik,
      { staffId: 'b', name: 'Anna', in: gisteren },
      { staffId: 'b', name: 'Anna', in: dag + '-ongeldig' }
    ] }, supplierActivity: { Z: [
      { staffId: 'b', who: 'Anna', text: 'klokte in', soort: 'klok-in', at: collega },
      { staffId: 'a', who: 'Zoe', text: 'klokte in', soort: 'klok-in', at: eigen }
    ] } };
    const voor = structuredClone(data);
    const manager = zicht.staatDelen(data, 'Z', { manager: true }, dag);
    assert.deepEqual(manager.klok.vandaag, [ander, ik], 'alleen echte tijdstippen binnen de huisdag');
    const zelf = zicht.staatDelen(data, 'Z', { manager: false, staffId: 'a' }, dag);
    assert.deepEqual(zelf.klok.vandaag, [ik]);
    assert.equal(JSON.stringify(zelf).includes(collega), false, 'geen kloktijd van een collega via een ander veld');
    const onbevoegd = zicht.staatDelen(data, 'Z', { manager: false, staffId: 'c' }, dag);
    assert.deepEqual(onbevoegd.klok.vandaag, []);
    assert.deepEqual(onbevoegd.activity, []);
    assert.deepEqual(onbevoegd.klok.binnen, ['Anna', 'Zoe'], 'aanwezigheid blijft toegestaan, alfabetisch');
    for (const tijd of [eigen, collega, gisteren, morgen]) {
      assert.equal(JSON.stringify(onbevoegd).includes(tijd), false, 'geen persoonlijke kloktijd voor een collega');
    }
    assert.deepEqual(data, voor, 'de zichtfilter wijzigt de bron niet');
  });
}
