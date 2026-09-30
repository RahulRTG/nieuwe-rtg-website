/* De concierge-lus op kernniveau, met een klok die je kunt verzetten. Het
   verval van een aanbod hangt aan de tijd, en een toets die daarvoor een
   minuut wacht wordt de eerste die iemand overslaat -- dus staat de klok hier
   in de hand van de toets (Date.now), en de rest is de echte code uit
   kern/bureau/lus*.js met een kleine opslag ernaast.

   Draai los: node --test test/conciergelus-kern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

function wereld({ magZelf = false } = {}) {
  const lijst = [];
  let n = 0;
  const stap = (c, status, notitie, door) => { c.status = status; c.tijdlijn.push({ status, notitie, door }); };
  const caseOpen = (key, b, o) => {
    const c = { id: 'c' + (++n), titel: b.titel, domein: b.domein, soort: 'regulier', status: 'genoteerd',
      tijdlijn: [], beslissing: { nodig: false } };
    if (o && o.werkwijze === 'voorstel') { c.werkwijze = 'voorstel'; stap(c, 'in voorbereiding', '', 'systeem'); }
    lijst.push(c);
    return { status: 200, zaak: c };
  };
  const verstuurd = [];
  const lus = require('../server/kern/bureau/lus')({ save() {}, schoon: (t, m) => String(t == null ? '' : t).slice(0, m || 200),
    rid: () => 'r' + (++n), nu: () => new Date(Date.now()).toISOString(), caseOpen, caseLijst: () => lijst, stap,
    beoordeel: () => ({ magZelf, reden: magZelf ? 'binnen uw grens' : 'Wij leggen het u voor.' }), notify: null });
  const uit = require('../server/kern/bureau/lus-uitvoering')({ db: { data: {} }, save() {},
    schoon: (t, m) => String(t == null ? '' : t).slice(0, m || 200), rid: () => 'r' + (++n),
    nu: () => new Date(Date.now()).toISOString(), stap, vind: lus.vind,
    notifySupplier: (code, m) => verstuurd.push({ code, m }) });
  return { lus, uit, lijst, verstuurd };
}

function metKlok(fn) {
  const echt = Date.now;
  let t = Date.parse('2026-10-01T18:00:00Z');
  Date.now = () => t;
  try { return fn(min => { t += min * 60000; }); } finally { Date.now = echt; }
}

test('een aanbod dat verloopt voordat het lid akkoord geeft, wordt niet vastgezet (CON-09)', () => metKlok((wacht) => {
  const { lus } = wereld();
  const c = lus.lusIntake('k', { zin: 'Een tafel morgen voor 2 personen in Utrecht.', sleutel: 'sleutel-conciergelus-1-0123456789' }).zaak;
  const a = lus.lusAanbod('k', c.id, { wat: 'Tafel', van: '20:00', geldigMin: 12 }).aanbod;
  assert.equal(lus.lusKies('k', c.id, { aanbod: a.id }).wachtOpLid, true);
  wacht(13);
  const r = lus.lusBeslis('k', c.id, true);
  assert.equal(r.status, 409, 'na twaalf minuten is er geen tafel meer om ja op te zeggen');
  assert.equal(c.status, 'in voorbereiding', 'terug naar het kantoor, met de reden');
  assert.equal(c.onderdelen.length, 0);
  assert.ok(c.tijdlijn.some(x => /verlopen/.test(x.notitie)));
  assert.equal(lus.lusKies('k', c.id, { aanbod: a.id }).status, 409, 'en het kantoor kiest hem ook niet meer');
}));

test('binnen het mandaat zet het kantoor vast; een tweede keuze tijdens een open voorstel kan niet', () => metKlok(() => {
  const w = wereld({ magZelf: true });
  const c = w.lus.lusIntake('k', { zin: 'Diner morgen om 20 uur voor 2 personen in Utrecht.', speelruimteMin: 30, sleutel: 'sleutel-conciergelus-2-0123456789' }).zaak;
  const a = w.lus.lusAanbod('k', c.id, { wat: 'Diner', van: '20:15', geldigMin: 20 }).aanbod;
  assert.equal(w.lus.lusKies('k', c.id, { aanbod: a.id }).vastgezet, true);
  const b = w.lus.lusAanbod('k', c.id, { wat: 'Later diner', van: '21:00', geldigMin: 20 }).aanbod;
  assert.equal(w.lus.lusKies('k', c.id, { aanbod: b.id }).wachtOpLid, true, '60 minuten van 20:00 valt buiten 30');
  const d = w.lus.lusAanbod('k', c.id, { wat: 'Nog een', van: '20:00', geldigMin: 20 }).aanbod;
  assert.equal(w.lus.lusKies('k', c.id, { aanbod: d.id }).status, 409);
}));

test('een verrassing laat geen bericht naar een gedeeld kanaal door, ook niet bij een vertraging (CON-08)', () => metKlok(() => {
  const w = wereld({ magZelf: true });
  const c = w.lus.lusIntake('k', { zin: 'Verrassing: diner morgen om 20 uur voor 2 in Utrecht.', speelruimteMin: 60, sleutel: 'sleutel-conciergelus-3-0123456789' }).zaak;
  assert.equal(c.verrassing, true);
  w.uit.lusOnderdeel('k', c.id, { wat: 'Boot', van: '19:00', duurMin: 60 });
  c.onderdelen.push({ id: 'g', wat: 'Gezinsagenda', van: '20:05', duurMin: 5, deelnemer: { soort: 'gedeeld', code: 'gezin' }, stand: 'bevestigd', vertragingMin: 0 });
  const boot = c.onderdelen.find(o => o.wat === 'Boot');
  const v = w.uit.lusVertraging('k', c.id, { onderdeel: boot.id, minuten: 30 });
  const r = w.uit.lusVerstuur('k', c.id, { klaar: v.klaar.id, gezien: v.klaar.berichten.map(m => m.id) });
  const gedeeld = r.uitslag.find(u => v.klaar.berichten.find(m => m.id === u.id).deelnemer.soort === 'gedeeld');
  assert.equal(gedeeld.bezorgd, false);
  assert.ok(/verrassing/.test(gedeeld.reden));
  assert.equal(w.verstuurd.length, 0, 'niets is de deur uit gegaan naar het gedeelde kanaal');
  assert.equal(c.onderdelen.find(o => o.id === 'g').van, '20:05', 'wie het bericht niet kreeg, houdt zijn oude tijd');
}));

test('stap 0: een oud verzoek dat al bestond, loopt op zijn eigen plek door tot het klaar is', () => {
  const oud = { id: 'v1', titel: 'Jet naar Nice', status: 'aangevraagd', at: '2026-09-01', updates: [] };
  const dossier = { k: { verzoeken: [oud], voorkeuren: {} } };
  let bureauGeroepen = 0;
  const vz = require('../server/kern/lifestyle/verzoek')({ save() {}, schoon: (t, m) => String(t == null ? '' : t).slice(0, m || 200),
    rid: () => 'x', nu: () => '2026-09-30T00:00:00Z', notify: null, liveCodename: null,
    L: key => dossier[key], mijn: { lees: key => dossier[key], alleLezend: () => dossier },
    bureau: () => { bureauGeroepen++; return { cases: () => ({ zaken: [] }) }; },
    balie: () => { throw new Error('een oud verzoek hoort de lus niet te raken'); } });
  assert.equal(vz.conciergeVoortgang('k', 'v1', 'bevestigd', 'Geregeld').status, 200);
  assert.equal(oud.status, 'bevestigd');
  assert.equal(vz.conciergeVerzoeken('k').verzoeken[0].id, 'v1');
  assert.equal(vz.conciergeDesk().verzoeken[0].id, 'v1');
  assert.ok(bureauGeroepen >= 1, 'de lijst vraagt ook de lus, zodat nieuwe cases erbij staan');
});
