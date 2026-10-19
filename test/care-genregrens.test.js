/* HET CARE-AANBOD BELOOFT GEEN ZORG DIE DE BEWIJSPOORT VRAAGT, BIJ EEN ZAAK DIE HAAR NIET HEEFT.

   Gevonden bij de domeinkaart van FoundationOS (Zorg, 19 oktober 2026): Kliniek
   Clara stond als zaak onder het open genre 'zorg', maar het Care-aanbod
   noemde er een huisarts en een fysiotherapeut, met "Consult huisarts" en
   "Fysiotherapie". Huisarts is een van de acht genres die een medewerker van
   RTG eerst laat bewijzen (kern/aanmeldingen/bewijs.js, EISEN_IDS). Gemeten:
   het Care-aanbod schrijft alleen de seed (kern/care.js), dus een zaak kon dit
   niet zelf -- het gat zat in de startdata, en die staat nu recht.

   Deze toets houdt dat zo: een aanbieder wiens behandelaars of behandelingen
   een gereguleerd beroep noemen, hoort bij een zaak met een genre uit de
   bewijspoort. Draai los: node --test test/care-genregrens.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { EISEN_IDS } = require('../server/kern/aanmeldingen/bewijs');
const { suppliers } = require('../server/seed/leveranciers');
const maakCare = require('../server/kern/care');

const GEREGULEERD = /\b(huisarts|arts|dokter|dr\.|fysiotherap\w*|specialist|apothe\w*|tandarts|verpleegkundige|consult)\b/i;

test('geen aanbieder in het Care-aanbod noemt een gereguleerd beroep zonder genre uit de bewijspoort', () => {
  const db = { data: {} };
  const care = maakCare({ db, save: () => {}, crypto, schoon: (v, n) => String(v == null ? '' : v).slice(0, n || 200),
    notify: () => {}, zorgVoor: () => null, zorgMee: () => null, metingVanBehandelaar: () => null, betaalZaak: async () => ({ ok: true }) });
  const aanbieders = care.careOverzicht({ key: 'user-1', tier: 'rtg' }).aanbieders;
  assert.ok(aanbieders.length > 0, 'het Care-aanbod is leeg');
  const fout = [];
  for (const a of aanbieders) {
    const zaak = suppliers.find((s) => s.code === a.supplierCode || s.code === String(a.id).toUpperCase()) || {};
    const teksten = [a.naam, a.beschrijving].concat((a.behandelaars || []).flatMap((b) => [b.naam, b.functie]),
      (a.behandelingen || []).map((b) => b.naam));
    const genoemd = teksten.filter((t) => GEREGULEERD.test(String(t || '')));
    if (genoemd.length && !EISEN_IDS.includes(zaak.type)) fout.push(a.naam + ' (genre ' + zaak.type + '): ' + genoemd.join(', '));
  }
  assert.deepEqual(fout, [], 'zorg die de bewijspoort vraagt, bij een zaak zonder dat genre');
});
