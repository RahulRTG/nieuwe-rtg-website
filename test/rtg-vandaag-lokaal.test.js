/* VANDAAG IS DE DAG VAN HET LID, NIET DIE VAN GREENWICH.

   Het kompas van het Overzicht (/apps/rtg.html, apps/rtg-vandaag.js) toonde
   de afspraken van `new Date().toISOString().slice(0, 10)`: de UTC-datum. Een
   agendapunt draagt de datum zoals het lid hem invoerde, op zijn eigen klok.
   Tussen middernacht en twee uur 's nachts (zomertijd) zei het Overzicht dus
   "Vandaag staat er niets in uw agenda" terwijl er wel iets stond, en de kaart
   "volgend moment" verdween. Gevonden bij de voltooiproef van link:ontdek.

   De toets draait het echte script in een vm met een klok op 20 oktober,
   01:30 in Amsterdam (19 oktober, 23:30 UTC). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BRON = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'rtg-vandaag.js'), 'utf8');

function element() {
  const velden = {};
  return { innerHTML: '', hidden: false, textContent: '',
    querySelector: (s) => (velden[s] = velden[s] || { textContent: '' }), velden };
}

test('het kompas toont de afspraak van de lokale dag, ook vlak na middernacht', async () => {
  const oudTZ = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  try {
    const NU = Date.parse('2026-10-19T23:30:00Z');
    const EchteDate = Date;
    class Klok extends EchteDate {
      constructor(...a) { if (a.length) super(...a); else super(NU); }
      static now() { return NU; }
    }
    const el = { momentenrij: element(), dagfeed: element(), dagstil: element(), kompasAgenda: element(), volgendMoment: element() };
    const antwoorden = {
      '/api/sociaal/lijn': { ok: true, regels: [], stil: [] },
      '/api/sociaal/wereld': { regels: [], stil: [] },
      '/api/agenda/mijn-lijst': { items: [
        { titel: 'Gisteren laat', datum: '2026-10-19', tijd: '22:00' },
        { titel: 'Ontbijt met Mila', datum: '2026-10-20', tijd: '08:30' }] }
    };
    const wacht = [];
    const ctx = vm.createContext({
      Date: Klok, JSON, String, Promise, console,
      localStorage: { getItem: () => 'token' },
      document: { getElementById: (id) => el[id] || null },
      fetch: (pad) => { const p = Promise.resolve({ json: () => Promise.resolve(antwoorden[pad] || {}) }); wacht.push(p); return p; }
    });
    vm.runInContext(BRON, ctx);
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    assert.match(el.kompasAgenda.innerHTML, /Ontbijt met Mila/);
    assert.doesNotMatch(el.kompasAgenda.innerHTML, /Gisteren laat/);
    assert.equal(el.volgendMoment.hidden, false);
    assert.equal(el.volgendMoment.velden['[data-veld="titel"]'].textContent, 'Ontbijt met Mila');
  } finally {
    if (oudTZ === undefined) delete process.env.TZ; else process.env.TZ = oudTZ;
  }
});
