/* ============================================================================
   WAT EEN WERKGEVER VAN EEN SOLLICITATIE ZIET -- en wat hij er NIET uit kan
   afleiden (ARBEID.md par. 4 punt 1).

   De vorige versie was een weglaatlijst over drie velden (viaRTF, key, rtf), en
   de proef die hem bewaakte (scripts/adamproef.js schakel 8) zocht naar precies
   die drie namen. Allebei groen, terwijl de herkomst lekte via wat er
   ONTBRAK: een ledenrij hield `codename` en `vacatureId`, een Foundation-rij had
   ze allebei niet. Daarom toetst deze file de SLEUTELSET en niet een paar namen.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWerk, WERKGEVER_VELDEN } = require('../server/kern/werk');

const werk = () => maakWerk({ db: { data: { vacatures: {}, supplierTypes: {}, applyChats: {} } },
  save() {}, i18n: {}, mail: null, LANDEN: { NL: { naam: 'Nederland' } }, findSupplier: () => null,
  sseToSupplier() {}, sseToCustomer() {}, notifySupplier() {}, notify() {}, commWerk: () => null,
  rtf: {}, meldLidVan: () => null });

/* De rijvormen zoals de drie routes ze schrijven: routes/member/werk.js (lid),
   routes/member/werk/rtf.js (gezinslid) en routes/supplier/werving/
   sollicitaties.js (anoniem, zonder app). */
const cv = { headline: 'Keukenhulp', experience: [], skills: ['snijden'], languages: [], about: '' };
const lid = { id: 'a1', name: 'N', func: 'F', contact: 'c', note: '', viaRTG: true,
  codename: 'Zilveren Uil', key: 'user-7', vacatureId: 'v1', cv, status: 'nieuw', at: 't' };
const gezinslid = { id: 'a2', name: 'N', func: 'F', contact: 'c', note: '', viaRTF: true,
  rtf: { code: 'GEZIN', profielId: 'p1' }, vacatureId: 'v1', cv, status: 'nieuw', at: 't' };
const anoniem = { id: 'a3', name: 'N', func: 'F', contact: 'c', note: '', status: 'nieuw', at: 't' };

const sleutels = (r) => Object.keys(r).sort().join(',');

test('een lid en een gezinslid zijn voor de werkgever niet van elkaar te onderscheiden', () => {
  const w = werk();
  assert.equal(sleutels(w.werkgeverSollicitatie(gezinslid)), sleutels(w.werkgeverSollicitatie(lid)));
  assert.deepEqual(w.werkgeverSollicitatie(gezinslid), { ...w.werkgeverSollicitatie(lid), id: 'a2' });
});

test('de werkgever krijgt nooit codenaam, sessiesleutel of gezinsverwijzing', () => {
  const w = werk();
  for (const rij of [lid, gezinslid, anoniem]) {
    const uit = w.werkgeverSollicitatie(rij);
    for (const verboden of ['codename', 'key', 'rtf', 'viaRTF'])
      assert.equal(verboden in uit, false, verboden + ' lekt naar de werkgever');
  }
});

test('een nieuw veld op de rij komt er NIET vanzelf door (positieve lijst)', () => {
  const w = werk();
  const uit = w.werkgeverSollicitatie({ ...gezinslid, gezinsSituatie: 'eenoudergezin' });
  assert.equal('gezinsSituatie' in uit, false);
  for (const k of Object.keys(uit)) assert.ok(WERKGEVER_VELDEN.includes(k) || k === 'viaRTG', k);
});

test('wat de werkgeverschermen lezen, blijft er', () => {
  const uit = werk().werkgeverSollicitatie(lid);
  for (const k of ['id', 'name', 'func', 'contact', 'note', 'status', 'at', 'cv', 'viaRTG'])
    assert.ok(k in uit, k + ' ontbreekt; public/apps/leverancier leest hem');
});
