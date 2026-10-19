/* Twee fouten uit de premiumdomeinkaart (docs/domeinkaarten/travelos.md 8.2):
   - een lijn met een reiziger aan boord kon gewoon worden verwijderd, en
     dan rekende het uitchecken op een lijn die er niet meer is;
   - het zaakoverzicht telde de private operaties van ALLE leden mee, ook van
     zaken die er niets mee te maken hebben. Een zaak ziet alleen een
     operatie waarvan een segment bij die zaak ligt. */
const test = require('node:test');
const assert = require('node:assert/strict');

function dienst(db) {
  let n = 0;
  return require('../server/kern/ov/dienst')({
    db, save: () => {}, schoon: (v, m) => String(v || '').slice(0, m), id: (p) => p + (++n), nu: () => new Date().toISOString(),
    ensureOv: () => {}, lijnVan: (s, id) => (s.lijnen || []).find((l) => l.id === id), versVoertuig: () => true,
    actieveRit: () => null, ritStart: () => null, codes: {}, SOORTEN: { bus: 'B' } });
}

test('een lijn met een reiziger aan boord wordt niet verwijderd, en de manager hoort waarom', () => {
  const zaak = { code: 'TRANSIT', lijnen: [{ id: 'L1', naam: 'Kust', soort: 'bus', haltes: [] }] };
  const db = { data: { ovVoertuigen: [], ovRitten: [{ id: 'r1', code: 'TRANSIT', lijnId: 'L1', status: 'in', in: { at: new Date().toISOString() } }], ovOperaties: [] } };
  const d = dienst(db);
  const r = d.ovLijnZet(zaak, { id: 'L1', weg: true });
  assert.equal(r.status, 409);
  assert.match(r.error, /aan boord/);
  assert.equal(zaak.lijnen.length, 1, 'de lijn staat er nog');
  db.data.ovRitten[0].status = 'uit';
  assert.equal(d.ovLijnZet(zaak, { id: 'L1', weg: true }).status, 200, 'zonder reizigers aan boord mag het wel');
});

test('het zaakoverzicht telt geen private operaties die niet bij deze zaak liggen', () => {
  const zaak = { code: 'TRANSIT', lijnen: [] };
  const op = (lev) => ({ status: 'in-regie', personen: 3, segmenten: [{ modus: 'auto', status: 'aangevraagd', leverancier: lev }] });
  const db = { data: { ovVoertuigen: [], ovRitten: [], ovOperaties: [op(null), op('ANDER'), op('TRANSIT')] } };
  const o = dienst(db).ovOverzicht(zaak).operaties;
  assert.equal(o.actief, 1, 'alleen de operatie met een segment bij TRANSIT');
  assert.equal(o.personen, 3);
});
